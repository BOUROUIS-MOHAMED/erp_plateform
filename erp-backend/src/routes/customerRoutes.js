// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,  // ← Présent dans le controller
  getCustomerStats       // ← Présent dans le controller
} = require('../controllers/customerController');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes spécifiques (AVANT /:id)
router.get('/stats', getCustomerStats);
router.patch('/:id/toggle', authorize('admin_principal'), toggleCustomerStatus);

// Routes pour les commandes du client (via orderController)
// Note: Ces routes sont généralement dans orderRoutes.js
// GET /api/orders?customer=:customerId

// Routes principales
router.route('/')
  .get(authorize('admin_principal', 'admin_facture', 'admin_finance'), getAllCustomers)
  .post(authorize('admin_principal', 'admin_facture'), createCustomer);

router.route('/:id')
  .get(getCustomerById)
  .put(authorize('admin_principal', 'admin_facture'), updateCustomer)
  .delete(authorize('admin_principal', 'admin_facture'), deleteCustomer);

module.exports = router;
