const express = require('express');
const router = express.Router();
const { 
  getPrincipalDashboard, 
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAuditLogs,
  getGlobalStats
} = require('../controllers/dashboardPrincipalController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Toutes les routes nécessitent authentification et rôle admin_principal
router.use(protect);
router.use(authorize('admin_principal'));

// Routes principales
router.get('/', getPrincipalDashboard);
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/audit', getAuditLogs);
router.get('/stats', getGlobalStats);

module.exports = router;