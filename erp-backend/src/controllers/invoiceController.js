// src/controllers/invoiceController.js
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const PDFGenerator = require('../services/pdfGenerator');
const { createNotification } = require('./notificationController');

// @desc    Créer une facture
// @route   POST /api/invoices
const createInvoice = async (req, res) => {
  try {
    const { customer, items, dueDate, notes } = req.body;

    // Vérifier que le client existe
    const customerExists = await Customer.findById(customer);
    if (!customerExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client non trouvé' 
      });
    }

    // Vérifier les stocks et préparer les items
    let subtotalHT = 0;
    let totalTax = 0;
    const invoiceItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: `Produit ${item.product} non trouvé` 
        });
      }

      // Vérifier le stock
      if (product.currentStock < item.quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Stock insuffisant pour ${product.name}. Disponible: ${product.currentStock}` 
        });
      }

      // Calculer les montants
      const itemHT = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      const itemTax = itemHT * ((item.taxRate || 20) / 100);
      
      subtotalHT += itemHT;
      totalTax += itemTax;

      invoiceItems.push({
        product: item.product,
        description: item.description || product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 20,
        discount: item.discount || 0,
        totalHT: itemHT,
        totalTTC: itemHT + itemTax
      });

      // Décrémenter le stock
      const stockBefore = product.currentStock;
      product.currentStock -= item.quantity;
      await product.save();

      // Créer mouvement de stock
      await StockMovement.create({
        product: product._id,
        type: 'sortie',
        quantity: item.quantity,
        reason: 'vente',
        reference: 'facture',
        stockBefore,
        stockAfter: product.currentStock,
        createdBy: req.user.id
      });

      // Vérifier stock faible
      if (product.isLowStock && product.isLowStock()) {
        await createNotification(
          req.user.id,
          'stock_faible',
          '⚠️ Stock faible',
          `Le produit "${product.name}" a un stock critique (${product.currentStock})`,
          { productId: product._id, stock: product.currentStock }
        );
      }
    }

    const totalTTC = subtotalHT + totalTax;

    // Créer la facture
    const invoice = await Invoice.create({
      customer,
      items: invoiceItems,
      dueDate,
      notes,
      subtotalHT,
      totalTax,
      totalTTC,
      amountDue: totalTTC,
      createdBy: req.user.id,
      status: 'brouillon'
    });

    // Peupler les données pour la réponse
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer', 'firstName lastName email phone')
      .populate('items.product', 'name sku')
      .populate('createdBy', 'firstName lastName');

    // Journaliser
    await AuditLog.create({
      user: req.user.id,
      action: 'CREATE',
      entity: 'INVOICE',
      entityId: invoice._id,
      details: { 
        invoiceNumber: invoice.invoiceNumber, 
        total: totalTTC,
        customerName: customerExists.firstName + ' ' + customerExists.lastName
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: populatedInvoice,
      message: 'Facture créée avec succès'
    });

  } catch (error) {
    console.error('Erreur création facture:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de la facture',
      error: error.message 
    });
  }
};

// @desc    Récupérer toutes les factures
// @route   GET /api/invoices
const getAllInvoices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      customerId,
      startDate, 
      endDate,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    let query = {};

    // Filtres
    if (status) query.status = status;
    if (customerId) query.customer = customerId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Restreindre selon le rôle
    if (req.user.role === 'admin_facture') {
      query.createdBy = req.user.id;
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const invoices = await Invoice.find(query)
      .populate('customer', 'firstName lastName email company')
      .populate('items.product', 'name sku')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Invoice.countDocuments(query);

    // Calculer les totaux pour les statistiques de la page
    const totals = await Invoice.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalHT: { $sum: '$subtotalHT' },
          totalTTC: { $sum: '$totalTTC' },
          totalPaid: { $sum: '$amountPaid' },
          totalDue: { $sum: '$amountDue' }
        }
      }
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      totals: totals[0] || { totalHT: 0, totalTTC: 0, totalPaid: 0, totalDue: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Récupérer une facture par ID
// @route   GET /api/invoices/:id
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('items.product')
      .populate('createdBy', 'firstName lastName email')
      .populate('validatedBy', 'firstName lastName');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    // Vérifier les droits d'accès
    if (req.user.role !== 'admin_principal' && 
        invoice.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé à consulter cette facture' 
      });
    }

    // Récupérer les paiements associés
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ invoice: invoice._id })
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      data: {
        ...invoice.toObject(),
        payments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mettre à jour une facture
// @route   PUT /api/invoices/:id
const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    // Vérifier les droits
    if (req.user.role !== 'admin_principal' && 
        invoice.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    // Ne pas modifier si déjà payée ou validée
    if (invoice.status === 'payée' || invoice.status === 'validée') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de modifier une facture payée ou validée' 
      });
    }

    // Mettre à jour les champs autorisés
    const { dueDate, notes, items } = req.body;
    
    if (dueDate) invoice.dueDate = dueDate;
    if (notes) invoice.notes = notes;
    if (items) {
      // Recalculer les totaux avec les nouveaux items
      invoice.items = items;
      await invoice.save(); // Le pre-save recalcule les totaux
    } else {
      await invoice.save();
    }

    await AuditLog.create({
      user: req.user.id,
      action: 'UPDATE',
      entity: 'INVOICE',
      entityId: invoice._id,
      details: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: req.ip
    });

    res.json({ success: true, data: invoice, message: 'Facture mise à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Supprimer une facture
// @route   DELETE /api/invoices/:id
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    // Vérifier les droits
    if (req.user.role !== 'admin_principal' && 
        invoice.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    // Vérifier si des paiements sont associés
    const Payment = require('../models/Payment');
    const paymentCount = await Payment.countDocuments({ invoice: invoice._id });
    
    if (paymentCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de supprimer: des paiements sont associés' 
      });
    }

    // Restaurer le stock si nécessaire
    if (invoice.status !== 'payée' && invoice.status !== 'validée') {
      for (const item of invoice.items) {
        if (item.product) {
          const product = await Product.findById(item.product);
          if (product) {
            product.currentStock += item.quantity;
            await product.save();
          }
        }
      }
    }

    await invoice.deleteOne();

    await AuditLog.create({
      user: req.user.id,
      action: 'DELETE',
      entity: 'INVOICE',
      entityId: req.params.id,
      details: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Facture supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Valider une facture
// @route   PATCH /api/invoices/:id/validate
const validateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    if (invoice.status !== 'brouillon') {
      return res.status(400).json({ 
        success: false, 
        message: 'Seules les factures en brouillon peuvent être validées' 
      });
    }

    invoice.status = 'envoyée';
    invoice.validatedBy = req.user.id;
    invoice.validatedAt = Date.now();
    await invoice.save();

    // Créer une écriture comptable
    const Account = require('../models/Account');
    const Transaction = require('../models/Transaction');

    // Compte client (411)
    const clientAccount = await Account.findOne({ code: '411' });
    // Compte ventes (707)
    const salesAccount = await Account.findOne({ code: '707' });
    // Compte TVA (445)
    const tvaAccount = await Account.findOne({ code: '445' });

    if (clientAccount && salesAccount) {
      const entries = [
        {
          account: clientAccount._id,
          debit: invoice.totalTTC,
          credit: 0,
          label: `Facture ${invoice.invoiceNumber}`
        },
        {
          account: salesAccount._id,
          debit: 0,
          credit: invoice.subtotalHT,
          label: `Ventes facture ${invoice.invoiceNumber}`
        }
      ];

      if (invoice.totalTax > 0 && tvaAccount) {
        entries.push({
          account: tvaAccount._id,
          debit: 0,
          credit: invoice.totalTax,
          label: `TVA facture ${invoice.invoiceNumber}`
        });
      }

      await Transaction.create({
        description: `Validation facture ${invoice.invoiceNumber}`,
        entries,
        totalDebit: invoice.totalTTC,
        totalCredit: invoice.totalTTC,
        reference: 'invoice',
        referenceId: invoice._id,
        referenceModel: 'Invoice',
        status: 'validé',
        createdBy: req.user.id,
        validatedBy: req.user.id,
        validatedAt: Date.now()
      });
    }

    await AuditLog.create({
      user: req.user.id,
      action: 'VALIDATE',
      entity: 'INVOICE',
      entityId: invoice._id,
      details: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: req.ip
    });

    // Notification au client (à implémenter avec email)
    await createNotification(
      req.user.id,
      'facture_emise',
      '📄 Nouvelle facture',
      `La facture ${invoice.invoiceNumber} a été émise`,
      { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber }
    );

    res.json({ success: true, data: invoice, message: 'Facture validée avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Marquer comme payée
// @route   PATCH /api/invoices/:id/pay
const markAsPaid = async (req, res) => {
  try {
    const { paymentMethod, amount, reference } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    if (invoice.status === 'payée') {
      return res.status(400).json({ success: false, message: 'Déjà payée' });
    }

    const paymentAmount = amount || invoice.amountDue;

    // Créer le paiement
    const Payment = require('../models/Payment');
    const payment = await Payment.create({
      invoice: invoice._id,
      customer: invoice.customer,
      amount: paymentAmount,
      method: paymentMethod,
      reference,
      status: 'validé',
      validatedBy: req.user.id,
      validatedAt: Date.now(),
      createdBy: req.user.id
    });

    // Mettre à jour la facture (le post-save de Payment le fera automatiquement)
    // Mais on recharge pour avoir les dernières données
    const updatedInvoice = await Invoice.findById(invoice._id);

    await AuditLog.create({
      user: req.user.id,
      action: 'UPDATE',
      entity: 'INVOICE',
      entityId: invoice._id,
      details: { 
        invoiceNumber: invoice.invoiceNumber, 
        action: 'payment',
        amount: paymentAmount 
      },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: updatedInvoice,
      payment,
      message: 'Paiement enregistré avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Télécharger PDF
// @route   GET /api/invoices/:id/pdf
const downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('items.product');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    const pdfBuffer = await PDFGenerator.generateInvoice(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=facture-${invoice.invoiceNumber}.pdf`
    );
    res.send(pdfBuffer);

    // Journaliser
    await AuditLog.create({
      user: req.user.id,
      action: 'EXPORT',
      entity: 'INVOICE',
      entityId: invoice._id,
      details: { invoiceNumber: invoice.invoiceNumber, format: 'pdf' },
      ipAddress: req.ip
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Statistiques des factures
// @route   GET /api/invoices/stats
const getInvoiceStats = async (req, res) => {
  try {
    let matchQuery = {};
    
    // Restreindre selon le rôle
    if (req.user.role === 'admin_facture') {
      matchQuery.createdBy = req.user._id;
    }

    const stats = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalHT: { $sum: '$subtotalHT' },
                totalTTC: { $sum: '$totalTTC' },
                totalPaid: { $sum: '$amountPaid' },
                totalDue: { $sum: '$amountDue' }
              }
            }
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                total: { $sum: '$totalTTC' }
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
                count: { $sum: 1 },
                total: { $sum: '$totalTTC' }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ],
          overdue: [
            {
              $match: {
                status: { $nin: ['payée', 'annulée'] },
                dueDate: { $lt: new Date() }
              }
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                total: { $sum: '$amountDue' }
              }
            }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0].overview[0] || {
          totalInvoices: 0,
          totalHT: 0,
          totalTTC: 0,
          totalPaid: 0,
          totalDue: 0
        },
        byStatus: stats[0].byStatus,
        monthly: stats[0].monthly,
        overdue: stats[0].overdue[0] || { count: 0, total: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Envoyer facture par email
// @route   POST /api/invoices/:id/email
const sendInvoiceEmail = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    if (!invoice.customer?.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le client n\'a pas d\'adresse email' 
      });
    }

    // Générer PDF
    const pdfBuffer = await PDFGenerator.generateInvoice(invoice);

    // Ici, vous intégreriez l'envoi d'email avec nodemailer
    console.log(`📧 Email envoyé à ${invoice.customer.email}`);
    console.log(`📎 Pièce jointe: facture-${invoice.invoiceNumber}.pdf`);

    // Mettre à jour le statut si nécessaire
    if (invoice.status === 'brouillon') {
      invoice.status = 'envoyée';
      await invoice.save();
    }

    await AuditLog.create({
      user: req.user.id,
      action: 'EXPORT',
      entity: 'INVOICE',
      entityId: invoice._id,
      details: { 
        invoiceNumber: invoice.invoiceNumber,
        action: 'email_sent',
        recipient: invoice.customer.email
      },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      message: `Facture envoyée à ${invoice.customer.email}` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Recherche avancée
// @route   GET /api/invoices/search
const searchInvoices = async (req, res) => {
  try {
    const {
      q,
      customerId,
      status,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    let query = {};

    // Recherche textuelle
    if (q) {
      query.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } }
      ];
    }

    if (customerId) query.customer = customerId;
    if (status) query.status = status;

    if (minAmount || maxAmount) {
      query.totalTTC = {};
      if (minAmount) query.totalTTC.$gte = parseFloat(minAmount);
      if (maxAmount) query.totalTTC.$lte = parseFloat(maxAmount);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query)
      .populate('customer', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Avoir sur facture
// @route   POST /api/invoices/:id/credit-note
const createCreditNote = async (req, res) => {
  try {
    const originalInvoice = await Invoice.findById(req.params.id);

    if (!originalInvoice) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }

    // Créer un avoir (facture négative)
    const creditNote = await Invoice.create({
      type: 'avoir',
      customer: originalInvoice.customer,
      date: new Date(),
      dueDate: new Date(),
      items: originalInvoice.items.map(item => ({
        ...item.toObject(),
        quantity: -item.quantity // Quantité négative
      })),
      notes: `Avoir pour la facture ${originalInvoice.invoiceNumber} - ${req.body.reason || ''}`,
      createdBy: req.user.id
    });

    // Restaurer le stock
    for (const item of originalInvoice.items) {
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product) {
          product.currentStock += item.quantity;
          await product.save();
        }
      }
    }

    await AuditLog.create({
      user: req.user.id,
      action: 'CREATE',
      entity: 'INVOICE',
      entityId: creditNote._id,
      details: { 
        invoiceNumber: creditNote.invoiceNumber,
        type: 'avoir',
        originalInvoice: originalInvoice.invoiceNumber
      },
      ipAddress: req.ip
    });

    res.status(201).json({ 
      success: true, 
      data: creditNote,
      message: 'Avoir créé avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UN SEUL export à la fin avec TOUTES les fonctions
module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  validateInvoice,
  markAsPaid,
  downloadInvoicePDF,
  getInvoiceStats,
  sendInvoiceEmail,
  searchInvoices,
  createCreditNote
};