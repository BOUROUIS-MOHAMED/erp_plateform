const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getStockDashboard,
  getMovements,
  getLowStock
} = require('../controllers/dashboardStockController');

// Toutes les routes nécessitent authentification
router.use(protect);
router.use(authorize('admin_stock', 'admin_principal'));

// Routes
router.get('/', getStockDashboard);
router.get('/movements', getMovements);
router.get('/low-stock', getLowStock);

module.exports = router;