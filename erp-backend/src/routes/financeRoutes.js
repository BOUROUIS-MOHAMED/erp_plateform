// financeRoutes.js - Version corrigée pour votre controller
const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Debug
console.log('🔍 financeController chargé avec:', Object.keys(financeController));

// Middleware d'authentification
router.use(protect);

// ===== TABLEAU DE BORD =====

// GET /api/finance/dashboard - Dashboard financier
router.get('/dashboard', 
  authorize('admin_principal', 'admin_finance'), 
  financeController.getFinanceDashboard  // ✓ OK
);

// GET /api/finance/stats - Statistiques financières
router.get('/stats', 
  authorize('admin_principal', 'admin_finance'), 
  financeController.getFinanceStats  // ✓ OK
);

// ===== EXPORTS =====

// GET /api/finance/export/excel - Export Excel
router.get('/export/excel', 
  authorize('admin_principal', 'admin_finance'), 
  financeController.exportFinanceExcel  // ✓ OK
);

// GET /api/finance/export/pdf - Export PDF
router.get('/export/pdf', 
  authorize('admin_principal', 'admin_finance'), 
  financeController.exportFinancePDF  // ✓ OK
);

// ===== NOTES =====
// Les routes suivantes nécessitent d'être implémentées dans le controller :
// - GET /transactions
// - GET /transactions/:id
// - POST /transactions
// - PUT /transactions/:id
// - DELETE /transactions/:id
// - GET /cashflow
// - GET /reports/profit-loss
// - GET /reports/balance

module.exports = router;