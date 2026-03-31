// src/services/notificationService.js
import api from './api';

const notificationService = {
  // ===== ROUTES PRINCIPALES =====
  /**
   * Récupère toutes les notifications de l'utilisateur connecté
   * @param {Object} params - Paramètres optionnels (page, limit, read, type)
   * @returns {Promise<Object>} Liste des notifications avec pagination
   */
  getNotifications: async (params = {}) => {
    try {
      const response = await api.get('/notifications', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getNotifications:', error);
      throw error;
    }
  },
  /**
   * ALIAS pour compatibilité
   */
  getAll: async (params = {}) => {
    return notificationService.getNotifications(params);
  },
  /**
   * Récupère une notification par ID
   * @param {string} id - ID de la notification
   * @returns {Promise<Object>} Détails de la notification
   */
  getById: async (id) => {
    try {
      if (!id) throw new Error('ID de la notification requis');
      const response = await api.get(`/notifications/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById notification ${id}:`, error);
      throw error;
    }
  },
  // ===== ACTIONS SUR LES NOTIFICATIONS =====
  /**
   * Marque une notification comme lue
   * @param {string} id - ID de la notification
   * @returns {Promise<Object>} Notification mise à jour
   */
  markAsRead: async (id) => {
    try {
      if (!id) throw new Error('ID de la notification requis');
      const response = await api.patch(`/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur markAsRead ${id}:`, error);
      throw error;
    }
  },
  /**
   * Marque une notification comme non lue
   * @param {string} id - ID de la notification
   * @returns {Promise<Object>} Notification mise à jour
   */
  markAsUnread: async (id) => {
    try {
      if (!id) throw new Error('ID de la notification requis');
      const response = await api.patch(`/notifications/${id}/unread`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur markAsUnread ${id}:`, error);
      throw error;
    }
  },
  /**
   * Marque toutes les notifications comme lues
   * @returns {Promise<Object>} Confirmation
   */
  markAllAsRead: async () => {
    try {
      const response = await api.patch('/notifications/read-all');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur markAllAsRead:', error);
      throw error;
    }
  },
  // ===== SUPPRESSION =====
  /**
   * Supprime une notification
   * @param {string} id - ID de la notification
   * @returns {Promise<Object>} Confirmation de suppression
   */
  deleteNotification: async (id) => {
    try {
      if (!id) throw new Error('ID de la notification requis');
      const response = await api.delete(`/notifications/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur deleteNotification ${id}:`, error);
      throw error;
    }
  },
  /**
   * Supprime toutes les notifications de l'utilisateur
   * @returns {Promise<Object>} Confirmation
   */
  deleteAll: async () => {
    try {
      const response = await api.delete('/notifications');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur deleteAll:', error);
      throw error;
    }
  },
  // ===== STATISTIQUES =====
  /**
   * Récupère le nombre de notifications non lues
   * @returns {Promise<Object>} Nombre de notifications non lues
   */
  getUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getUnreadCount:', error);
      throw error;
    }
  },
  // ===== FILTRES =====
  /**
   * Récupère les notifications par type
   * @param {string} type - Type de notification
   * @returns {Promise<Array>} Notifications du type spécifié
   */
  getByType: async (type) => {
    try {
      if (!type) throw new Error('Le type de notification est requis');
      const response = await api.get('/notifications', { 
        params: { type } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByType ${type}:`, error);
      throw error;
    }
  },
  /**
   * Récupère les notifications non lues
   * @returns {Promise<Array>} Notifications non lues
   */
  getUnread: async () => {
    try {
      const response = await api.get('/notifications', { 
        params: { read: false } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getUnread:', error);
      throw error;
    }
  },
  // ===== CRÉATION (INTERNE) =====
  /**
   * Crée une notification (utilisé en interne)
   * @param {Object} notificationData - Données de la notification
   * @returns {Promise<Object>} Notification créée
   */
  create: async (notificationData) => {
    try {
      const response = await api.post('/notifications', notificationData);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create notification:', error);
      throw error;
    }
  }
};
export default notificationService;