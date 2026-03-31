// routes/accountRoutes.js - Version CORRECTE pour les COMPTES BANCAIRES
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getAll,
  getById,
  create,
  update,
  delete: deleteAccount,
  getBalance,
  getTransactions,
  getStats,
  updateBalance
} = require('../controllers/accountController');

// Toutes les routes nécessitent authentification
router.use(protect);

// Routes spécifiques (AVANT /:id)
router.get('/stats', authorize('admin_principal', 'admin_finance'), getStats);
router.get('/:id/balance', getBalance);
router.get('/:id/transactions', getTransactions);
router.patch('/:id/balance', authorize('admin_principal', 'admin_finance'), updateBalance);

// Routes CRUD principales
router.route('/')
  .get(authorize('admin_principal', 'admin_finance'), getAll)
  .post(authorize('admin_principal', 'admin_finance'), create);

router.route('/:id')
  .get(getById)
  .put(authorize('admin_principal', 'admin_finance'), update)
  .delete(authorize('admin_principal', 'admin_finance'), deleteAccount);

module.exports = router;
