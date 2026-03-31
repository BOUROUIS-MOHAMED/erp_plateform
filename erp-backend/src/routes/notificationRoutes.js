// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const {
  getUserNotifications,  // ← Correction: getUserNotifications au lieu de getNotifications
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications, // ← Ajouter si vous voulez cette route
  getUnreadCount          // ← Ajouter si vous voulez cette route
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Toutes les routes notifications sont protégées
router.use(protect);

// Routes
router.get('/', getUserNotifications);           // ← Correction ici
router.get('/unread-count', getUnreadCount);      // ← Nouvelle route
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/all', deleteAllNotifications);    // ← Nouvelle route
router.delete('/:id', deleteNotification);

module.exports = router;