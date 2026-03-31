// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes publiques (lecture pour tous les utilisateurs authentifiés)
router.get('/', reportController.getAll);
router.get('/stats', authorize('admin_principal'), reportController.getStats);
router.get('/type/:type', reportController.getByType);
router.get('/:id', reportController.getById);

// Routes d'écriture
router.post('/', authorize('admin_facture', 'admin_finance', 'admin_stock', 'admin_principal'), reportController.create);
router.put('/:id', authorize('admin_facture', 'admin_finance', 'admin_stock', 'admin_principal'), reportController.update);
router.delete('/:id', authorize('admin_facture', 'admin_finance', 'admin_stock', 'admin_principal'), reportController.delete);

// Routes d'export
router.get('/:id/pdf', authorize('admin_facture', 'admin_finance', 'admin_stock', 'admin_principal'), reportController.generatePdf);
router.get('/:id/excel', authorize('admin_facture', 'admin_finance', 'admin_stock', 'admin_principal'), reportController.generateExcel);

module.exports = router;
