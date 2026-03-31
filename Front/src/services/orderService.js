// src/services/orderService.js
import api from './api';

export const orderService = {
  // ===== MÉTHODES PRINCIPALES =====
  
  /**
   * Récupérer toutes les commandes
   * @param {Object} params - Paramètres de requête (pagination, filtres)
   * @returns {Promise<Array>} Liste des commandes
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/orders', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll orders:', error);
      throw error;
    }
  },

  /**
   * ALIAS pour compatibilité avec FacturationAdmin
   */
  getOrders: async (params = {}) => {
    return orderService.getAll(params);
  },
  /**
   * Récupérer une commande par ID
   * @param {string} id - ID de la commande
   * @returns {Promise<Object>} Détails de la commande
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById order ${id}:`, error);
      throw error;
    }
  },
  /**
   * Créer une commande
   * @param {Object} orderData - Données de la commande
   * @returns {Promise<Object>} Commande créée
   */
  create: async (orderData) => {
    try {
      const response = await api.post('/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create order:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour une commande
   * @param {string} id - ID de la commande
   * @param {Object} orderData - Nouvelles données
   * @returns {Promise<Object>} Commande mise à jour
   */
  update: async (id, orderData) => {
    try {
      const response = await api.put(`/orders/${id}`, orderData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update order ${id}:`, error);
      throw error;
    }
  },

  /**
   * Supprimer une commande
   * @param {string} id - ID de la commande
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete order ${id}:`, error);
      throw error;
    }
  },

  // ===== MÉTHODES MÉTIER SPÉCIALISÉES =====

  /**
   * Mettre à jour le statut d'une commande
   * @param {string} id - ID de la commande
   * @param {string} status - Nouveau statut
   * @returns {Promise<Object>} Commande mise à jour
   */
  updateStatus: async (id, status) => {
    try {
      const response = await api.patch(`/orders/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateStatus order ${id}:`, error);
      throw error;
    }
  },
  /**
   * Récupérer les commandes par client
   * @param {string} clientId - ID du client
   * @returns {Promise<Array>} Liste des commandes du client
   */
  getByClient: async (clientId) => {
    try {
      // Route cohérente avec clientService.js
      const response = await api.get(`/customers/${clientId}/orders`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByClient ${clientId}:`, error);
      throw error;
    }
  },
  /**
   * Récupérer les commandes par statut
   * @param {string} status - Statut recherché
   * @returns {Promise<Array>} Liste des commandes avec ce statut
   */
  getByStatus: async (status) => {
    try {
      const response = await api.get('/orders', { 
        params: { status } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByStatus ${status}:`, error);
      throw error;
    }
  },
  /**
   * Récupérer les commandes récentes
   * @param {number} limit - Nombre de commandes
   * @returns {Promise<Array>} Commandes récentes
   */
  getRecent: async (limit = 10) => {
    try {
      const response = await api.get('/orders/recent', { 
        params: { limit } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getRecent orders:', error);
      throw error;
    }
  },
  /**
   * Générer un devis à partir d'une commande
   * @param {string} id - ID de la commande
   * @returns {Promise<Object>} Devis généré
   */
  generateQuote: async (id) => {
    try {
      const response = await api.post(`/orders/${id}/quote`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur generateQuote order ${id}:`, error);
      throw error;
    }
  },
  /**
   * Annuler une commande
   * @param {string} id - ID de la commande
   * @param {string} reason - Motif d'annulation
   * @returns {Promise<Object>} Commande annulée
   */
  cancel: async (id, reason) => {
    try {
      const response = await api.post(`/orders/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur cancel order ${id}:`, error);
      throw error;
    }
  }
};