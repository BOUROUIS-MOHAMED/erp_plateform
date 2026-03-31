// supplierRoutes.js - Version corrigée
const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { protect } = require('../middleware/authMiddleware');  // ← CORRECTION: destructurer protect
const { authorize } = require('../middleware/roleMiddleware'); // ← CORRECTION: destructurer authorize

// Debug
console.log('🔍 supplierController chargé avec:', Object.keys(supplierController));

// Middleware d'authentification - CORRECTION: utiliser protect au lieu de authMiddleware
router.use(protect);

// Routes principales
router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getOne);
router.post('/', authorize('admin_principal', 'admin_stock'), supplierController.create);
router.put('/:id', authorize('admin_principal', 'admin_stock'), supplierController.update);
router.delete('/:id', authorize('admin_principal', 'admin_stock'), supplierController.delete);

module.exports = router;
