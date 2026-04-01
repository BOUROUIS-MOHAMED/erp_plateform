// controllers/accountController.js
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const {
  abortOptionalTransaction,
  commitOptionalTransaction,
  endOptionalSession,
  getSessionOptions,
  startOptionalSession,
  withOptionalSession,
} = require('../utils/mongoTransaction');

const ACCOUNT_PRESETS = {
  banque: { type: 'tresorerie', category: 'banque', label: 'Banque', codePrefix: '512' },
  caisse: { type: 'tresorerie', category: 'caisse', label: 'Banque', codePrefix: '53' },
  epargne: { type: 'actif', category: 'investissement', label: 'Epargne', codePrefix: '581' },
  creance: { type: 'actif', category: 'client', label: 'Creance', codePrefix: '411' },
  dette: { type: 'passif', category: 'fournisseur', label: 'Dette', codePrefix: '401' },
  actif: { type: 'actif', category: 'client', label: 'Creance', codePrefix: '411' },
  passif: { type: 'passif', category: 'fournisseur', label: 'Dette', codePrefix: '401' },
  produit: { type: 'produit', category: 'vente', label: 'Produit', codePrefix: '701' },
  charge: { type: 'charge', category: 'achat', label: 'Charge', codePrefix: '601' },
  tresorerie: { type: 'tresorerie', category: 'banque', label: 'Banque', codePrefix: '512' },
  investissement: { type: 'actif', category: 'investissement', label: 'Epargne', codePrefix: '581' },
  client: { type: 'actif', category: 'client', label: 'Creance', codePrefix: '411' },
  fournisseur: { type: 'passif', category: 'fournisseur', label: 'Dette', codePrefix: '401' }
};

const toAsciiKey = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

const getMetadata = (account) => {
  if (!account?.metadata) {
    return {};
  }

  if (typeof account.metadata.get === 'function') {
    return Object.fromEntries(account.metadata);
  }

  return account.metadata;
};

const getPreset = (type = '', category = '') =>
  ACCOUNT_PRESETS[toAsciiKey(type)] ||
  ACCOUNT_PRESETS[toAsciiKey(category)] ||
  ACCOUNT_PRESETS.banque;

const normalizeAccountPayload = (payload = {}, fallback = {}) => {
  const preset = getPreset(payload.type ?? fallback.type, payload.category ?? fallback.category);
  const typeKey = toAsciiKey(payload.type ?? fallback.type);
  const categoryKey = toAsciiKey(payload.category ?? fallback.category);

  return {
    type: ACCOUNT_PRESETS[typeKey]?.type || preset.type,
    category: ACCOUNT_PRESETS[categoryKey]?.category || preset.category,
    codePrefix: preset.codePrefix
  };
};

const buildMetadata = (account, payload = {}) => {
  const metadata = { ...getMetadata(account) };

  if (payload.number !== undefined) {
    metadata.number = String(payload.number || '').trim();
  }

  if (payload.iban !== undefined) {
    metadata.iban = String(payload.iban || '').replace(/\s/g, '');
  }

  if (payload.bic !== undefined) {
    metadata.bic = String(payload.bic || '').trim();
  }

  if (payload.notes !== undefined || payload.description !== undefined) {
    metadata.notes = String(payload.notes ?? payload.description ?? '').trim();
  }

  return metadata;
};

const generateAccountCode = async (prefix = '512') => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lastAccount = await Account.findOne({ code: { $regex: `^${escapedPrefix}` } })
    .sort({ code: -1 })
    .select('code')
    .lean();

  if (!lastAccount) {
    return `${prefix}1`;
  }
  const lastCode = Number(lastAccount.code);
  const nextCode = Number.isFinite(lastCode) ? lastCode + 1 : Number(`${prefix}1`);

  return String(nextCode);
};

const formatAccount = (account, soldeFromTransactions = 0) => {
  const metadata = getMetadata(account);
  const preset = getPreset(account.type, account.category);
  const capital = Number(account.balance || 0);

  return {
    id: account._id,
    name: account.name,
    type: preset.label || account.type,
    number: metadata.number || account.code,
    iban: metadata.iban || '',
    bic: metadata.bic || '',
    balance: capital + soldeFromTransactions,
    capital: capital,
    solde: capital + soldeFromTransactions,
    inMoneyFlow: Boolean(account.inMoneyFlow ?? account.inBudget),
    currency: account.currency || 'EUR',
    status: account.isActive === false ? 'inactif' : 'actif',
    notes: account.description || metadata.notes || '',
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    code: account.code,
    category: account.category
  };
};

// Compute net debit-credit for each account from validated transactions
const computeSoldesFromTransactions = async (accountIds) => {
  const results = await Transaction.aggregate([
    { $match: { status: 'validé' } },
    { $unwind: '$entries' },
    { $match: { 'entries.account': { $in: accountIds } } },
    { $group: {
      _id: '$entries.account',
      totalDebit: { $sum: '$entries.debit' },
      totalCredit: { $sum: '$entries.credit' }
    }}
  ]);
  const map = {};
  results.forEach(r => {
    map[r._id.toString()] = r.totalDebit - r.totalCredit;
  });
  return map;
};

const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`ERROR ${defaultMessage}:`, error);
  const message = process.env.NODE_ENV === 'production' ? defaultMessage : error.message;
  res.status(500).json({ success: false, message });
};

// ===== GET /api/accounts =====
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status, search, inMoneyFlow } = req.query;
    const filter = {};

    if (inMoneyFlow !== undefined) {
      filter.inMoneyFlow = inMoneyFlow === 'true';
    }

    if (type) {
      const normalized = normalizeAccountPayload({ type });
      filter.type = normalized.type;

      if (['banque', 'caisse', 'investissement', 'client', 'fournisseur'].includes(normalized.category)) {
        filter.category = normalized.category;
      }
    }

    if (status) {
      filter.isActive = status === 'actif' || status === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'metadata.number': { $regex: search, $options: 'i' } }
      ];
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const [accounts, total] = await Promise.all([
      Account.find(filter)
        .sort({ code: 1, name: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Account.countDocuments(filter)
    ]);

    const accountIds = accounts.map(a => a._id);
    const soldeMap = await computeSoldesFromTransactions(accountIds);

    const formatted = accounts.map(a => formatAccount(a, soldeMap[a._id.toString()] || 0));

    const totals = formatted.reduce(
      (acc, account) => ({
        totalBalance: acc.totalBalance + (account.solde || 0)
      }),
      { totalBalance: 0 }
    );

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      },
      totals
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la recuperation des comptes');
  }
};

// ===== GET /api/accounts/:id =====
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID compte invalide' });
    }

    const account = await Account.findById(id).lean();
    if (!account) {
      return res.status(404).json({ message: 'Compte non trouve' });
    }

    const transactions = await Transaction.find({ 'entries.account': id })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        ...formatAccount(account),
        recentTransactions: transactions
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la recuperation du compte');
  }
};

// ===== POST /api/accounts =====
exports.create = async (req, res) => {
  try {
    const { name, currency, balance, code, status, isActive } = req.body;

    if (!name || !req.body.type) {
      return res.status(400).json({ message: 'Nom et type sont requis' });
    }

    const normalized = normalizeAccountPayload(req.body);
    const resolvedCode = String(code || await generateAccountCode(normalized.codePrefix)).trim();
    const existingCode = await Account.findOne({ code: resolvedCode });

    if (existingCode) {
      return res.status(400).json({ message: 'Un compte avec ce code existe deja' });
    }

    const account = new Account({
      code: resolvedCode,
      name: String(name).trim(),
      type: normalized.type,
      category: normalized.category,
      balance: parseFloat(balance) || 0,
      inMoneyFlow: Boolean(req.body.inMoneyFlow ?? req.body.inBudget),
      currency: String(currency || 'EUR').trim().toUpperCase(),
      isActive: isActive !== undefined ? Boolean(isActive) : status !== 'inactif',
      description: String(req.body.description || req.body.notes || '').trim(),
      metadata: buildMetadata(null, req.body),
      createdBy: req.user._id
    });

    await account.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE',
      entity: 'ACCOUNT',
      entityId: account._id,
      details: { name: account.name, type: account.type, category: account.category },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: formatAccount(account),
      message: 'Compte cree avec succes'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Un compte avec ce code existe deja' });
    }
    handleError(error, res, 'Erreur lors de la creation du compte');
  }
};

// ===== PUT /api/accounts/:id =====
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID compte invalide' });
    }

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Compte non trouve' });
    }

    const updatedFields = [];

    if (updates.code !== undefined) {
      const nextCode = String(updates.code || '').trim();
      if (nextCode && nextCode !== account.code) {
        const existing = await Account.findOne({ code: nextCode, _id: { $ne: id } });
        if (existing) {
          return res.status(400).json({ message: 'Un compte avec ce code existe deja' });
        }
        account.code = nextCode;
        updatedFields.push('code');
      }
    }

    if (updates.name !== undefined) {
      account.name = String(updates.name || '').trim();
      updatedFields.push('name');
    }

    if (updates.type !== undefined || updates.category !== undefined) {
      const normalized = normalizeAccountPayload(updates, account);

      if (account.type !== normalized.type) {
        account.type = normalized.type;
        updatedFields.push('type');
      }

      if (account.category !== normalized.category) {
        account.category = normalized.category;
        updatedFields.push('category');
      }
    }

    if (updates.balance !== undefined) {
      account.balance = parseFloat(updates.balance) || 0;
      updatedFields.push('balance');
    }

    if (updates.inMoneyFlow !== undefined || updates.inBudget !== undefined) {
      account.inMoneyFlow = Boolean(updates.inMoneyFlow ?? updates.inBudget);
      updatedFields.push('inMoneyFlow');
    }

    if (updates.currency !== undefined) {
      account.currency = String(updates.currency || 'EUR').trim().toUpperCase();
      updatedFields.push('currency');
    }

    if (updates.status !== undefined || updates.isActive !== undefined) {
      account.isActive = updates.isActive !== undefined ? Boolean(updates.isActive) : updates.status !== 'inactif';
      updatedFields.push('isActive');
    }

    if (updates.notes !== undefined || updates.description !== undefined) {
      account.description = String(updates.description ?? updates.notes ?? '').trim();
      updatedFields.push('description');
    }

    const currentMetadata = getMetadata(account);
    const nextMetadata = buildMetadata(account, updates);
    if (JSON.stringify(currentMetadata) !== JSON.stringify(nextMetadata)) {
      account.metadata = nextMetadata;
      updatedFields.push('metadata');
    }

    if (updatedFields.length === 0) {
      return res.status(400).json({ message: 'Aucune modification detectee' });
    }

    account.updatedBy = req.user._id;
    await account.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE',
      entity: 'ACCOUNT',
      entityId: account._id,
      details: { updatedFields },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: formatAccount(account),
      message: 'Compte mis a jour avec succes'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la mise a jour du compte');
  }
};

// ===== DELETE /api/accounts/:id =====
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID compte invalide' });
    }

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Compte non trouve' });
    }

    // Delete all transactions that reference this account
    const deletedTransactions = await Transaction.deleteMany({
      'entries.account': id
    });

    if (deletedTransactions.deletedCount > 0) {
      console.log(`Cascade delete: ${deletedTransactions.deletedCount} transaction(s) supprimee(s) pour le compte ${account.name}`);
    }

    await account.deleteOne();

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE',
      entity: 'ACCOUNT',
      entityId: id,
      details: { name: account.name },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Compte supprime avec succes'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la suppression du compte');
  }
};

// ===== GET /api/accounts/:id/balance =====
exports.getBalance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID compte invalide' });
    }

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Compte non trouve' });
    }

    res.json({
      success: true,
      data: {
        balance: account.balance,
        currency: account.currency || 'EUR'
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la recuperation du solde');
  }
};

// ===== GET /api/accounts/:id/transactions =====
exports.getTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID compte invalide' });
    }

    const filter = {
      status: { $regex: '^valid', $options: 'i' },
      'entries.account': id
    };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit, 10))
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.json({
      success: true,
      data: transactions.map((transaction) => ({
        id: transaction._id,
        date: transaction.date,
        transactionNumber: transaction.transactionNumber,
        description: transaction.description,
        debit: transaction.entries.find((entry) => entry.account.toString() === id)?.debit || 0,
        credit: transaction.entries.find((entry) => entry.account.toString() === id)?.credit || 0,
        reference: transaction.reference
      }))
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la recuperation des transactions');
  }
};

// ===== GET /api/accounts/stats =====
exports.getStats = async (req, res) => {
  try {
    const stats = await Account.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
          avgBalance: { $avg: '$balance' }
        }
      }
    ]);

    const totals = await Account.aggregate([
      {
        $group: {
          _id: null,
          totalAccounts: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
          activeAccounts: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byType: stats,
        totals: totals[0] || { totalAccounts: 0, totalBalance: 0, activeAccounts: 0 }
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la recuperation des statistiques');
  }
};

// ===== PATCH /api/accounts/:id/balance =====
exports.updateBalance = async (req, res) => {
  const session = await startOptionalSession();

  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID compte invalide' });
    }

    const account = await withOptionalSession(Account.findById(id), session);
    if (!account) {
      return res.status(404).json({ message: 'Compte non trouve' });
    }

    account.balance += parseFloat(amount) || 0;
    account.updatedBy = req.user?._id;
    await account.save(getSessionOptions(session));

    await commitOptionalTransaction(session);

    res.json({
      success: true,
      data: { balance: account.balance, currency: account.currency || 'EUR' },
      message: 'Solde mis a jour avec succes'
    });
  } catch (error) {
    await abortOptionalTransaction(session);
    handleError(error, res, 'Erreur lors de la mise a jour du solde');
  } finally {
    endOptionalSession(session);
  }
};

module.exports = {
  getAll: exports.getAll,
  getById: exports.getById,
  create: exports.create,
  update: exports.update,
  delete: exports.delete,
  getBalance: exports.getBalance,
  getTransactions: exports.getTransactions,
  getStats: exports.getStats,
  updateBalance: exports.updateBalance
};
