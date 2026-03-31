// src/services/budgetService.js
import api from './api';
export const budgetService = {
  // ===== CRUD STANDARD =====
  /**
   * Récupère tous les budgets
   * @param {Object} params - Paramètres optionnels (page, limit, month, category, status)
   * @returns {Promise<Object>} Liste des budgets avec pagination
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/budgets', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll budgets:', error);
      throw error;
    }
  },
  /**
   * ALIAS pour compatibilité
   */
  getBudgets: async (params = {}) => {
    return budgetService.getAll(params);
  },
  /**
   * Récupère un budget par ID
   * @param {string} id - ID du budget
   * @returns {Promise<Object>} Détails du budget
   */
  getById: async (id) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      const response = await api.get(`/budgets/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById budget ${id}:`, error);
      throw error;
    }
  },
  /**
   * Crée un nouveau budget
   * @param {Object} budgetData - Données du budget
   * @returns {Promise<Object>} Budget créé
   */
  create: async (budgetData) => {
    try {
      // Validation des données requises
      if (!budgetData.category?.trim()) {
        throw new Error('La catégorie est requise');
      }
      if (!budgetData.budget || parseFloat(budgetData.budget) <= 0) {
        throw new Error('Le montant du budget est requis et doit être positif');
      }
      if (!budgetData.month) {
        throw new Error('Le mois est requis');
      }
      const response = await api.post('/budgets', {
        category: budgetData.category.trim(),
        budget: parseFloat(budgetData.budget),
        actual: 0,
        month: budgetData.month,
        notes: budgetData.notes?.trim() || '',
        status: 'respecté'
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create budget:', error);
      throw error;
    }
  },
  /**
   * Met à jour un budget
   * @param {string} id - ID du budget
   * @param {Object} budgetData - Nouvelles données
   * @returns {Promise<Object>} Budget mis à jour
   */
  update: async (id, budgetData) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      const response = await api.put(`/budgets/${id}`, {
        category: budgetData.category?.trim(),
        budget: budgetData.budget ? parseFloat(budgetData.budget) : undefined,
        month: budgetData.month,
        notes: budgetData.notes?.trim()
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update budget ${id}:`, error);
      throw error;
    }
  },
  /**
   * Supprime un budget
   * @param {string} id - ID du budget
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      const response = await api.delete(`/budgets/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete budget ${id}:`, error);
      throw error;
    }
  },
  // ===== FONCTIONS SPÉCIFIQUES =====
  /**
   * Récupère les budgets par mois
   * @param {string} month - Mois (format YYYY-MM)
   * @returns {Promise<Array>} Budgets du mois
   */
  getByMonth: async (month) => {
    try {
      if (!month) throw new Error('Le mois est requis');
      const response = await api.get('/budgets', { 
        params: { month } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByMonth ${month}:`, error);
      throw error;
    }
  },
  /**
   * Récupère les budgets par catégorie
   * @param {string} category - Catégorie
   * @returns {Promise<Array>} Budgets de la catégorie
   */
  getByCategory: async (category) => {
    try {
      if (!category) throw new Error('La catégorie est requise');
      const response = await api.get('/budgets', { 
        params: { category } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByCategory ${category}:`, error);
      throw error;
    }
  },
  /**
   * Met à jour le montant réalisé d'un budget
   * @param {string} id - ID du budget
   * @param {number} amount - Montant réalisé
   * @returns {Promise<Object>} Budget mis à jour
   */
  updateActual: async (id, amount) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      if (amount === undefined || amount === null) {
        throw new Error('Le montant réalisé est requis');
      }
      const response = await api.patch(`/budgets/${id}/actual`, {
        actual: parseFloat(amount)
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateActual budget ${id}:`, error);
      throw error;
    }
  },
  /**
   * Calcule l'écart entre budget et réalisé
   * @param {string} id - ID du budget
   * @returns {Promise<Object>} Écart et pourcentage
   */
  getVariance: async (id) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      const response = await api.get(`/budgets/${id}/variance`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getVariance budget ${id}:`, error);
      throw error;
    }
  },
  /**
   * Récupère le résumé budgétaire pour un mois
   * @param {string} month - Mois (format YYYY-MM)
   * @returns {Promise<Object>} Résumé (total budget, total réalisé, statut global)
   */
  getSummary: async (month) => {
    try {
      if (!month) throw new Error('Le mois est requis');
      const response = await api.get('/budgets/summary', { 
        params: { month } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getSummary ${month}:`, error);
      throw error;
    }
  }
};