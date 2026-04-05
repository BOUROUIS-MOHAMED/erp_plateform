// src/services/supplierService.js
import api from './api';

const supplierService = {
  // ===== CRUD STANDARD =====
  
  /**
   * Récupère tous les fournisseurs
   * @param {Object} params - Paramètres optionnels (page, limit, search, status)
   * @returns {Promise<Object>} Liste des fournisseurs avec pagination
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/suppliers', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll fournisseurs:', error);
      throw error;
    }
  },

  /**
   * Récupère un fournisseur par ID
   * @param {string} id - ID du fournisseur
   * @returns {Promise<Object>} Détails du fournisseur
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/suppliers/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById fournisseur ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crée un nouveau fournisseur
   * @param {Object} supplierData - Données du fournisseur
   * @returns {Promise<Object>} Fournisseur créé
   */
  create: async (supplierData) => {
    try {
      const response = await api.post('/suppliers', {
        name: supplierData.name,
        code: supplierData.code,
        contact: supplierData.contact,
        email: supplierData.email,
        phone: supplierData.phone,
        address: supplierData.address,
        status: supplierData.status || 'actif',
        rating: parseFloat(supplierData.rating) || 4
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create fournisseur:', error);
      throw error;
    }
  },

  /**
   * Met à jour un fournisseur
   * @param {string} id - ID du fournisseur
   * @param {Object} supplierData - Nouvelles données
   * @returns {Promise<Object>} Fournisseur mis à jour
   */
  update: async (id, supplierData) => {
    try {
      const response = await api.put(`/suppliers/${id}`, {
        name: supplierData.name,
        code: supplierData.code,
        contact: supplierData.contact,
        email: supplierData.email,
        phone: supplierData.phone,
        address: supplierData.address,
        status: supplierData.status,
        rating: parseFloat(supplierData.rating)
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update fournisseur ${id}:`, error);
      throw error;
    }
  },

  /**
   * Supprime un fournisseur
   * @param {string} id - ID du fournisseur
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/suppliers/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete fournisseur ${id}:`, error);
      throw error;
    }
  },

  // ===== FONCTIONS SPÉCIFIQUES =====
  
  /**
   * Récupère les statistiques des fournisseurs
   * @returns {Promise<Object>} Statistiques (total, actifs, top fournisseurs)
   */
  getStats: async () => {
    try {
      const response = await api.get('/suppliers/stats');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getStats fournisseurs:', error);
      throw error;
    }
  },

  /**
   * Récupère les produits d'un fournisseur
   * @param {string} id - ID du fournisseur
   * @param {Object} params - Paramètres optionnels (page, limit)
   * @returns {Promise<Object>} Produits du fournisseur
   */
  getProducts: async (id, params = {}) => {
    try {
      const response = await api.get(`/suppliers/${id}/products`, { params });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getProducts fournisseur ${id}:`, error);
      throw error;
    }
  },

  /**
   * Recherche avancée de fournisseurs
   * @param {string} query - Terme de recherche
   * @returns {Promise<Array>} Résultats de recherche
   */
  search: async (query) => {
    try {
      const response = await api.get('/suppliers/search', { 
        params: { q: query } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur search fournisseurs:', error);
      throw error;
    }
  }
};

export default supplierService;
