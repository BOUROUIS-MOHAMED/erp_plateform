// src/controllers/paymentController.js
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('./notificationController');

// @desc    Créer un paiement
// @route   POST /api/payments
const createPayment = async (req, res) => {
  try {
    const { invoice, amount, method, reference, notes } = req.body;

    // Vérifier que la facture existe
    const invoiceExists = await Invoice.findById(invoice).populate('customer');
    if (!invoiceExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Facture non trouvée' 
      });
    }

    // Vérifier que le montant ne dépasse pas le dû
    if (amount > invoiceExists.amountDue) {
      return res.status(400).json({ 
        success: false, 
        message: `Le montant (${amount}) dépasse le dû (${invoiceExists.amountDue})` 
      });
    }

    // Générer le numéro de paiement
    const paymentNumber = await generatePaymentNumber();

    // Créer le paiement
    const payment = await Payment.create({
      paymentNumber,
      invoice,
      customer: invoiceExists.customer._id,
      amount,
      method,
      reference,
      notes,
      status: 'en_attente',
      createdBy: req.user.id
    });

    // Notification
    await createNotification(
      req.user.id,
      'paiement_recu',
      '💰 Paiement reçu',
      `Paiement de ${amount} TND reçu pour la facture ${invoiceExists.invoiceNumber}`,
      { 
        invoiceId: invoice, 
        invoiceNumber: invoiceExists.invoiceNumber,
        amount,
        paymentId: payment._id
      }
    );

    // Journaliser
    await AuditLog.create({
      user: req.user.id,
      action: 'CREATE',
      entity: 'PAYMENT',
      entityId: payment._id,
      details: { 
        paymentNumber: payment.paymentNumber,
        invoice: invoiceExists.invoiceNumber,
        amount 
      },
      ipAddress: req.ip
    });

    const populatedPayment = await Payment.findById(payment._id)
      .populate('invoice', 'invoiceNumber totalTTC')
      .populate('customer', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: populatedPayment,
      message: 'Paiement enregistré avec succès'
    });

  } catch (error) {
    console.error('Erreur création paiement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Récupérer tous les paiements
// @route   GET /api/payments
const getAllPayments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      method,
      status,
      customerId,
      startDate, 
      endDate,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    let query = {};

    if (method) query.method = method;
    if (status) query.status = status;
    if (customerId) query.customer = customerId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Restreindre selon le rôle
    if (req.user.role === 'admin_facture') {
      const invoices = await Invoice.find({ createdBy: req.user.id }).select('_id');
      query.invoice = { $in: invoices.map(inv => inv._id) };
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const payments = await Payment.find(query)
      .populate('invoice', 'invoiceNumber totalTTC')
      .populate('customer', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Payment.countDocuments(query);

    // Calculer les totaux
    const totals = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      totals: totals[0] || { totalAmount: 0, count: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Récupérer un paiement par ID
// @route   GET /api/payments/:id
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('invoice')
      .populate('customer')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement non trouvé' 
      });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mettre à jour un paiement
// @route   PUT /api/payments/:id
const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement non trouvé' 
      });
    }

    // Vérifier les droits
    if (req.user.role !== 'admin_principal') {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé' 
      });
    }

    // Ne pas modifier si déjà validé
    if (payment.status === 'validé') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de modifier un paiement validé' 
      });
    }

    const { method, reference, notes, status } = req.body;
    
    if (method) payment.method = method;
    if (reference) payment.reference = reference;
    if (notes) payment.notes = notes;
    if (status) payment.status = status;

    await payment.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'UPDATE',
      entity: 'PAYMENT',
      entityId: payment._id,
      details: { paymentNumber: payment.paymentNumber },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: payment, 
      message: 'Paiement mis à jour' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Supprimer un paiement
// @route   DELETE /api/payments/:id
const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement non trouvé' 
      });
    }

    // Vérifier les droits
    if (req.user.role !== 'admin_principal') {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé' 
      });
    }

    // Ne pas supprimer si déjà validé
    if (payment.status === 'validé') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de supprimer un paiement validé' 
      });
    }

    await payment.deleteOne();

    await AuditLog.create({
      user: req.user.id,
      action: 'DELETE',
      entity: 'PAYMENT',
      entityId: req.params.id,
      details: { paymentNumber: payment.paymentNumber },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      message: 'Paiement supprimé avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Valider un paiement
// @route   PATCH /api/payments/:id/validate
const validatePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement non trouvé' 
      });
    }

    if (payment.status !== 'en_attente') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce paiement ne peut pas être validé' 
      });
    }

    payment.status = 'validé';
    payment.validatedBy = req.user.id;
    payment.validatedAt = Date.now();
    await payment.save();

    // Mettre à jour la facture
    const invoice = await Invoice.findById(payment.invoice);
    if (invoice) {
      invoice.amountPaid += payment.amount;
      invoice.amountDue = invoice.totalTTC - invoice.amountPaid;
      
      if (invoice.amountDue <= 0) {
        invoice.status = 'payée';
        invoice.paidAt = new Date();
      } else if (invoice.amountPaid > 0) {
        invoice.status = 'partiellement_payée';
      }
      
      await invoice.save();
    }

    await AuditLog.create({
      user: req.user.id,
      action: 'VALIDATE',
      entity: 'PAYMENT',
      entityId: payment._id,
      details: { paymentNumber: payment.paymentNumber },
      ipAddress: req.ip
    });

    // Notification
    await createNotification(
      req.user.id,
      'paiement_valide',
      '✅ Paiement validé',
      `Le paiement ${payment.paymentNumber} a été validé`,
      { paymentId: payment._id, paymentNumber: payment.paymentNumber }
    );

    res.json({ 
      success: true, 
      data: payment, 
      message: 'Paiement validé avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Statistiques des paiements
// @route   GET /api/payments/stats
const getPaymentStats = async (req, res) => {
  try {
    let matchQuery = { status: 'validé' };
    
    if (req.user.role === 'admin_facture') {
      const invoices = await Invoice.find({ createdBy: req.user.id }).select('_id');
      matchQuery.invoice = { $in: invoices.map(inv => inv._id) };
    }

    const stats = await Payment.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            }
          ],
          byMethod: [
            {
              $group: {
                _id: '$method',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            }
          ],
          monthly: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0].overview[0] || { totalAmount: 0, count: 0 },
        byMethod: stats[0].byMethod || [],
        monthly: stats[0].monthly || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fonction utilitaire pour générer numéro de paiement
const generatePaymentNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const count = await Payment.countDocuments();
  return `PAY-${year}${month}-${String(count + 1).padStart(5, '0')}`;
};

// ✅ UN SEUL export à la fin avec TOUTES les fonctions
module.exports = {
  createPayment,
  getAllPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  validatePayment,
  getPaymentStats
};