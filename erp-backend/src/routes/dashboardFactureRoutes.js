const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { 
  getFactureDashboard,
  getInvoiceStats 
} = require('../controllers/dashboardFactureController');

// Toutes les routes nécessitent authentification
router.use(protect);
router.use(authorize('admin_facture', 'admin_principal'));

// Routes
router.get('/', getFactureDashboard);
router.get('/stats', getInvoiceStats);

module.exports = router;