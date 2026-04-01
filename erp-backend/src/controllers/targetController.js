// controllers/targetController.js
const mongoose = require('mongoose');
const Target = require('../models/Target');
const AuditLog = require('../models/AuditLog');

const formatTarget = (target) => ({
  id: target._id,
  category: target.category,
  amount: target.amount,
  realisedAmount: target.realisedAmount || 0,
  progression: target.amount > 0
    ? Math.min((target.realisedAmount / target.amount) * 100, 100)
    : 0,
  status: target.status,
  startDate: target.startDate,
  endDate: target.endDate,
  notes: target.notes,
  createdAt: target.createdAt,
  updatedAt: target.updatedAt
});

const handleError = (error, res, msg = 'Erreur serveur') => {
  console.error(msg, error);
  res.status(500).json({ message: process.env.NODE_ENV === 'production' ? msg : error.message });
};

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = { $regex: category, $options: 'i' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [targets, total] = await Promise.all([
      Target.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Target.countDocuments(filter)
    ]);
    res.json({ success: true, data: targets.map(formatTarget), pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des objectifs');
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const target = await Target.findById(id).lean();
    if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
    res.json({ success: true, data: formatTarget(target) });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération de l\'objectif');
  }
};

exports.create = async (req, res) => {
  try {
    const { category, amount, realisedAmount, startDate, endDate, notes } = req.body;
    if (!category || amount === undefined || !startDate || !endDate) {
      return res.status(400).json({ message: 'Catégorie, objectif, date début et date fin sont requis' });
    }
    const target = new Target({
      category,
      amount: parseFloat(amount),
      realisedAmount: parseFloat(realisedAmount) || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || '',
      createdBy: req.user._id
    });
    await target.save();
    await AuditLog.create({
      user: req.user._id, action: 'CREATE', entity: 'TARGET',
      entityId: target._id,
      details: { category: target.category, amount: target.amount },
      ipAddress: req.ip
    });
    res.status(201).json({ success: true, data: formatTarget(target), message: 'Objectif créé avec succès' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la création de l\'objectif');
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const target = await Target.findById(id);
    if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });

    const { category, amount, realisedAmount, startDate, endDate, notes, status } = req.body;
    if (category !== undefined) target.category = category;
    if (amount !== undefined) target.amount = parseFloat(amount);
    if (realisedAmount !== undefined) target.realisedAmount = parseFloat(realisedAmount);
    if (startDate) {
      target.startDate = new Date(startDate);
    } else if (!target.startDate) {
      return res.status(400).json({ message: 'La date de début est requise' });
    }
    if (endDate) {
      target.endDate = new Date(endDate);
    } else if (!target.endDate) {
      return res.status(400).json({ message: 'La date de fin est requise' });
    }
    if (notes !== undefined) target.notes = notes;
    if (status === 'desactivated') target.status = 'desactivated';
    else if (target.status === 'desactivated' && status !== undefined) target.status = status;

    target.updatedBy = req.user._id;
    await target.save();
    await AuditLog.create({
      user: req.user._id, action: 'UPDATE', entity: 'TARGET', entityId: target._id,
      details: { category: target.category }, ipAddress: req.ip
    });
    res.json({ success: true, data: formatTarget(target), message: 'Objectif modifié' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la modification de l\'objectif');
  }
};

exports.updateRealised = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const target = await Target.findById(id);
    if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
    const { realisedAmount } = req.body;
    if (realisedAmount === undefined) return res.status(400).json({ message: 'realisedAmount requis' });
    target.realisedAmount = parseFloat(realisedAmount);
    target.updatedBy = req.user._id;
    await target.save();
    res.json({ success: true, data: formatTarget(target) });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la mise à jour du réalisé');
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID invalide' });
    const target = await Target.findById(id);
    if (!target) return res.status(404).json({ message: 'Objectif non trouvé' });
    await target.deleteOne();
    await AuditLog.create({
      user: req.user._id, action: 'DELETE', entity: 'TARGET', entityId: id,
      details: { category: target.category }, ipAddress: req.ip
    });
    res.json({ success: true, message: 'Objectif supprimé avec succès' });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la suppression de l\'objectif');
  }
};
