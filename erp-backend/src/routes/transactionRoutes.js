// transactionRoutes.js - Version corrigée pour votre controller
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Debug
console.log('🔍 transactionController chargé avec:', Object.keys(transactionController));

// Middleware d'authentification
router.use(protect);

// ===== ROUTES PRINCIPALES =====

// GET /api/transactions - Liste toutes les transactions
router.get('/', 
  authorize('admin_principal', 'admin_finance'), 
  transactionController.getAll
);

// GET /api/transactions/stats - Statistiques
router.get('/stats', 
  authorize('admin_principal', 'admin_finance'), 
  transactionController.getStats
);

// GET /api/transactions/trial-balance - Balance comptable
router.get('/trial-balance', 
  authorize('admin_principal', 'admin_finance'), 
  transactionController.getTrialBalance
);

// POST /api/transactions/bulk - Création en masse
router.post('/bulk', 
  authorize('admin_principal'), 
  transactionController.bulkCreate
);

// GET /api/transactions/ledger/:accountId - Grand livre par compte
router.get('/ledger/:accountId', 
  authorize('admin_principal', 'admin_finance'), 
  transactionController.getLedger
);

// ===== ROUTES PAR ID =====

// GET /api/transactions/:id - Détail d'une transaction
router.get('/:id', 
  authorize('admin_principal', 'admin_finance'), 
  transactionController.getById  // ← Note: getById, pas getOne
);

// POST /api/transactions - Créer une transaction
router.post('/', 
  authorize('admin_principal', 'admin_finance'), 
  transactionController.create
);

// PUT /api/transactions/:id - Mettre à jour une transaction
router.put('/:id', 
  authorize('admin_principal'), 
  transactionController.update
);

// DELETE /api/transactions/:id - Supprimer une transaction
router.delete('/:id', 
  authorize('admin_principal'), 
  transactionController.delete
);

// PATCH /api/transactions/:id/validate - Valider une transaction
router.patch('/:id/validate', 
  authorize('admin_principal'), 
  transactionController.validate
);

module.exports = router;