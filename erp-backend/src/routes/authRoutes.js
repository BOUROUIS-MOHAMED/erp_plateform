const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  register,
  login,
  logout,
  refreshToken  // ← À AJOUTER
} = require('../controllers/authController');

console.log('🔍 authRoutes chargé');

// Route de test
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth routes working',
    timestamp: new Date().toISOString()
  });
});

// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken); // ← À AJOUTER

// Routes protégées
router.post('/logout', protect, logout);

module.exports = router;