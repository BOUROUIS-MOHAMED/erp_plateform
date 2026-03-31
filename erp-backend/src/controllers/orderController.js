// src/controllers/orderController.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('./notificationController');

// @desc    Créer une commande
// @route   POST /api/orders
const createOrder = async (req, res) => {
  try {
    const { type, customer, supplier, items, expectedDate, notes } = req.body;

    // Vérifier les stocks pour les ventes
    if (type === 'vente') {
      for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(404).json({ 
            success: false, 
            message: `Produit ${item.product} non trouvé` 
          });
        }
        if (product.currentStock < item.quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Stock insuffisant pour ${product.name}. Disponible: ${product.currentStock}` 
          });
        }
      }
    }

    // Vérifier l'existence du client ou fournisseur
    if (type === 'vente' && customer) {
      const customerExists = await Customer.findById(customer);
      if (!customerExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Client non trouvé' 
        });
      }
    }

    if (type === 'achat' && supplier) {
      const supplierExists = await Supplier.findById(supplier);
      if (!supplierExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fournisseur non trouvé' 
        });
      }
    }

    // Préparer les items avec calcul des totaux
    const orderItems = [];
    let subtotalHT = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      const itemTotal = item.quantity * item.unitPrice;
      subtotalHT += itemTotal;

      orderItems.push({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalHT: itemTotal,
        totalTTC: itemTotal * 1.2
      });
    }

    const tax = subtotalHT * 0.2;
    const totalTTC = subtotalHT + tax;

    // Créer la commande
    const order = await Order.create({
      type,
      orderNumber: await generateOrderNumber(type),
      customer: type === 'vente' ? customer : undefined,
      supplier: type === 'achat' ? supplier : undefined,
      items: orderItems,
      expectedDate,
      notes,
      subtotalHT,
      tax,
      totalTTC,
      createdBy: req.user.id
    });

    // Mettre à jour les stocks pour les ventes
    if (type === 'vente') {
      for (const item of items) {
        const product = await Product.findById(item.product);
        const stockBefore = product.currentStock;
        product.currentStock -= item.quantity;
        await product.save();

        await StockMovement.create({
          productId: product._id,
          product: product.name,
          type: 'sortie',
          quantity: item.quantity,
          reason: 'sale',
          reference: 'commande',
          referenceId: order._id,
          referenceModel: 'Order',
          stockBefore,
          stockAfter: product.currentStock,
          createdBy: req.user.id
        });

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
    }

    // Peupler les données
    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'firstName lastName email')
      .populate('supplier', 'name email')
      .populate('items.product', 'name sku')
      .populate('createdBy', 'firstName lastName');

    // Journaliser
    await AuditLog.create({
      user: req.user.id,
      action: 'CREATE',
      entity: 'ORDER',
      entityId: order._id,
      details: { orderNumber: order.orderNumber, type },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: populatedOrder,
      message: 'Commande créée avec succès'
    });

  } catch (error) {
    console.error('Erreur création commande:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Récupérer toutes les commandes
// @route   GET /api/orders
const getAllOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status, 
      startDate, 
      endDate,
      customer,
      supplier,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    let query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (customer) query.customer = customer;
    if (supplier) query.supplier = supplier;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Restreindre selon le rôle
    if (req.user.role === 'admin_facture') {
      query.type = 'vente';
      query.createdBy = req.user.id;
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const orders = await Order.find(query)
      .populate('customer', 'firstName lastName')
      .populate('supplier', 'name')
      .populate('items.product', 'name sku')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
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

// @desc    Récupérer une commande par ID
// @route   GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer')
      .populate('supplier')
      .populate('items.product')
      .populate('createdBy', 'firstName lastName')
      .populate('validatedBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Commande non trouvée' 
      });
    }

    // Vérifier les droits d'accès
    if (req.user.role === 'admin_facture' && 
        order.type === 'vente' && 
        order.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé à consulter cette commande' 
      });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mettre à jour une commande
// @route   PUT /api/orders/:id
const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Commande non trouvée' 
      });
    }

    // Vérifier les droits
    if (req.user.role !== 'admin_principal' && 
        order.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé' 
      });
    }

    if (order.status !== 'en_attente') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de modifier une commande non en attente' 
      });
    }

    // Mettre à jour les champs autorisés
    const { expectedDate, notes, items } = req.body;
    
    if (expectedDate) order.expectedDate = expectedDate;
    if (notes) order.notes = notes;
    
    if (items) {
      // Recalculer les totaux
      let subtotalHT = 0;
      const updatedItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(404).json({ 
            success: false, 
            message: `Produit ${item.product} non trouvé` 
          });
        }

        const itemTotal = item.quantity * item.unitPrice;
        subtotalHT += itemTotal;

        updatedItems.push({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalHT: itemTotal,
          totalTTC: itemTotal * 1.2
        });
      }

      order.items = updatedItems;
      order.subtotalHT = subtotalHT;
      order.tax = subtotalHT * 0.2;
      order.totalTTC = subtotalHT * 1.2;
    }

    await order.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'UPDATE',
      entity: 'ORDER',
      entityId: order._id,
      details: { orderNumber: order.orderNumber },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: order, 
      message: 'Commande mise à jour' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Supprimer une commande
// @route   DELETE /api/orders/:id
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Commande non trouvée' 
      });
    }

    // Vérifier les droits
    if (req.user.role !== 'admin_principal' && 
        order.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé' 
      });
    }

    if (order.status !== 'en_attente') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de supprimer une commande non en attente' 
      });
    }

    // Restaurer le stock si c'était une vente
    if (order.type === 'vente') {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          const stockBefore = product.currentStock;
          product.currentStock += item.quantity;
          await product.save();

          await StockMovement.create({
            productId: product._id,
            product: product.name,
            type: 'entrée',
            quantity: item.quantity,
            reason: 'adjustment',
            reference: 'commande_annulee',
            referenceId: order._id,
            referenceModel: 'Order',
            stockBefore,
            stockAfter: product.currentStock,
            createdBy: req.user.id
          });
        }
      }
    }

    await order.deleteOne();

    await AuditLog.create({
      user: req.user.id,
      action: 'DELETE',
      entity: 'ORDER',
      entityId: req.params.id,
      details: { orderNumber: order.orderNumber },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      message: 'Commande supprimée avec succès' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mettre à jour le statut
// @route   PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Commande non trouvée' 
      });
    }

    // Vérifier la transition valide
    const validTransitions = {
      'en_attente': ['confirmée', 'annulée'],
      'confirmée': ['préparée', 'annulée'],
      'préparée': ['expédiée', 'annulée'],
      'expédiée': ['livrée', 'annulée'],
      'livrée': [],
      'annulée': []
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Transition invalide de ${order.status} vers ${status}` 
      });
    }

    order.status = status;
    if (status === 'livrée' || status === 'confirmée') {
      order.validatedBy = req.user.id;
      order.validatedAt = Date.now();
    }

    await order.save();

    // Notification
    await createNotification(
      req.user.id,
      'commande_validee',
      '📦 Commande mise à jour',
      `La commande ${order.orderNumber} est maintenant ${status}`,
      { orderId: order._id, status }
    );

    await AuditLog.create({
      user: req.user.id,
      action: 'UPDATE',
      entity: 'ORDER',
      entityId: order._id,
      details: { orderNumber: order.orderNumber, newStatus: status },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: order, 
      message: `Statut mis à jour: ${status}` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Historique des commandes
// @route   GET /api/orders/history
const getOrderHistory = async (req, res) => {
  try {
    const { startDate, endDate, customerId, status, type } = req.query;

    let query = {};
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (customerId) query.customer = customerId;
    if (status) query.status = status;
    if (type) query.type = type;

    // Restreindre selon le rôle
    if (req.user.role === 'admin_facture') {
      query.type = 'vente';
      query.createdBy = req.user.id;
    }

    const orders = await Order.find(query)
      .populate('customer', 'firstName lastName')
      .populate('supplier', 'name')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      data: orders,
      count: orders.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Statistiques des commandes
// @route   GET /api/orders/stats
const getOrderStats = async (req, res) => {
  try {
    let matchQuery = {};
    
    // Restreindre selon le rôle
    if (req.user.role === 'admin_facture') {
      matchQuery.type = 'vente';
      matchQuery.createdBy = req.user._id;
    }

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalHT: { $sum: '$subtotalHT' },
                totalTTC: { $sum: '$totalTTC' }
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
          byType: [
            {
              $group: {
                _id: '$type',
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
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0].overview[0] || { 
          totalOrders: 0, 
          totalHT: 0, 
          totalTTC: 0 
        },
        byStatus: stats[0].byStatus || [],
        byType: stats[0].byType || [],
        monthly: stats[0].monthly || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Obtenir les commandes en attente
// @route   GET /api/orders/pending
const getPendingOrders = async (req, res) => {
  try {
    let query = { 
      status: { $in: ['en_attente', 'confirmée', 'préparée'] } 
    };

    if (req.user.role === 'admin_facture') {
      query.type = 'vente';
      query.createdBy = req.user.id;
    }

    const orders = await Order.find(query)
      .populate('customer', 'firstName lastName')
      .populate('supplier', 'name')
      .populate('items.product', 'name')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fonction utilitaire pour générer numéro de commande
const generateOrderNumber = async (type) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = type === 'vente' ? 'CMD' : 'ACH';
  const count = await Order.countDocuments();
  return `${prefix}-${year}${month}-${String(count + 1).padStart(5, '0')}`;
};

// ✅ UN SEUL export à la fin avec TOUTES les fonctions
module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  getOrderHistory,
  getOrderStats,
  getPendingOrders
};