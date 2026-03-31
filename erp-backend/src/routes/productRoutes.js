// productRoutes.js - Version corrigée pour productController
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const productController = require('../controllers/productController');

// Vérification des fonctions disponibles dans le controller
console.log('🔍 Vérification productController:');
const availableFunctions = Object.keys(productController);
console.log('   Fonctions disponibles:', availableFunctions.join(', '));

// Vérifier que toutes les fonctions nécessaires existent
const requiredFunctions = ['getAll', 'getOne', 'create', 'update', 'delete', 'updateStock', 'getLowStock', 'updateCategory', 'getStats'];
requiredFunctions.forEach(func => {
  if (typeof productController[func] === 'function') {
    console.log(`   ✅ ${func}`);
  } else {
    console.log(`   ❌ ${func} - MANQUANTE`);
  }
});

// Middleware d'authentification
router.use(protect);

// Route de test
router.get('/test', (req, res) => {
  res.json({ message: 'Route products OK' });
});

// Utilisation sécurisée avec vérification
const safeHandler = (handler, name) => {
  if (typeof handler !== 'function') {
    console.error(`❌ Erreur: ${name} n'est pas une fonction`);
    return (req, res) => res.status(500).json({ error: `Configuration error: ${name} missing` });
  }
  return handler;
};

// ===== ROUTES PRINCIPALES =====
// GET /api/products - Liste tous les produits
// POST /api/products - Crée un nouveau produit
router.route('/')
  .get(safeHandler(productController.getAll, 'getAll'))           // ← CORRIGÉ: getAll au lieu de getAllProducts
  .post(
    authorize('admin_principal', 'admin_stock'), 
    safeHandler(productController.create, 'create')               // ← CORRIGÉ: create au lieu de createProduct
  );

// ===== ROUTES SPÉCIFIQUES (doivent être AVANT /:id) =====
// GET /api/products/low-stock - Produits en stock faible
router.get('/low-stock', 
  safeHandler(productController.getLowStock, 'getLowStock')       // ✓ OK
);

// GET /api/products/stats - Statistiques des produits
router.get('/stats', 
  authorize('admin_principal'), 
  safeHandler(productController.getStats, 'getStats')             // ✓ OK
);

// PUT /api/products/update-category - Mise à jour de catégorie
router.put('/update-category', 
  authorize('admin_principal'), 
  safeHandler(productController.updateCategory, 'updateCategory') // ✓ OK
);

// ===== ROUTES PAR ID =====
// GET /api/products/:id - Récupère un produit
// PUT /api/products/:id - Met à jour un produit
// DELETE /api/products/:id - Supprime un produit
router.route('/:id')
  .get(safeHandler(productController.getOne, 'getOne'))           // ← CORRIGÉ: getOne au lieu de getProductById
  .put(
    authorize('admin_principal', 'admin_stock'), 
    safeHandler(productController.update, 'update')               // ← CORRIGÉ: update au lieu de updateProduct
  )
  .delete(
    authorize('admin_principal', 'admin_stock'), 
    safeHandler(productController.delete, 'delete')               // ← CORRIGÉ: delete au lieu de deleteProduct
  );

// ===== ROUTES SPÉCIFIQUES PAR ID =====
// PATCH /api/products/:id/stock - Met à jour le stock
router.patch('/:id/stock', 
  authorize('admin_principal', 'admin_stock'), 
  safeHandler(productController.updateStock, 'updateStock')       // ✓ OK
);

module.exports = router;
