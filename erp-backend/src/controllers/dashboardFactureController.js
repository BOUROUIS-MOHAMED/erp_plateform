// src/controllers/dashboardFactureController.js
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

// @desc    Dashboard facturation
// @route   GET /api/dashboard/facture
const getFactureDashboard = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Statistiques générales
    const stats = await Invoice.aggregate([
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalRevenue: { $sum: '$totalTTC' },
                totalPaid: { $sum: '$amountPaid' },
                totalDue: { $sum: '$amountDue' }
              }
            }
          ],
          monthlyStats: [
            { $match: { date: { $gte: startOfMonth } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: '$totalTTC' },
                paid: { $sum: '$amountPaid' }
              }
            }
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                amount: { $sum: '$totalTTC' }
              }
            }
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
                amount: { $sum: '$amountDue' }
              }
            }
          ]
        }
      }
    ]);

    // Factures récentes
    const recentInvoices = await Invoice.find()
      .populate('customer', 'firstName lastName company')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('invoiceNumber date totalTTC status dueDate');

    // Top clients
    const topClients = await Invoice.aggregate([
      { $match: { status: 'payée' } },
      {
        $group: {
          _id: '$customer',
          totalSpent: { $sum: '$totalTTC' },
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
          as: 'customer'
        }
      },
      { $unwind: '$customer' }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalInvoices: stats[0].overview[0]?.totalInvoices || 0,
          totalRevenue: stats[0].overview[0]?.totalRevenue || 0,
          totalPaid: stats[0].overview[0]?.totalPaid || 0,
          totalDue: stats[0].overview[0]?.totalDue || 0,
          monthlyInvoices: stats[0].monthlyStats[0]?.count || 0,
          monthlyRevenue: stats[0].monthlyStats[0]?.amount || 0,
          monthlyPaid: stats[0].monthlyStats[0]?.paid || 0,
          byStatus: stats[0].byStatus,
          overdue: {
            count: stats[0].overdue[0]?.count || 0,
            amount: stats[0].overdue[0]?.amount || 0
          }
        },
        recentInvoices,
        topClients,
        department: 'facturation',
        adminName: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Admin'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Statistiques factures
// @route   GET /api/dashboard/facture/stats
const getInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalTTC' },
          avgAmount: { $avg: '$totalTTC' },
          maxAmount: { $max: '$totalTTC' },
          minAmount: { $min: '$totalTTC' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalAmount: 0,
        avgAmount: 0,
        maxAmount: 0,
        minAmount: 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getFactureDashboard,
  getInvoiceStats
};