// src/services/stockMovementService.js
import api from './api';

const stockMovementService = {
  // ===== ROUTES PRINCIPALES =====
  
  /**
   * Récupère tous les mouvements de stock
   * @param {Object} params - Paramètres de filtre (page, limit, productId, startDate, endDate, type)
   * @returns {Promise<Object>} Liste des mouvements avec pagination
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/stock', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll mouvements:', error);
      throw error;
    }
  },

  /**
   * Ajoute une entrée de stock
   * @param {Object} data - Données de l'entrée
   * @param {string} data.productId - ID du produit
   * @param {number} data.quantity - Quantité à ajouter
   * @param {string} data.reason - Raison (purchase, return, adjustment)
   * @param {string} data.note - Note optionnelle
   * @returns {Promise<Object>} Mouvement créé et produit mis à jour
   */
  addEntry: async (data) => {
    try {
      const response = await api.post('/stock/entry', {
        productId: data.productId,
        quantity: parseInt(data.quantity),
        reason: data.reason || 'purchase',
        notes: data.note || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur addEntry:', error);
      throw error;
    }
  },

  /**
   * Ajoute une sortie de stock
   * @param {Object} data - Données de la sortie
   * @param {string} data.productId - ID du produit
   * @param {number} data.quantity - Quantité à retirer
   * @param {string} data.reason - Raison (sale, damage, adjustment)
   * @param {string} data.note - Note optionnelle
   * @returns {Promise<Object>} Mouvement créé et produit mis à jour
   */
  addExit: async (data) => {
    try {
      const response = await api.post('/stock/exit', {
        productId: data.productId,
        quantity: parseInt(data.quantity),
        reason: data.reason || 'sale',
        notes: data.note || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur addExit:', error);
      throw error;
    }
  },

  /**
   * Supprime un mouvement de stock
   * @param {string} id - ID du mouvement
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/stock/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete mouvement ${id}:`, error);
      throw error;
    }
  },

  // ===== FONCTIONS SPÉCIFIQUES MANQUANTES =====
  
  /**
   * Récupère les statistiques des mouvements
   * @param {Object} params - Paramètres (period, startDate, endDate)
   * @returns {Promise<Object>} Statistiques (entrées/sorties par période)
   */
  getStats: async (params = {}) => {
    try {
      const response = await api.get('/stock/stats', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getStats mouvements:', error);
      throw error;
    }
  },

  /**
   * Récupère les mouvements d'un produit spécifique
   * @param {string} productId - ID du produit
   * @param {Object} params - Paramètres (limit, startDate, endDate)
   * @returns {Promise<Object>} Mouvements du produit avec stats
   */
  getByProduct: async (productId, params = {}) => {
    try {
      const response = await api.get(`/stock/product/${productId}`, { params });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByProduct ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Récupère l'historique des mouvements
   * @param {Object} params - Paramètres de filtre
   * @returns {Promise<Object>} Historique des mouvements
   */
  getHistory: async (params = {}) => {
    try {
      const response = await api.get('/stock/history', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getHistory:', error);
      throw error;
    }
  }
};

export default stockMovementService;