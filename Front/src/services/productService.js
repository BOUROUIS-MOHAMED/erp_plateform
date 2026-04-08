// src/services/productService.js
import api from './api';

const productService = {
  // ===== CRUD STANDARD =====
  
  /**
   * Récupère tous les produits
   * @param {Object} params - Paramètres optionnels (page, limit, category, search, status)
   * @returns {Promise<Object>} Liste des produits avec pagination
   */

  getAll: async (params = {}) => {
    try {
      const response = await api.get('/products', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll produits:', error);
      throw error;
    }
  },
// Ajoutez cette fonction après getAll()
getProducts: async (params = {}) => {
  return productService.getAll(params);
},
  /**
   * Récupère un produit par ID
   * @param {string} id - ID du produit
   * @returns {Promise<Object>} Détails du produit avec mouvements
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById produit ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crée un nouveau produit
   * @param {Object} productData - Données du produit
   * @returns {Promise<Object>} Produit créé
   */
  create: async (productData) => {
    try {
      const response = await api.post('/products', {
        name: productData.name,
        sku: productData.sku || productData.code,
        category: productData.category,
        stock: parseInt(productData.stock) || 0,
        price: parseFloat(productData.price) || 0,
        supplierId: productData.supplierId,
        minStock: parseInt(productData.minStock) || 5
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create produit:', error);
      throw error;
    }
  },

  /**
   * Met à jour un produit
   * @param {string} id - ID du produit
   * @param {Object} productData - Nouvelles données
   * @returns {Promise<Object>} Produit mis à jour
   */
  update: async (id, productData) => {
    try {
      const response = await api.put(`/products/${id}`, {
        name: productData.name,
        sku: productData.sku || productData.code,
        category: productData.category,
        stock: parseInt(productData.stock),
        price: parseFloat(productData.price),
        supplierId: productData.supplierId,
        minStock: parseInt(productData.minStock)
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update produit ${id}:`, error);
      throw error;
    }
  },

  /**
   * Supprime un produit
   * @param {string} id - ID du produit
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete produit ${id}:`, error);
      throw error;
    }
  },

  // ===== FONCTIONS SPÉCIFIQUES =====
  
  /**
   * Récupère les produits en stock faible
   * @param {number} threshold - Seuil d'alerte (optionnel)
   * @returns {Promise<Object>} Alertes stock
   */
  getLowStock: async (threshold = 10) => {
    try {
      const response = await api.get('/products/low-stock', { 
        params: { threshold } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getLowStock:', error);
      throw error;
    }
  },

  /**
   * Met à jour le stock d'un produit
   * @param {string} id - ID du produit
   * @param {Object} data - Données de mise à jour
   * @param {number} data.quantity - Quantité à ajouter/retirer
   * @param {string} data.reason - Raison du mouvement
   * @param {string} data.note - Note optionnelle
   * @returns {Promise<Object>} Produit et mouvement créé
   */
  updateStock: async (id, data) => {
    try {
      const response = await api.patch(`/products/${id}/stock`, {
        quantity: parseInt(data.quantity),
        reason: data.reason || 'adjustment',
        note: data.note
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateStock produit ${id}:`, error);
      throw error;
    }
  },

  /**
   * Récupère les statistiques des produits
   * @returns {Promise<Object>} Statistiques (total, valeur, alertes)
   */
  getStats: async () => {
    try {
      const response = await api.get('/products/stats');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getStats produits:', error);
      throw error;
    }
  },

  /**
   * Met à jour le nom d'une catégorie pour tous les produits
   * @param {string} oldName - Ancien nom de catégorie
   * @param {string} newName - Nouveau nom de catégorie
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  updateCategory: async (oldName, newName) => {
    try {
      const response = await api.put('/products/update-category', {
        oldName,
        newName
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur updateCategory:', error);
      throw error;
    }
  },

  /**
   * Recherche avancée de produits
   * @param {Object} params - Critères de recherche
   * @returns {Promise<Object>} Résultats de recherche
   */
  search: async (params) => {
    try {
      const response = await api.get('/products/search', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur search produits:', error);
      throw error;
    }
  }
};

export default productService;
