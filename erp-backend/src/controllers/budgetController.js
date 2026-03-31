// controllers/budgetController.js
const Budget = require('../models/Budget');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

/**
 * Formatter un budget pour le frontend
 */
const formatBudget = (budget) => ({
  id: budget._id,
  category: budget.category,
  budget: budget.budget,
  actual: budget.actual,
  month: budget.month,
  status: budget.status,
  notes: budget.notes,
  variance: budget.variance,
  variancePercentage: budget.variancePercentage,
  createdAt: budget.createdAt,
  updatedAt: budget.updatedAt
});

/**
 * Gérer les erreurs
 */
const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`❌ ${defaultMessage}:`, error);
  const message = process.env.NODE_ENV === 'production' ? defaultMessage : error.message;
  res.status(500).json({ message });
};

// ===== GET /api/budgets =====
exports.getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      month,
      status,
      category,
      sortBy = 'month',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (month) filter.month = month;
    if (status) filter.status = status;
    if (category) filter.category = { $regex: category, $options: 'i' };

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [budgets, total] = await Promise.all([
      Budget.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Budget.countDocuments(filter)
    ]);

    // Calculer les totaux pour la page
    const totals = budgets.reduce((acc, b) => ({
      totalBudget: acc.totalBudget + b.budget,
      totalActual: acc.totalActual + b.actual,
      totalVariance: acc.totalVariance + (b.variance || 0)
    }), { totalBudget: 0, totalActual: 0, totalVariance: 0 });

    res.json({
      success: true,
      data: budgets.map(formatBudget),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      totals
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des budgets');
  }
};

// ===== GET /api/budgets/:id =====
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID budget invalide' });
    }

    const budget = await Budget.findById(id).lean();
    if (!budget) {
      return res.status(404).json({ message: 'Budget non trouvé' });
    }

    res.json({
      success: true,
      data: formatBudget(budget)
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération du budget');
  }
};

// ===== POST /api/budgets =====
exports.create = async (req, res) => {
  try {
    const { category, budget, month, notes } = req.body;

    if (!category || !budget || !month) {
      return res.status(400).json({ 
        message: 'Catégorie, montant et mois sont requis' 
      });
    }

    // Vérifier si un budget existe déjà pour cette catégorie ce mois-ci
    const existing = await Budget.findOne({ category, month });
    if (existing) {
      return res.status(400).json({ 
        message: 'Un budget existe déjà pour cette catégorie ce mois-ci' 
      });
    }

    const newBudget = new Budget({
      category: category.trim(),
      budget: parseFloat(budget),
      month,
      notes: notes || '',
      actual: 0,
      createdBy: req.user._id
    });

    await newBudget.save();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE',
      entity: 'BUDGET',
      entityId: newBudget._id,
      details: { category: newBudget.category, month: newBudget.month, budget: newBudget.budget },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: formatBudget(newBudget),
      message: 'Budget créé avec succès'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Un budget existe déjà pour cette catégorie ce mois-ci' 
      });
    }
    handleError(error, res, 'Erreur lors de la création du budget');
  }
};

// ===== PUT /api/budgets/:id =====
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID budget invalide' });
    }

    const budget = await Budget.findById(id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget non trouvé' });
    }

    // Mettre à jour les champs autorisés
    const allowedUpdates = ['budget', 'notes'];
    const updatedFields = [];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        budget[field] = field === 'budget' ? parseFloat(updates[field]) : updates[field];
        updatedFields.push(field);
      }
    });

    if (updatedFields.length === 0) {
      return res.status(400).json({ message: 'Aucune modification détectée' });
    }

    budget.updatedBy = req.user._id;
    await budget.save();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE',
      entity: 'BUDGET',
      entityId: budget._id,
      details: { category: budget.category, month: budget.month, updatedFields },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: formatBudget(budget),
      message: 'Budget mis à jour avec succès'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la mise à jour du budget');
  }
};

// ===== DELETE /api/budgets/:id =====
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID budget invalide' });
    }

    const budget = await Budget.findById(id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget non trouvé' });
    }

    await budget.deleteOne();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE',
      entity: 'BUDGET',
      entityId: id,
      details: { category: budget.category, month: budget.month },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Budget supprimé avec succès'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la suppression du budget');
  }
};

// ===== GET /api/budgets/month/:month =====
exports.getByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    const budgets = await Budget.find({ month })
      .sort('category')
      .lean();

    const totals = budgets.reduce((acc, b) => ({
      totalBudget: acc.totalBudget + b.budget,
      totalActual: acc.totalActual + b.actual,
      totalVariance: acc.totalVariance + (b.variance || 0)
    }), { totalBudget: 0, totalActual: 0, totalVariance: 0 });

    res.json({
      success: true,
      data: budgets.map(formatBudget),
      totals
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des budgets du mois');
  }
};

// ===== GET /api/budgets/stats =====
exports.getStats = async (req, res) => {
  try {
    const { month } = req.query;

    const stats = await Budget.getStats(month);

    const monthlyTrend = await Budget.aggregate([
      {
        $group: {
          _id: '$month',
          totalBudget: { $sum: '$budget' },
          totalActual: { $sum: '$actual' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        current: stats,
        trend: monthlyTrend
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};

// ===== POST /api/budgets/:id/actual =====
exports.updateActual = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID budget invalide' });
    }

    if (!amount || amount === 0) {
      return res.status(400).json({ message: 'Montant requis' });
    }

    const budget = await Budget.findById(id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget non trouvé' });
    }

    await budget.updateActual(amount);

    res.json({
      success: true,
      data: formatBudget(budget),
      message: 'Réalisé mis à jour avec succès'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la mise à jour du réalisé');
  }
};