const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  createPayment,
  getAllPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  validatePayment,    // ← AJOUTÉ (manquait)
  getPaymentStats
} = require('../controllers/paymentController');

// Debug - Vérifier les fonctions disponibles
console.log('🔍 paymentController chargé avec:', Object.keys({
  createPayment,
  getAllPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  validatePayment,
  getPaymentStats
}));

// Toutes les routes nécessitent une authentification
router.use(protect);

// ===== ROUTES SPÉCIFIQUES (doivent être AVANT /:id) =====

// GET /api/payments/stats - Statistiques des paiements
router.get('/stats', 
  authorize('admin_principal', 'admin_finance', 'admin_facture'), 
  getPaymentStats
);

// ===== ROUTES PRINCIPALES =====

// GET /api/payments - Liste tous les paiements
// POST /api/payments - Créer un paiement
router.route('/')
  .get(authorize('admin_principal', 'admin_finance', 'admin_facture'), getAllPayments)
  .post(authorize('admin_principal', 'admin_finance', 'admin_facture'), createPayment);

// ===== ROUTES PAR ID =====

// GET /api/payments/:id - Détail d'un paiement
// PUT /api/payments/:id - Mettre à jour un paiement
// DELETE /api/payments/:id - Supprimer un paiement
router.route('/:id')
  .get(getPaymentById)  // Accessible à tous les utilisateurs authentifiés
  .put(authorize('admin_principal', 'admin_finance', 'admin_facture'), updatePayment)
  .delete(authorize('admin_principal'), deletePayment);

// ===== ROUTES SPÉCIFIQUES PAR ID =====

// PATCH /api/payments/:id/validate - Valider un paiement (AJOUTÉ)
router.patch('/:id/validate', 
  authorize('admin_principal', 'admin_finance'), 
  validatePayment
);

module.exports = router;