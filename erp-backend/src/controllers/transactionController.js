// src/controllers/transactionController.js
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const {
  abortOptionalTransaction,
  commitOptionalTransaction,
  endOptionalSession,
  getSessionOptions,
  startOptionalSession,
  withOptionalSession,
} = require('../utils/mongoTransaction');

/**
 * Formatter une transaction pour le frontend
 */
const formatTransaction = (transaction) => ({
  id: transaction._id,
  transactionNumber: transaction.transactionNumber,
  date: transaction.date,
  description: transaction.description,
  entries: transaction.entries.map(entry => ({
    id: entry._id,
    account: entry.account,
    debit: entry.debit,
    credit: entry.credit,
    label: entry.label
  })),
  totalDebit: transaction.totalDebit,
  totalCredit: transaction.totalCredit,
  reference: transaction.reference,
  referenceId: transaction.referenceId,
  referenceModel: transaction.referenceModel,
  status: transaction.status,
  createdBy: transaction.createdBy,
  validatedBy: transaction.validatedBy,
  validatedAt: transaction.validatedAt,
  createdAt: transaction.createdAt,
  updatedAt: transaction.updatedAt
});

/**
 * Gérer les erreurs de manière sécurisée
 */
const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`❌ ${defaultMessage}:`, error);
  const message = process.env.NODE_ENV === 'production' 
    ? defaultMessage 
    : error.message;
  res.status(500).json({ success: false, message });
};

/**
 * Valider les entrées comptables
 */
const validateEntries = async (entries) => {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw new Error('Au moins une écriture est requise');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    // Vérifier le compte
    if (!mongoose.Types.ObjectId.isValid(entry.account)) {
      throw new Error(`ID de compte invalide: ${entry.account}`);
    }

    const account = await Account.findById(entry.account);
    if (!account) {
      throw new Error(`Compte ${entry.account} non trouvé`);
    }

    // Vérifier les montants
    const debit = parseFloat(entry.debit) || 0;
    const credit = parseFloat(entry.credit) || 0;

    if (debit < 0 || credit < 0) {
      throw new Error('Les montants ne peuvent pas être négatifs');
    }

    if (debit > 0 && credit > 0) {
      throw new Error('Une ligne ne peut pas avoir à la fois débit et crédit');
    }

    if (debit === 0 && credit === 0) {
      throw new Error('Une ligne doit avoir soit un débit soit un crédit');
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) { // Tolérance pour arrondis
    throw new Error(`Déséquilibre: Débit (${totalDebit.toFixed(2)}) ≠ Crédit (${totalCredit.toFixed(2)})`);
  }

  return { totalDebit, totalCredit };
};

/**
 * Générer un numéro de transaction unique
 */
const generateTransactionNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const count = await Transaction.countDocuments({
    transactionNumber: { $regex: `^ECR-${year}${month}` }
  });
  return `ECR-${year}${month}-${String(count + 1).padStart(6, '0')}`;
};

// ===== POST /api/transactions =====
exports.create = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { date, description, entries, reference, referenceId, referenceModel } = req.body;

    // Validations
    if (!description) {
      return res.status(400).json({ 
        success: false, 
        message: 'La description est requise' 
      });
    }

    // Valider les écritures
    const { totalDebit, totalCredit } = await validateEntries(entries);

    // Générer le numéro de transaction
    const transactionNumber = await generateTransactionNumber();

    // Créer la transaction
    const transaction = await Transaction.create([{
      transactionNumber,
      date: date || new Date(),
      description: description.trim(),
      entries: entries.map(e => ({
        account: e.account,
        debit: parseFloat(e.debit) || 0,
        credit: parseFloat(e.credit) || 0,
        label: e.label || description
      })),
      totalDebit,
      totalCredit,
      reference,
      referenceId,
      referenceModel,
      status: 'brouillon',
      createdBy: req.user._id
    }], getSessionOptions(session));

    // Journaliser
    await AuditLog.create([{
      user: req.user._id,
      action: 'CREATE',
      entity: 'TRANSACTION',
      entityId: transaction[0]._id,
      details: { 
        transactionNumber: transaction[0].transactionNumber,
        totalDebit,
        totalCredit
      },
      ipAddress: req.ip
    }], getSessionOptions(session));

    await commitOptionalTransaction(session);

    const populatedTransaction = await Transaction.findById(transaction[0]._id)
      .populate('entries.account', 'code name type')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: formatTransaction(populatedTransaction),
      message: 'Transaction créée avec succès'
    });

  } catch (error) {
    await abortOptionalTransaction(session);
    
    if (error.message.includes('Déséquilibre') || 
        error.message.includes('invalide') || 
        error.message.includes('requise')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    handleError(error, res, 'Erreur lors de la création de la transaction');
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/transactions =====
exports.getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate, 
      accountId, 
      status,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};

    // Filtres par date
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Filtre par statut
    if (status) filter.status = status;

    // Filtre par compte
    if (accountId) {
      filter['entries.account'] = new mongoose.Types.ObjectId(accountId);
    }

    // Recherche textuelle
    if (search) {
      filter.$or = [
        { transactionNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } }
      ];
    }

    // Construction du tri
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('entries.account', 'code name type')
        .populate('createdBy', 'firstName lastName')
        .populate('validatedBy', 'firstName lastName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    // Calculer les totaux pour la page
    const totals = transactions.reduce((acc, t) => ({
      totalDebit: acc.totalDebit + t.totalDebit,
      totalCredit: acc.totalCredit + t.totalCredit
    }), { totalDebit: 0, totalCredit: 0 });

    res.json({
      success: true,
      data: transactions.map(formatTransaction),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      totals
    });

  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des transactions');
  }
};

// ===== GET /api/transactions/:id =====
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID transaction invalide' 
      });
    }

    const transaction = await Transaction.findById(id)
      .populate('entries.account', 'code name type')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName')
      .lean();

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée' 
      });
    }

    res.json({
      success: true,
      data: formatTransaction(transaction)
    });

  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération de la transaction');
  }
};

// ===== PUT /api/transactions/:id =====
exports.update = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { id } = req.params;
    const { description, entries } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID transaction invalide' 
      });
    }

    const transaction = await withOptionalSession(Transaction.findById(id), session);
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée' 
      });
    }

    if (transaction.status !== 'brouillon') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de modifier une transaction validée' 
      });
    }

    // Mise à jour des champs
    if (description) {
      transaction.description = description.trim();
    }

    if (entries) {
      const { totalDebit, totalCredit } = await validateEntries(entries);
      
      transaction.entries = entries.map(e => ({
        account: e.account,
        debit: parseFloat(e.debit) || 0,
        credit: parseFloat(e.credit) || 0,
        label: e.label || description
      }));
      transaction.totalDebit = totalDebit;
      transaction.totalCredit = totalCredit;
    }

    transaction.updatedAt = Date.now();
    await transaction.save(getSessionOptions(session));

    // Journaliser
    await AuditLog.create([{
      user: req.user._id,
      action: 'UPDATE',
      entity: 'TRANSACTION',
      entityId: transaction._id,
      details: { 
        transactionNumber: transaction.transactionNumber,
        updatedFields: Object.keys(req.body)
      },
      ipAddress: req.ip
    }], getSessionOptions(session));

    await commitOptionalTransaction(session);

    const updatedTransaction = await Transaction.findById(transaction._id)
      .populate('entries.account', 'code name type')
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      data: formatTransaction(updatedTransaction),
      message: 'Transaction mise à jour avec succès'
    });

  } catch (error) {
    await abortOptionalTransaction(session);

    if (error.message.includes('Déséquilibre') || 
        error.message.includes('invalide')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    handleError(error, res, 'Erreur lors de la mise à jour de la transaction');
  } finally {
    endOptionalSession(session);
  }
};

// ===== DELETE /api/transactions/:id =====
exports.delete = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID transaction invalide' 
      });
    }

    const transaction = await withOptionalSession(Transaction.findById(id), session);
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée' 
      });
    }

    if (transaction.status !== 'brouillon') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de supprimer une transaction validée' 
      });
    }

    await transaction.deleteOne(getSessionOptions(session));

    // Journaliser
    await AuditLog.create([{
      user: req.user._id,
      action: 'DELETE',
      entity: 'TRANSACTION',
      entityId: id,
      details: { transactionNumber: transaction.transactionNumber },
      ipAddress: req.ip
    }], getSessionOptions(session));

    await commitOptionalTransaction(session);

    res.json({
      success: true,
      message: 'Transaction supprimée avec succès'
    });

  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la suppression de la transaction');
  } finally {
    endOptionalSession(session);
  }
};

// ===== PATCH /api/transactions/:id/validate =====
exports.validate = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID transaction invalide' 
      });
    }

    const transaction = await withOptionalSession(Transaction.findById(id), session);
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée' 
      });
    }

    if (transaction.status === 'validé') {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction déjà validée' 
      });
    }

    transaction.status = 'validé';
    transaction.validatedBy = req.user._id;
    transaction.validatedAt = Date.now();
    await transaction.save(getSessionOptions(session));

    // Journaliser
    await AuditLog.create([{
      user: req.user._id,
      action: 'VALIDATE',
      entity: 'TRANSACTION',
      entityId: transaction._id,
      details: { 
        transactionNumber: transaction.transactionNumber,
        totalDebit: transaction.totalDebit,
        totalCredit: transaction.totalCredit
      },
      ipAddress: req.ip
    }], getSessionOptions(session));

    await commitOptionalTransaction(session);

    const validatedTransaction = await Transaction.findById(transaction._id)
      .populate('entries.account', 'code name type')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName');

    res.json({
      success: true,
      data: formatTransaction(validatedTransaction),
      message: 'Transaction validée avec succès'
    });

  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la validation de la transaction');
  } finally {
    endOptionalSession(session);
  }
};

// ===== GET /api/transactions/ledger/:accountId =====
exports.getLedger = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID compte invalide' 
      });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Compte non trouvé' 
      });
    }

    // Construire la requête
    const matchStage = {
      status: 'validé',
      'entries.account': new mongoose.Types.ObjectId(accountId)
    };
    
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    // Récupérer les transactions
    const transactions = await Transaction.aggregate([
      { $match: matchStage },
      { $unwind: '$entries' },
      { $match: { 'entries.account': new mongoose.Types.ObjectId(accountId) } },
      { $sort: { date: 1 } },
      { $limit: parseInt(limit) }
    ]);

    // Calculer le solde initial avant la période
    let openingBalance = 0;
    if (startDate) {
      const previousTransactions = await Transaction.aggregate([
        {
          $match: {
            status: 'validé',
            date: { $lt: new Date(startDate) },
            'entries.account': new mongoose.Types.ObjectId(accountId)
          }
        },
        { $unwind: '$entries' },
        { $match: { 'entries.account': new mongoose.Types.ObjectId(accountId) } },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$entries.debit' },
            totalCredit: { $sum: '$entries.credit' }
          }
        }
      ]);

      if (previousTransactions.length > 0) {
        const { totalDebit, totalCredit } = previousTransactions[0];
        openingBalance = (account.type === 'actif' || account.type === 'charge')
          ? totalDebit - totalCredit
          : totalCredit - totalDebit;
      }
    }

    // Calculer le solde courant
    let currentBalance = openingBalance;
    const entries = [];

    for (const trans of transactions) {
      const debit = trans.entries.debit || 0;
      const credit = trans.entries.credit || 0;

      if (account.type === 'actif' || account.type === 'charge') {
        currentBalance += debit - credit;
      } else {
        currentBalance += credit - debit;
      }

      entries.push({
        id: trans._id,
        date: trans.date,
        transactionNumber: trans.transactionNumber,
        description: trans.description,
        debit,
        credit,
        balance: currentBalance,
        reference: trans.reference
      });
    }

    res.json({
      success: true,
      data: {
        account: {
          id: account._id,
          code: account.code,
          name: account.name,
          type: account.type
        },
        openingBalance,
        entries,
        closingBalance: currentBalance
      }
    });

  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération du grand livre');
  }
};

// ===== GET /api/transactions/trial-balance =====
exports.getTrialBalance = async (req, res) => {
  try {
    const { date } = req.query;
    const balanceDate = date ? new Date(date) : new Date();

    // Récupérer tous les comptes actifs
    const accounts = await Account.find({ isActive: true }).sort('code');

    // Récupérer les transactions validées jusqu'à la date
    const transactions = await Transaction.aggregate([
      {
        $match: {
          status: 'validé',
          date: { $lte: balanceDate }
        }
      },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.account',
          totalDebit: { $sum: '$entries.debit' },
          totalCredit: { $sum: '$entries.credit' }
        }
      }
    ]);

    // Construire la balance
    const trialBalance = accounts.map(account => {
      const trans = transactions.find(t => 
        t._id.toString() === account._id.toString()
      );
      
      const debit = trans?.totalDebit || 0;
      const credit = trans?.totalCredit || 0;
      
      let balance;
      if (account.type === 'actif' || account.type === 'charge') {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      return {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        balance: Math.round(balance * 100) / 100
      };
    });

    // Calculer les totaux
    const totals = trialBalance.reduce(
      (acc, curr) => ({
        totalDebit: acc.totalDebit + curr.debit,
        totalCredit: acc.totalCredit + curr.credit,
        totalBalance: acc.totalBalance + Math.abs(curr.balance)
      }),
      { totalDebit: 0, totalCredit: 0, totalBalance: 0 }
    );

    res.json({
      success: true,
      data: {
        asOf: balanceDate,
        accounts: trialBalance,
        totals: {
          debit: Math.round(totals.totalDebit * 100) / 100,
          credit: Math.round(totals.totalCredit * 100) / 100,
          difference: Math.round((totals.totalDebit - totals.totalCredit) * 100) / 100
        }
      }
    });

  } catch (error) {
    handleError(error, res, 'Erreur lors de la génération de la balance');
  }
};

// ===== GET /api/transactions/stats =====
exports.getStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const stats = await Transaction.aggregate([
      {
        $match: {
          status: 'validé',
          date: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
          }
        }
      },
      {
        $facet: {
          monthly: [
            {
              $group: {
                _id: { $month: '$date' },
                count: { $sum: 1 },
                totalDebit: { $sum: '$totalDebit' },
                totalCredit: { $sum: '$totalCredit' }
              }
            },
            { $sort: { _id: 1 } }
          ],
          byAccountType: [
            { $unwind: '$entries' },
            {
              $lookup: {
                from: 'accounts',
                localField: 'entries.account',
                foreignField: '_id',
                as: 'account'
              }
            },
            { $unwind: '$account' },
            {
              $group: {
                _id: '$account.type',
                count: { $sum: 1 },
                totalDebit: { $sum: '$entries.debit' },
                totalCredit: { $sum: '$entries.credit' }
              }
            }
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalDebit: { $sum: '$totalDebit' },
                totalCredit: { $sum: '$totalCredit' }
              }
            }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        monthly: stats[0].monthly,
        byAccountType: stats[0].byAccountType,
        totals: stats[0].totals[0] || { totalTransactions: 0, totalDebit: 0, totalCredit: 0 }
      }
    });

  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};

// ===== POST /api/transactions/bulk =====
exports.bulkCreate = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Au moins une transaction est requise' 
      });
    }

    const createdTransactions = [];

    for (const transData of transactions) {
      const { date, description, entries, reference } = transData;

      // Valider les écritures
      const { totalDebit, totalCredit } = await validateEntries(entries);
      const transactionNumber = await generateTransactionNumber();

      const transaction = await Transaction.create([{
        transactionNumber,
        date: date || new Date(),
        description: description.trim(),
        entries: entries.map(e => ({
          account: e.account,
          debit: parseFloat(e.debit) || 0,
          credit: parseFloat(e.credit) || 0,
          label: e.label || description
        })),
        totalDebit,
        totalCredit,
        reference,
        status: 'brouillon',
        createdBy: req.user._id
      }], getSessionOptions(session));

      createdTransactions.push(transaction[0]);
    }

    await commitOptionalTransaction(session);

    res.status(201).json({
      success: true,
      data: createdTransactions.map(t => ({
        id: t._id,
        transactionNumber: t.transactionNumber,
        description: t.description
      })),
      message: `${createdTransactions.length} transaction(s) créée(s) avec succès`
    });

  } catch (error) {
    await abortOptionalTransaction(session);

    if (error.message.includes('Déséquilibre')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    handleError(error, res, 'Erreur lors de la création en masse');
  } finally {
    endOptionalSession(session);
  }
};

// Export de toutes les fonctions
module.exports = {
  create: exports.create,
  getAll: exports.getAll,
  getById: exports.getById,
  update: exports.update,
  delete: exports.delete,
  validate: exports.validate,
  getLedger: exports.getLedger,
  getTrialBalance: exports.getTrialBalance,
  getStats: exports.getStats,
  bulkCreate: exports.bulkCreate
};
