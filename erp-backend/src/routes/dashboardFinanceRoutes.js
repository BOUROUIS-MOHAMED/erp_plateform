const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getFinanceDashboard,
  exportFinanceExcel,
  exportFinancePDF,
  getGeneralLedger,
  getTrialBalance,
  getBalanceSheet,
  getIncomeStatement
} = require('../controllers/dashboardFinanceController');

// Toutes les routes nécessitent authentification
router.use(protect);
router.use(authorize('admin_principal', 'admin_finance'));

// Routes principales
router.get('/', getFinanceDashboard);
router.get('/general-ledger', getGeneralLedger);
router.get('/trial-balance', getTrialBalance);
router.get('/balance-sheet', getBalanceSheet);
router.get('/income-statement', getIncomeStatement);

// Routes d'export
router.get('/export/excel', exportFinanceExcel);
router.get('/export/pdf', exportFinancePDF);

module.exports = router;