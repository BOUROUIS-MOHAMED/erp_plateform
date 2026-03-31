const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const ExcelGenerator = require('../services/excelGenerator');
const PDFGenerator = require('../services/pdfGenerator');
const { createNotification } = require('./notificationController');

// @desc    Dashboard finance principal
// @route   GET /api/dashboard/finance
const getFinanceDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // 1. Trésorerie (comptes de banque et caisse)
    const cashAccounts = await Account.find({
      category: { $in: ['banque', 'caisse'] },
      isActive: true
    }).sort({ code: 1 });

    const tresorerie = {
      total: cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
      details: cashAccounts.map(acc => ({
        _id: acc._id,
        code: acc.code,
        name: acc.name,
        balance: acc.balance || 0,
        currency: acc.currency || 'TND'
      }))
    };

    // 2. Créances clients (factures impayées)
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

    // 3. Dettes fournisseurs (à partir des paiements)
    const dettes = await Payment.aggregate([
      { 
        $match: { 
          type: 'dépense',
          status: { $in: ['en_attente', 'validé'] }
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

    // 4. Chiffre d'affaires du mois
    const monthlyRevenue = await Invoice.aggregate([
      {
        $match: {
          status: 'payée',
          paidAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // 5. Évolution mensuelle (12 derniers mois)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyEvolution = await Invoice.aggregate([
      {
        $match: {
          status: 'payée',
          paidAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' }
          },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 6. Dernières transactions
    const recentTransactions = await Transaction.find({ status: 'validé' })
      .populate('entries.account', 'code name')
      .populate('createdBy', 'firstName lastName')
      .sort({ date: -1 })
      .limit(10);

    // 7. Derniers paiements
    const recentPayments = await Payment.find()
      .populate('account', 'code name')
      .populate('invoice', 'invoiceNumber')
      .populate('customer', 'name')
      .populate('supplier', 'name')
      .sort({ paymentDate: -1 })
      .limit(10);

    // 8. Balance par type de compte
    const balanceByType = await Account.aggregate([
      {
        $group: {
          _id: '$type',
          totalBalance: { $sum: '$balance' },
          count: { $sum: 1 }
        }
      }
    ]);

    // 9. Flux de trésorerie (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cashFlow = await Payment.aggregate([
      { 
        $match: { 
          paymentDate: { $gte: thirtyDaysAgo },
          status: 'validé'
        } 
      },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
            type: '$type'
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // 10. Alertes financières
    const alerts = [];

    // Alerte si trésorerie basse (< 1000 DT)
    if (tresorerie.total < 1000) {
      alerts.push({
        type: 'warning',
        message: 'Trésorerie basse',
        details: `Solde actuel: ${tresorerie.total.toFixed(3)} DT`
      });
    }

    // Alerte si créances élevées
    const creancesTotal = creances[0]?.total || 0;
    if (creancesTotal > 5000) {
      alerts.push({
        type: 'info',
        message: 'Créances clients élevées',
        details: `${creancesTotal.toFixed(3)} DT à recouvrer`
      });
    }

    res.json({
      success: true,
      data: {
        overview: {
          tresorerie,
          creances: {
            total: creances[0]?.total || 0,
            count: creances[0]?.count || 0,
            overdue: creances[0]?.overdue || 0
          },
          dettes: {
            total: dettes[0]?.total || 0,
            count: dettes[0]?.count || 0
          },
          revenue: {
            monthly: monthlyRevenue[0]?.total || 0,
            monthlyCount: monthlyRevenue[0]?.count || 0
          }
        },
        evolution: {
          monthly: monthlyEvolution,
          cashFlow
        },
        details: {
          recentTransactions,
          recentPayments,
          balanceByType
        },
        alerts,
        department: 'finance',
        adminName: `${req.user.firstName} ${req.user.lastName}`,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Erreur dashboard finance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Exporter rapport financier (Excel)
// @route   GET /api/finance/export/excel
const exportFinanceExcel = async (req, res) => {
  try {
    const { period = 'mensuel' } = req.query;
    
    // Récupérer les données
    const cashAccounts = await Account.find({
      category: { $in: ['banque', 'caisse'] },
      isActive: true
    });

    const creances = await Invoice.aggregate([
      { $match: { status: { $in: ['envoyée', 'en_retard'] } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    const recentTransactions = await Transaction.find({ status: 'validé' })
      .populate('entries.account', 'code name')
      .limit(100);

    const recentPayments = await Payment.find()
      .populate('account', 'code name')
      .limit(100);

    // Créer workbook Excel
    const workbook = new ExcelJS.Workbook();
    
    // Feuille 1: Trésorerie
    const sheet1 = workbook.addWorksheet('Trésorerie');
    sheet1.columns = [
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Compte', key: 'name', width: 30 },
      { header: 'Solde (DT)', key: 'balance', width: 15 }
    ];
    
    sheet1.getRow(1).font = { bold: true };
    sheet1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    cashAccounts.forEach(acc => {
      sheet1.addRow({
        code: acc.code,
        name: acc.name,
        balance: acc.balance.toFixed(3)
      });
    });

    // Ligne totale
    const totalRow = sheet1.addRow({
      code: 'TOTAL',
      name: '',
      balance: cashAccounts.reduce((sum, acc) => sum + acc.balance, 0).toFixed(3)
    });
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' }
    };

    // Feuille 2: Créances
    const sheet2 = workbook.addWorksheet('Créances');
    sheet2.addRow(['Total créances', (creances[0]?.total || 0).toFixed(3) + ' DT']);
    sheet2.addRow(['Nombre factures', creances[0]?.count || 0]);
    
    // Feuille 3: Transactions récentes
    const sheet3 = workbook.addWorksheet('Transactions');
    sheet3.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Débit', key: 'debit', width: 15 },
      { header: 'Crédit', key: 'credit', width: 15 }
    ];

    recentTransactions.forEach(trans => {
      const totalDebit = trans.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const totalCredit = trans.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
      
      sheet3.addRow({
        date: new Date(trans.date).toLocaleDateString(),
        description: trans.description,
        debit: totalDebit.toFixed(3),
        credit: totalCredit.toFixed(3)
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rapport-financier-${period}-${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur export Excel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur export Excel',
      error: error.message 
    });
  }
};

// @desc    Exporter rapport financier (PDF)
// @route   GET /api/finance/export/pdf
const exportFinancePDF = async (req, res) => {
  try {
    const { period = 'mensuel' } = req.query;
    
    // Récupérer les données
    const cashAccounts = await Account.find({
      category: { $in: ['banque', 'caisse'] },
      isActive: true
    });

    const creances = await Invoice.aggregate([
      { $match: { status: { $in: ['envoyée', 'en_retard'] } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    const monthlyRevenue = await Invoice.aggregate([
      { $match: { status: 'payée' } },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' }
          },
          total: { $sum: '$total' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    const data = {
      tresorerie: {
        total: cashAccounts.reduce((sum, acc) => sum + acc.balance, 0),
        details: cashAccounts.map(acc => ({
          code: acc.code,
          name: acc.name,
          balance: acc.balance
        }))
      },
      creances: creances[0] || { total: 0, count: 0 },
      chiffreAffairesMois: monthlyRevenue[0]?.total || 0,
      evolution: monthlyRevenue
    };

    const pdfBuffer = await PDFGenerator.generateFinancialReport(data, period);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapport-financier-${period}-${new Date().toISOString().split('T')[0]}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erreur export PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur export PDF',
      error: error.message 
    });
  }
};

// @desc    Obtenir le grand livre
// @route   GET /api/finance/general-ledger
const getGeneralLedger = async (req, res) => {
  try {
    const { startDate, endDate, accountId } = req.query;
    
    const matchStage = { status: 'validé' };
    
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const ledger = await Transaction.aggregate([
      { $match: matchStage },
      { $unwind: '$entries' },
      {
        $group: {
          _id: '$entries.account',
          totalDebit: { $sum: '$entries.debit' },
          totalCredit: { $sum: '$entries.credit' },
          transactions: { $push: {
            date: '$date',
            description: '$description',
            debit: '$entries.debit',
            credit: '$entries.credit',
            transactionNumber: '$transactionNumber'
          }}
        }
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: '_id',
          as: 'accountInfo'
        }
      },
      { $unwind: '$accountInfo' },
      { $sort: { 'accountInfo.code': 1 } }
    ]);

    res.json({
      success: true,
      data: ledger
    });

  } catch (error) {
    console.error('Erreur grand livre:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Obtenir la balance des comptes
// @route   GET /api/finance/trial-balance
const getTrialBalance = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();

    const accounts = await Account.find({ isActive: true }).sort({ code: 1 });
    
    const balance = [];

    for (const account of accounts) {
      const transactions = await Transaction.aggregate([
        {
          $match: {
            status: 'validé',
            date: { $lte: queryDate },
            'entries.account': account._id
          }
        },
        { $unwind: '$entries' },
        { $match: { 'entries.account': account._id } },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$entries.debit' },
            totalCredit: { $sum: '$entries.credit' }
          }
        }
      ]);

      const debit = transactions[0]?.totalDebit || 0;
      const credit = transactions[0]?.totalCredit || 0;
      const balanceAmount = debit - credit;

      balance.push({
        account: {
          _id: account._id,
          code: account.code,
          name: account.name,
          type: account.type
        },
        debit: debit,
        credit: credit,
        balance: balanceAmount
      });
    }

    const totals = balance.reduce((acc, item) => ({
      totalDebit: acc.totalDebit + item.debit,
      totalCredit: acc.totalCredit + item.credit,
      totalBalance: acc.totalBalance + item.balance
    }), { totalDebit: 0, totalCredit: 0, totalBalance: 0 });

    res.json({
      success: true,
      data: {
        accounts: balance,
        totals,
        asOf: queryDate
      }
    });

  } catch (error) {
    console.error('Erreur balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Obtenir le bilan comptable
// @route   GET /api/finance/balance-sheet
const getBalanceSheet = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();

    // Actifs (comptes de type 'actif')
    const assets = await Account.aggregate([
      { 
        $match: { 
          type: 'actif',
          isActive: true 
        } 
      },
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', 'validé'] },
                    { $lte: ['$date', queryDate] },
                    { $in: ['$$accountId', '$entries.account'] }
                  ]
                }
              }
            },
            { $unwind: '$entries' },
            { $match: { $expr: { $eq: ['$entries.account', '$$accountId'] } } },
            {
              $group: {
                _id: null,
                debit: { $sum: '$entries.debit' },
                credit: { $sum: '$entries.credit' }
              }
            }
          ],
          as: 'transactions'
        }
      },
      {
        $addFields: {
          balance: {
            $subtract: [
              { $ifNull: [{ $arrayElemAt: ['$transactions.debit', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$transactions.credit', 0] }, 0] }
            ]
          }
        }
      },
      { $match: { balance: { $ne: 0 } } },
      { $sort: { code: 1 } }
    ]);

    // Passifs (comptes de type 'passif')
    const liabilities = await Account.aggregate([
      { 
        $match: { 
          type: 'passif',
          isActive: true 
        } 
      },
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', 'validé'] },
                    { $lte: ['$date', queryDate] },
                    { $in: ['$$accountId', '$entries.account'] }
                  ]
                }
              }
            },
            { $unwind: '$entries' },
            { $match: { $expr: { $eq: ['$entries.account', '$$accountId'] } } },
            {
              $group: {
                _id: null,
                credit: { $sum: '$entries.credit' },
                debit: { $sum: '$entries.debit' }
              }
            }
          ],
          as: 'transactions'
        }
      },
      {
        $addFields: {
          balance: {
            $subtract: [
              { $ifNull: [{ $arrayElemAt: ['$transactions.credit', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$transactions.debit', 0] }, 0] }
            ]
          }
        }
      },
      { $match: { balance: { $ne: 0 } } },
      { $sort: { code: 1 } }
    ]);

    // Capitaux propres
    const equity = await Account.aggregate([
      { 
        $match: { 
          type: { $in: ['produit', 'charge'] },
          isActive: true 
        } 
      },
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', 'validé'] },
                    { $lte: ['$date', queryDate] },
                    { $in: ['$$accountId', '$entries.account'] }
                  ]
                }
              }
            },
            { $unwind: '$entries' },
            { $match: { $expr: { $eq: ['$entries.account', '$$accountId'] } } },
            {
              $group: {
                _id: null,
                credit: { $sum: '$entries.credit' },
                debit: { $sum: '$entries.debit' }
              }
            }
          ],
          as: 'transactions'
        }
      },
      {
        $addFields: {
          balance: {
            $subtract: [
              { $ifNull: [{ $arrayElemAt: ['$transactions.credit', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$transactions.debit', 0] }, 0] }
            ]
          }
        }
      },
      { $match: { balance: { $ne: 0 } } }
    ]);

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

    res.json({
      success: true,
      data: {
        assets: {
          items: assets,
          total: totalAssets
        },
        liabilities: {
          items: liabilities,
          total: totalLiabilities
        },
        equity: {
          items: equity,
          total: totalEquity
        },
        totalLiabilitiesEquity: totalLiabilities + totalEquity,
        asOf: queryDate
      }
    });

  } catch (error) {
    console.error('Erreur bilan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// @desc    Obtenir le compte de résultat
// @route   GET /api/finance/income-statement
const getIncomeStatement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Produits (comptes de type 'produit')
    const revenues = await Account.aggregate([
      { 
        $match: { 
          type: 'produit',
          isActive: true 
        } 
      },
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', 'validé'] },
                    { $gte: ['$date', start] },
                    { $lte: ['$date', end] },
                    { $in: ['$$accountId', '$entries.account'] }
                  ]
                }
              }
            },
            { $unwind: '$entries' },
            { $match: { $expr: { $eq: ['$entries.account', '$$accountId'] } } },
            {
              $group: {
                _id: null,
                credit: { $sum: '$entries.credit' },
                debit: { $sum: '$entries.debit' }
              }
            }
          ],
          as: 'transactions'
        }
      },
      {
        $addFields: {
          amount: {
            $subtract: [
              { $ifNull: [{ $arrayElemAt: ['$transactions.credit', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$transactions.debit', 0] }, 0] }
            ]
          }
        }
      },
      { $match: { amount: { $ne: 0 } } },
      { $sort: { code: 1 } }
    ]);

    // Charges (comptes de type 'charge')
    const expenses = await Account.aggregate([
      { 
        $match: { 
          type: 'charge',
          isActive: true 
        } 
      },
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', 'validé'] },
                    { $gte: ['$date', start] },
                    { $lte: ['$date', end] },
                    { $in: ['$$accountId', '$entries.account'] }
                  ]
                }
              }
            },
            { $unwind: '$entries' },
            { $match: { $expr: { $eq: ['$entries.account', '$$accountId'] } } },
            {
              $group: {
                _id: null,
                debit: { $sum: '$entries.debit' },
                credit: { $sum: '$entries.credit' }
              }
            }
          ],
          as: 'transactions'
        }
      },
      {
        $addFields: {
          amount: {
            $subtract: [
              { $ifNull: [{ $arrayElemAt: ['$transactions.debit', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$transactions.credit', 0] }, 0] }
            ]
          }
        }
      },
      { $match: { amount: { $ne: 0 } } },
      { $sort: { code: 1 } }
    ]);

    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        revenues: {
          items: revenues,
          total: totalRevenue
        },
        expenses: {
          items: expenses,
          total: totalExpenses
        },
        netIncome,
        period: {
          start,
          end
        }
      }
    });

  } catch (error) {
    console.error('Erreur compte résultat:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

module.exports = {
  getFinanceDashboard,
  exportFinanceExcel,
  exportFinancePDF,
  getGeneralLedger,
  getTrialBalance,
  getBalanceSheet,
  getIncomeStatement
};