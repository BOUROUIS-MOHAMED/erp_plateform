// controllers/reportController.js
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const { generatePDF } = require('../services/pdfGenerator');
const { generateExcel } = require('../services/excelGenerator');
const mongoose = require('mongoose');

/**
 * Formatter un rapport pour le frontend
 */
const formatReport = (report) => ({
  id: report._id,
  title: report.title,
  description: report.description,
  type: report.type,
  format: report.format,
  date: report.date.toISOString().split('T')[0],
  author: report.author,
  fileUrl: report.fileUrl,
  fileSize: report.fileSize,
  generatedAt: report.generatedAt,
  parameters: report.parameters,
  tags: report.tags,
  createdAt: report.createdAt
});

/**
 * Gérer les erreurs de manière sécurisée
 */
const handleError = (error, res, defaultMessage = 'Erreur serveur') => {
  console.error(`❌ ${defaultMessage}:`, error);
  const message = process.env.NODE_ENV === 'production' 
    ? defaultMessage 
    : error.message;
  res.status(500).json({ message });
};

// ===== GET /api/reports =====
exports.getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Construire le filtre
    const filter = {};
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Restreindre selon le rôle
    if (req.user.role !== 'admin_principal') {
      filter.$or = [
        { createdBy: req.user._id },
        { isPublic: true }
      ];
    }

    // Construire le tri
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Exécuter en parallèle
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: reports.map(formatReport),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des rapports');
  }
};

// ===== GET /api/reports/:id =====
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID rapport invalide' });
    }

    const report = await Report.findById(id).lean();

    if (!report) {
      return res.status(404).json({ message: 'Rapport non trouvé' });
    }

    // Vérifier les droits d'accès
    if (!report.isPublic && 
        report.createdBy?.toString() !== req.user._id?.toString() && 
        req.user.role !== 'admin_principal') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    res.json({
      success: true,
      data: formatReport(report)
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération du rapport');
  }
};

// ===== POST /api/reports =====
exports.create = async (req, res) => {
  try {
    const { title, description, type, parameters, tags } = req.body;

    if (!title || !description) {
      return res.status(400).json({ 
        message: 'Titre et description requis' 
      });
    }

    const report = new Report({
      title: title.trim(),
      description: description.trim(),
      type: type || 'analytique',
      parameters: parameters || {},
      tags: tags || [],
      author: `${req.user.firstName} ${req.user.lastName}`,
      createdBy: req.user._id,
      date: new Date()
    });

    await report.save();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE',
      entity: 'REPORT',
      entityId: report._id,
      details: { title: report.title, type: report.type },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: formatReport(report),
      message: 'Rapport créé avec succès'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Erreur de validation', 
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    handleError(error, res, 'Erreur lors de la création du rapport');
  }
};

// ===== PUT /api/reports/:id =====
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID rapport invalide' });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ message: 'Rapport non trouvé' });
    }

    // Vérifier les droits
    if (report.createdBy?.toString() !== req.user._id?.toString() && 
        req.user.role !== 'admin_principal') {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    // Mettre à jour les champs autorisés
    const allowedUpdates = ['title', 'description', 'type', 'tags', 'isPublic'];
    const updatedFields = [];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        report[field] = field === 'title' || field === 'description' 
          ? updates[field].trim() 
          : updates[field];
        updatedFields.push(field);
      }
    });

    if (updatedFields.length === 0) {
      return res.status(400).json({ message: 'Aucune modification détectée' });
    }

    await report.save();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE',
      entity: 'REPORT',
      entityId: report._id,
      details: { updatedFields },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: formatReport(report),
      message: 'Rapport mis à jour avec succès'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la mise à jour du rapport');
  }
};

// ===== DELETE /api/reports/:id =====
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID rapport invalide' });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ message: 'Rapport non trouvé' });
    }

    // Vérifier les droits (seul admin_principal peut supprimer)
    if (req.user.role !== 'admin_principal') {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    await report.deleteOne();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE',
      entity: 'REPORT',
      entityId: id,
      details: { title: report.title },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Rapport supprimé avec succès'
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la suppression du rapport');
  }
};

// ===== GET /api/reports/type/:type =====
exports.getByType = async (req, res) => {
  try {
    const { type } = req.params;

    const reports = await Report.find({ type })
      .sort('-date')
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: reports.map(formatReport)
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des rapports par type');
  }
};

// ===== GET /api/reports/:id/pdf =====
exports.generatePdf = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Rapport non trouvé' });
    }

    // Générer le PDF
    const pdfBuffer = await generatePDF(report);
    
    // Mettre à jour le rapport
    await report.markAsGenerated(`/reports/pdf/${id}`, pdfBuffer.length);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapport-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    handleError(error, res, 'Erreur lors de la génération du PDF');
  }
};

// ===== GET /api/reports/:id/excel =====
exports.generateExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Rapport non trouvé' });
    }

    // Générer le fichier Excel
    const excelBuffer = await generateExcel(report);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rapport-${id}.xlsx`);
    res.send(excelBuffer);
  } catch (error) {
    handleError(error, res, 'Erreur lors de la génération du fichier Excel');
  }
};

// ===== GET /api/reports/stats =====
exports.getStats = async (req, res) => {
  try {
    const stats = await Report.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          lastGenerated: { $max: '$generatedAt' }
        }
      }
    ]);

    const total = await Report.countDocuments();

    res.json({
      success: true,
      data: {
        byType: stats,
        total
      }
    });
  } catch (error) {
    handleError(error, res, 'Erreur lors de la récupération des statistiques');
  }
};
