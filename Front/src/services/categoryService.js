// src/services/categoryService.js
import api from './api';

const categoryService = {
  // ===== CRUD STANDARD =====
  
  /**
   * Récupère toutes les catégories
   * @param {Object} params - Paramètres optionnels (page, limit, search)
   * @returns {Promise<Object>} Liste des catégories avec pagination
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/categories', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll catégories:', error);
      throw error;
    }
  },

  /**
   * Récupère une catégorie par ID
   * @param {string} id - ID de la catégorie
   * @returns {Promise<Object>} Détails de la catégorie
   */
  getById: async (id) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la catégorie requis');
      }
      
      const response = await api.get(`/categories/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById catégorie ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crée une nouvelle catégorie
   * @param {Object} categoryData - Données de la catégorie
   * @param {string} categoryData.name - Nom de la catégorie
   * @param {string} categoryData.description - Description (optionnel)
   * @returns {Promise<Object>} Catégorie créée
   */
  create: async (categoryData) => {
    try {
      // Validation des données
      if (!categoryData || typeof categoryData !== 'object') {
        throw new Error('Données de catégorie invalides');
      }

      // Validation du nom
      if (!categoryData.name) {
        throw new Error('Le nom de la catégorie est requis');
      }
      if (typeof categoryData.name !== 'string') {
        throw new Error('Le nom de la catégorie doit être une chaîne de caractères');
      }
      const trimmedName = categoryData.name.trim();
      const trimmedCode = typeof categoryData.code === 'string' ? categoryData.code.trim() : '';
      if (trimmedName.length === 0) {
        throw new Error('Le nom de la catégorie ne peut pas être vide');
      }
      if (trimmedName.length > 50) {
        throw new Error('Le nom de la catégorie ne peut pas dépasser 50 caractères');
      }

      if (trimmedCode.length === 0) {
        throw new Error('La clé unique de la catégorie est requise');
      }
      if (trimmedCode.length > 50) {
        throw new Error('La clé unique de la catégorie ne peut pas dépasser 50 caractères');
      }

      // Validation de la description (si fournie)
      let trimmedDescription = '';
      if (categoryData.description !== undefined) {
        if (typeof categoryData.description !== 'string') {
          throw new Error('La description doit être une chaîne de caractères');
        }
        trimmedDescription = categoryData.description.trim();
        if (trimmedDescription.length > 200) {
          throw new Error('La description ne peut pas dépasser 200 caractères');
        }
      }

      const response = await api.post('/categories', {
        name: trimmedName,
        code: trimmedCode,
        description: trimmedDescription
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create catégorie:', error);
      throw error;
    }
  },

  /**
   * Met à jour une catégorie
   * @param {string} id - ID de la catégorie
   * @param {Object} categoryData - Nouvelles données
   * @returns {Promise<Object>} Catégorie mise à jour
   */
  update: async (id, categoryData) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la catégorie requis');
      }

      // Validation des données
      if (!categoryData || typeof categoryData !== 'object') {
        throw new Error('Données de catégorie invalides');
      }

      // Préparer les données mises à jour
      const updatedData = {};

      // Validation du nom (si fourni)
      if (categoryData.name !== undefined) {
        if (typeof categoryData.name !== 'string') {
          throw new Error('Le nom de la catégorie doit être une chaîne de caractères');
        }
        const trimmedName = categoryData.name.trim();
        if (trimmedName.length === 0) {
          throw new Error('Le nom de la catégorie ne peut pas être vide');
        }
        if (trimmedName.length > 50) {
          throw new Error('Le nom de la catégorie ne peut pas dépasser 50 caractères');
        }
        updatedData.name = trimmedName;
      }

      if (categoryData.code !== undefined) {
        if (typeof categoryData.code !== 'string') {
          throw new Error('La clé unique doit être une chaîne de caractères');
        }
        const trimmedCode = categoryData.code.trim();
        if (trimmedCode.length === 0) {
          throw new Error('La clé unique de la catégorie est requise');
        }
        if (trimmedCode.length > 50) {
          throw new Error('La clé unique de la catégorie ne peut pas dépasser 50 caractères');
        }
        updatedData.code = trimmedCode;
      }

      // Validation de la description (si fournie)
      if (categoryData.description !== undefined) {
        if (typeof categoryData.description !== 'string') {
          throw new Error('La description doit être une chaîne de caractères');
        }
        const trimmedDescription = categoryData.description.trim();
        if (trimmedDescription.length > 200) {
          throw new Error('La description ne peut pas dépasser 200 caractères');
        }
        updatedData.description = trimmedDescription;
      }

      // Vérifier qu'au moins un champ est à mettre à jour
      if (Object.keys(updatedData).length === 0) {
        throw new Error('Aucune donnée à mettre à jour');
      }

      const response = await api.put(`/categories/${id}`, updatedData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update catégorie ${id}:`, error);
      throw error;
    }
  },

  /**
   * Supprime une catégorie
   * @param {string} id - ID de la catégorie
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la catégorie requis');
      }

      const response = await api.delete(`/categories/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete catégorie ${id}:`, error);
      throw error;
    }
  },

  /**
   * Récupère les produits d'une catégorie
   * @param {string} id - ID de la catégorie
   * @param {Object} params - Paramètres optionnels (page, limit)
   * @returns {Promise<Object>} Produits de la catégorie
   */
  getProducts: async (id, params = {}) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la catégorie requis');
      }

      const response = await api.get(`/categories/${id}/products`, { params });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getProducts catégorie ${id}:`, error);
      throw error;
    }
  }
};

export default categoryService;
