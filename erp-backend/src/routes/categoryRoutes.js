// categoryRoutes.js - Version finale avec vérifications
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Debug (optionnel)
console.log('✅ categoryRoutes configuré avec:');
console.log('   - protect:', typeof protect === 'function' ? '✓' : '✗');
console.log('   - authorize:', typeof authorize === 'function' ? '✓' : '✗');

// Middleware d'authentification
router.use(protect);

// Routes principales
router.get('/', categoryController.getAll);
router.get('/stats', authorize('admin_principal'), categoryController.getStats);
router.get('/:id', categoryController.getOne);
router.post('/', authorize('admin_principal', 'admin_stock'), categoryController.create);
router.put('/:id', authorize('admin_principal', 'admin_stock'), categoryController.update);
router.delete('/:id', authorize('admin_principal', 'admin_stock'), categoryController.delete);

module.exports = router;
