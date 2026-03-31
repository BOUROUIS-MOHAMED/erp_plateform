// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  // Profil personnel
  getProfile,
  updateProfile,
  changePassword,
  getPreferences,
  updatePreferences,
  
  // Administration (à importer depuis userController)
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} = require('../controllers/userController');

// Toutes les routes nécessitent une authentification
router.use(protect);

// ===== ROUTES POUR LE PROFIL PERSONNEL (tous les utilisateurs) =====
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/change-password', changePassword);
router.get('/preferences/:module', getPreferences);
router.put('/preferences/:module', updatePreferences);

// ===== ROUTES D'ADMINISTRATION (réservées à admin_principal) =====
router.use(authorize('admin_principal'));

router.route('/')
  .get(getAllUsers)
  .post(createUser);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

router.patch('/:id/toggle', toggleUserStatus);

module.exports = router;