const User = require('../models/User');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');
const StockMovement = require('../models/StockMovement');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

// @desc    Dashboard principal (vue globale pour admin principal)
// @route   GET /api/dashboard/principal
const getPrincipalDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ==================== STATS UTILISATEURS ====================
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Utilisateurs par département
    const usersByDepartment = await User.aggregate([
      { $match: { department: { $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    // Dernières connexions
    const recentLogins = await User.find({ lastLogin: { $ne: null } })
      .select('firstName lastName email lastLogin role')
      .sort({ lastLogin: -1 })
      .limit(5);

    // ==================== STATS FACTURATION ====================
    const invoiceStats = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'payée'] }, '$total', 0] } },
          unpaidAmount: { $sum: { $cond: [{ $ne: ['$status', 'payée'] }, '$total', 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'payée'] }, 1, 0] } },
          overdueCount: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $ne: ['$status', 'payée'] },
                    { $lt: ['$dueDate', new Date()] }
                  ]
                }, 
                1, 
                0
              ]
            }
          }
        }
      }
    ]);

    // Factures du mois
    const monthlyInvoices = await Invoice.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      }
    ]);

    // Évolution mensuelle des factures (12 mois)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const invoiceEvolution = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top clients
    const topClients = await Invoice.aggregate([
      {
        $group: {
          _id: '$customer',
          totalSpent: { $sum: '$total' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customerInfo'
        }
      }
    ]);

    // ==================== STATS STOCK ====================
    const stockStats = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
          totalSellingValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          totalItems: { $sum: '$currentStock' },
          lowStock: { 
            $sum: { $cond: [{ $lt: ['$currentStock', '$alertThreshold'] }, 1, 0] } 
          },
          outOfStock: { 
            $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] } 
          }
        }
      }
    ]);

    // Produits par catégorie
    const productsByCategory = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Produits en stock faible (détail)
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$currentStock', '$alertThreshold'] }
    })
    .populate('supplier', 'name phone')
    .limit(10);

    // Mouvements de stock récents
    const recentStockMovements = await StockMovement.find()
      .populate('product', 'name sku')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    // Top produits vendus
    const topProducts = await StockMovement.aggregate([
      { $match: { type: 'sortie', reason: 'vente' } },
      {
        $group: {
          _id: '$product',
          totalSold: { $sum: '$quantity' },
          lastMovement: { $max: '$createdAt' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      }
    ]);

    // ==================== STATS FINANCE ====================
    // Trésorerie (comptes banque et caisse)
    const cashAccounts = await Account.find({
      category: { $in: ['banque', 'caisse'] },
      isActive: true
    }).sort({ code: 1 });

    const tresorerie = {
      total: cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
      details: cashAccounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        balance: acc.balance || 0
      }))
    };

    // Créances clients
    const creances = await Invoice.aggregate([
      { $match: { status: { $in: ['envoyée', 'en_retard'] } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 },
          overdue: {
            $sum: { 
              $cond: [
                { $lt: ['$dueDate', new Date()] },
                '$total',
                0
              ]
            }
          }
        }
      }
    ]);

    // Dettes fournisseurs (simplifié - à partir des paiements en attente)
    const dettes = await Payment.aggregate([
      { 
        $match: { 
          type: 'dépense',
          status: { $in: ['en_attente'] }
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Transactions récentes
    const recentTransactions = await Transaction.find({ status: 'validé' })
      .populate('entries.account', 'code name')
      .populate('createdBy', 'firstName lastName')
      .sort({ date: -1 })
      .limit(10);

    // Paiements récents
    const recentPayments = await Payment.find()
      .populate('account', 'code name')
      .populate('invoice', 'invoiceNumber')
      .populate('customer', 'name')
      .populate('supplier', 'name')
      .sort({ paymentDate: -1 })
      .limit(10);

    // Balance par type de compte
    const balanceByType = await Account.aggregate([
      {
        $group: {
          _id: '$type',
          totalBalance: { $sum: '$balance' },
          count: { $sum: 1 }
        }
      }
    ]);

    // ==================== STATS GÉNÉRALES ====================
    const totalCustomers = await Customer.countDocuments({ isActive: true });
    const totalSuppliers = await Supplier.countDocuments({ isActive: true });

    // Activité récente (audit log)
    const recentActivity = await AuditLog.find()
      .populate('user', 'firstName lastName email role')
      .sort({ timestamp: -1 })
      .limit(15);

    // ==================== ALERTES ====================
    const alerts = [];

    // Alerte stock faible
    if (stockStats[0]?.lowStock > 0) {
      alerts.push({
        type: 'warning',
        department: 'stock',
        message: `${stockStats[0].lowStock} produit(s) en stock faible`,
        details: 'Consultez la section stock pour plus de détails'
      });
    }

    // Alerte créances élevées
    const creancesTotal = creances[0]?.total || 0;
    if (creancesTotal > 10000) {
      alerts.push({
        type: 'info',
        department: 'facturation',
        message: `Créances élevées : ${creancesTotal.toFixed(3)} DT`,
        details: `${creances[0]?.count || 0} factures impayées`
      });
    }

    // Alerte trésorerie basse
    if (tresorerie.total < 5000) {
      alerts.push({
        type: 'danger',
        department: 'finance',
        message: `Trésorerie basse : ${tresorerie.total.toFixed(3)} DT`,
        details: 'Risque de liquidité'
      });
    }

    // Alerte nouveaux utilisateurs
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    if (newUsersThisMonth > 0) {
      alerts.push({
        type: 'success',
        department: 'admin',
        message: `${newUsersThisMonth} nouvel(aux) utilisateur(s) ce mois`,
        details: 'Utilisateurs ajoutés récemment'
      });
    }

    // ==================== RÉPONSE FINALE ====================
    res.json({
      success: true,
      data: {
        overview: {
          users: {
            total: totalUsers,
            active: activeUsers,
            newThisMonth: newUsersThisMonth,
            byRole: usersByRole,
            byDepartment: usersByDepartment,
            recentLogins
          },
          customers: totalCustomers,
          suppliers: totalSuppliers,
          alerts: alerts
        },
        facturation: {
          stats: invoiceStats[0] || {
            totalInvoices: 0,
            totalRevenue: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            paidCount: 0,
            overdueCount: 0
          },
          monthly: {
            count: monthlyInvoices[0]?.count || 0,
            total: monthlyInvoices[0]?.total || 0
          },
          evolution: invoiceEvolution,
          topClients
        },
        stock: {
          overview: stockStats[0] || {
            totalProducts: 0,
            totalValue: 0,
            totalSellingValue: 0,
            totalItems: 0,
            lowStock: 0,
            outOfStock: 0
          },
          byCategory: productsByCategory,
          lowStockProducts,
          recentMovements: recentStockMovements,
          topProducts
        },
        finance: {
          tresorerie,
          creances: creances[0] || { total: 0, count: 0, overdue: 0 },
          dettes: dettes[0] || { total: 0, count: 0 },
          balanceByType,
          recentTransactions,
          recentPayments
        },
        activity: {
          recent: recentActivity
        },
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Erreur dashboard principal:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Récupérer tous les utilisateurs (pour admin principal)
// @route   GET /api/dashboard/principal/users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, department, isActive } = req.query;
    const query = {};

    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Créer un utilisateur (admin principal seulement)
// @route   POST /api/dashboard/principal/users
const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, department } = req.body;

    // Vérifier si l'email existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email déjà utilisé' 
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      department
    });

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Mettre à jour un utilisateur
// @route   PUT /api/dashboard/principal/users/:id
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Sauvegarder l'ancien état pour le log
    const oldData = {
      role: user.role,
      isActive: user.isActive,
      department: user.department
    };

    // Mise à jour
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role;
    user.department = req.body.department || user.department;
    user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

    if (req.body.password) {
      user.password = req.body.password;
    }

    await user.save();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE',
      entity: 'USER',
      entityId: user._id,
      details: { old: oldData, new: { role: user.role, isActive: user.isActive } },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Supprimer un utilisateur (soft delete)
// @route   DELETE /api/dashboard/principal/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Empêcher la suppression de soi-même
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas supprimer votre propre compte' 
      });
    }

    // Soft delete (désactiver plutôt que supprimer)
    user.isActive = false;
    await user.save();

    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Utilisateur désactivé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Récupérer le journal d'audit
// @route   GET /api/dashboard/principal/audit
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, user, action, entity, startDate, endDate } = req.query;
    const query = {};

    if (user) query.user = user;
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    // Statistiques des actions
    const actionStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        logs,
        stats: actionStats
      },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Erreur récupération audit:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Récupérer les statistiques globales (version simplifiée)
// @route   GET /api/dashboard/principal/stats
const getGlobalStats = async (req, res) => {
  try {
    const [
      userCount,
      productCount,
      invoiceCount,
      customerCount,
      supplierCount,
      totalRevenue
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true }),
      Invoice.countDocuments(),
      Customer.countDocuments({ isActive: true }),
      Supplier.countDocuments({ isActive: true }),
      Invoice.aggregate([
        { $match: { status: 'payée' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        users: userCount,
        products: productCount,
        invoices: invoiceCount,
        customers: customerCount,
        suppliers: supplierCount,
        revenue: totalRevenue[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Erreur stats globales:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

module.exports = {
  getPrincipalDashboard,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAuditLogs,
  getGlobalStats
};