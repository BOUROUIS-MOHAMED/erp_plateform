// controllers/budgetController.js
const Budget = require('../models/Budget');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

const formatBudget = (budget) => ({
  id: budget._id,
  category: budget.category,
  budget: budget.budget,
  usedAmount: budget.usedAmount || 0,
  startDate: budget.startDate,
  endDate: budget.endDate,
  status: budget.status,
  notes: budget.notes,
  createdAt: budget.createdAt,
  updatedAt: budget.updatedAt
});

const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`❌ ${defaultMessage}:`, error);
  const message = process.env.NODE_ENV === 'production' ? defaultMessage : error.message;
  res.status(500).json({ message });
};

// ===== GET /api/budgets =====
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (startDate) filter.startDate = { $gte: new Date(startDate) };
    if (endDate) filter.endDate = { $lte: new Date(endDate) };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [budgets, total] = await Promise.all([
      Budget.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Budget.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: budgets.map(formatBudget),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des budgets');
  }
};

// ===== GET /api/budgets/stats =====
exports.getStats = async (req, res) => {
  try {
    const stats = await Budget.aggregate([
      {
        $group: {
          _id: null,
          totalBudget: { $sum: '$budget' },
          totalUsed: { $sum: '$usedAmount' },
          count: { $sum: 1 },
          respected: { $sum: { $cond: [{ $eq: ['$status', 'respected'] }, 1, 0] } },
          passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } }
        }
      }
    ]);
    res.json({ success: true, data: stats[0] || { totalBudget: 0, totalUsed: 0, count: 0, respected: 0, passed: 0 } });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};

// ===== GET /api/budgets/:id =====
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID budget invalide' });
    const budget = await Budget.findById(id).lean();
    if (!budget) return res.status(404).json({ message: 'Budget non trouvé' });
    res.json({ success: true, data: formatBudget(budget) });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération du budget');
  }
};

// ===== POST /api/budgets =====
exports.create = async (req, res) => {
  try {
    const { category, budget, usedAmount, startDate, endDate, notes } = req.body;
    if (!category || budget === undefined || !startDate || !endDate) {
      return res.status(400).json({ message: 'Catégorie, montant, date début et date fin sont requis' });
    }
    const newBudget = new Budget({
      category,
      budget: parseFloat(budget),
      usedAmount: parseFloat(usedAmount) || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || '',
      createdBy: req.user._id
    });
    await newBudget.save();
    await AuditLog.create({
      user: req.user._id, action: 'CREATE', entity: 'BUDGET',
      entityId: newBudget._id,
      details: { category: newBudget.category, budget: newBudget.budget },
      ipAddress: req.ip
    });
    res.status(201).json({ success: true, data: formatBudget(newBudget), message: 'Budget créé avec succès' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la création du budget');
  }
};

// ===== PUT /api/budgets/:id =====
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID budget invalide' });
    const budget = await Budget.findById(id);
    if (!budget) return res.status(404).json({ message: 'Budget non trouvé' });

    const { category, budget: amount, usedAmount, startDate, endDate, notes, status } = req.body;
    if (category !== undefined) budget.category = category;
    if (amount !== undefined) budget.budget = parseFloat(amount);
    if (usedAmount !== undefined) budget.usedAmount = parseFloat(usedAmount);
    if (startDate) {
      budget.startDate = new Date(startDate);
    } else if (!budget.startDate) {
      return res.status(400).json({ message: 'La date de début est requise' });
    }
    if (endDate) {
      budget.endDate = new Date(endDate);
    } else if (!budget.endDate) {
      return res.status(400).json({ message: 'La date de fin est requise' });
    }
    if (notes !== undefined) budget.notes = notes;
    // Allow manually setting desactivated; other statuses are auto-calculated in pre-save
    if (status === 'desactivated') budget.status = 'desactivated';
    else if (budget.status === 'desactivated' && status !== undefined) budget.status = status;

    budget.updatedBy = req.user._id;
    await budget.save();
    await AuditLog.create({
      user: req.user._id, action: 'UPDATE', entity: 'BUDGET', entityId: budget._id,
      details: { category: budget.category }, ipAddress: req.ip
    });
    res.json({ success: true, data: formatBudget(budget), message: 'Budget modifié' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la modification du budget');
  }
};

// ===== PATCH /api/budgets/:id/used =====
exports.updateUsed = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID budget invalide' });
    const budget = await Budget.findById(id);
    if (!budget) return res.status(404).json({ message: 'Budget non trouvé' });
    const { usedAmount } = req.body;
    if (usedAmount === undefined) return res.status(400).json({ message: 'usedAmount requis' });
    budget.usedAmount = parseFloat(usedAmount);
    budget.updatedBy = req.user._id;
    await budget.save();
    res.json({ success: true, data: formatBudget(budget) });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la mise à jour du montant utilisé');
  }
};

// ===== DELETE /api/budgets/:id =====
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID budget invalide' });
    const budget = await Budget.findById(id);
    if (!budget) return res.status(404).json({ message: 'Budget non trouvé' });
    await budget.deleteOne();
    await AuditLog.create({
      user: req.user._id, action: 'DELETE', entity: 'BUDGET', entityId: id,
      details: { category: budget.category }, ipAddress: req.ip
    });
    res.json({ success: true, message: 'Budget supprimé avec succès' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la suppression du budget');
  }
};
