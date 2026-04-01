// controllers/moneyFlowController.js
const mongoose = require('mongoose');
const MoneyFlow = require('../models/MoneyFlow');
const Budget = require('../models/Budget');
const Target = require('../models/Target');
const AuditLog = require('../models/AuditLog');

const formatEntry = (entry) => ({
  id: entry._id,
  category: entry.category,
  amount: entry.amount,
  date: entry.date,
  isExpense: entry.isExpense,
  note: entry.note,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
});

const handleError = (error, res, msg = 'Erreur serveur') => {
  console.error(msg, error);
  res.status(500).json({ message: process.env.NODE_ENV === 'production' ? msg : error.message });
};

// Sync all budgets and targets whose category matches the given string
async function syncCategoryToBudgetsAndTargets(category) {
  const re = new RegExp('^' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');

  // Sync budgets (expense entries)
  const budgets = await Budget.find({ category: re });
  for (const budget of budgets) {
    const entries = await MoneyFlow.find({ category: re, isExpense: true });
    budget.usedAmount = entries.reduce((sum, e) => sum + e.amount, 0);
    await budget.save();
  }

  // Sync targets (revenue entries)
  const targets = await Target.find({ category: re });
  for (const target of targets) {
    const entries = await MoneyFlow.find({ category: re, isExpense: false });
    target.realisedAmount = entries.reduce((sum, e) => sum + e.amount, 0);
    await target.save();
  }
}

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, isExpense, category, startDate, endDate } = req.query;
    const filter = {};
    if (isExpense !== undefined) filter.isExpense = isExpense === 'true';
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [entries, total] = await Promise.all([
      MoneyFlow.find(filter).sort({ date: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      MoneyFlow.countDocuments(filter)
    ]);
    res.json({ success: true, data: entries.map(formatEntry), pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des flux');
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const entry = await MoneyFlow.findById(id).lean();
    if (!entry) return res.status(404).json({ message: 'Entrée non trouvée' });
    res.json({ success: true, data: formatEntry(entry) });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération de l\'entrée');
  }
};

exports.create = async (req, res) => {
  try {
    const { category, amount, date, isExpense, note } = req.body;
    if (!category || amount === undefined || isExpense === undefined) {
      return res.status(400).json({ message: 'Catégorie, montant et type sont requis' });
    }
    const entry = new MoneyFlow({
      category,
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
      isExpense: Boolean(isExpense),
      note: note || '',
      createdBy: req.user._id
    });
    await entry.save();
    await AuditLog.create({
      user: req.user._id, action: 'CREATE', entity: 'MONEYFLOW',
      entityId: entry._id,
      details: { category: entry.category, amount: entry.amount, isExpense: entry.isExpense },
      ipAddress: req.ip
    });
    // Auto-sync budgets and targets
    await syncCategoryToBudgetsAndTargets(entry.category);
    res.status(201).json({ success: true, data: formatEntry(entry), message: 'Entrée créée avec succès' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la création de l\'entrée');
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const oldDoc = await MoneyFlow.findById(id);
    if (!oldDoc) return res.status(404).json({ message: 'Entrée non trouvée' });
    const oldCategory = oldDoc.category;

    const { category, amount, date, isExpense, note } = req.body;
    if (category !== undefined) oldDoc.category = category;
    if (amount !== undefined) oldDoc.amount = parseFloat(amount);
    if (date !== undefined) oldDoc.date = new Date(date);
    if (isExpense !== undefined) oldDoc.isExpense = Boolean(isExpense);
    if (note !== undefined) oldDoc.note = note;
    oldDoc.updatedBy = req.user._id;
    await oldDoc.save();

    await AuditLog.create({
      user: req.user._id, action: 'UPDATE', entity: 'MONEYFLOW', entityId: id,
      details: { category: oldDoc.category }, ipAddress: req.ip
    });

    // Sync old category (may now sum to 0) and new category
    if (oldCategory !== oldDoc.category) {
      await syncCategoryToBudgetsAndTargets(oldCategory);
    }
    await syncCategoryToBudgetsAndTargets(oldDoc.category);

    res.json({ success: true, data: formatEntry(oldDoc), message: 'Entrée modifiée' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la modification de l\'entrée');
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const entry = await MoneyFlow.findById(id);
    if (!entry) return res.status(404).json({ message: 'Entrée non trouvée' });
    const category = entry.category;
    await entry.deleteOne();
    await AuditLog.create({
      user: req.user._id, action: 'DELETE', entity: 'MONEYFLOW', entityId: id,
      details: { category }, ipAddress: req.ip
    });
    await syncCategoryToBudgetsAndTargets(category);
    res.json({ success: true, message: 'Entrée supprimée avec succès' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la suppression de l\'entrée');
  }
};
