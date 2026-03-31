// routes/budgetRoutes.js
const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes spécifiques
router.get('/stats', budgetController.getStats);
router.get('/month/:month', budgetController.getByMonth);

// Routes CRUD
router.route('/')
  .get(budgetController.getAll)
  .post(authorize('admin_principal', 'admin_finance'), budgetController.create);

router.route('/:id')
  .get(budgetController.getById)
  .put(authorize('admin_principal', 'admin_finance'), budgetController.update)
  .delete(authorize('admin_principal', 'admin_finance'), budgetController.delete);

// Route spécifique pour mettre à jour le réalisé
router.post('/:id/actual', authorize('admin_principal', 'admin_finance'), budgetController.updateActual);

module.exports = router;
