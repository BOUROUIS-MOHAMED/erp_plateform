// src/services/budgetService.js
import api from './api';

export const budgetService = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/budgets', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll budgets:', error);
      throw error;
    }
  },

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

  create: async (budgetData) => {
    try {
      if (!budgetData.category?.trim()) throw new Error('La catégorie est requise');
      if (!budgetData.budget || parseFloat(budgetData.budget) < 0) throw new Error('Le montant du budget est requis');
      if (!budgetData.startDate) throw new Error('La date de début est requise');
      if (!budgetData.endDate) throw new Error('La date de fin est requise');
      const response = await api.post('/budgets', {
        category: budgetData.category.trim(),
        budget: parseFloat(budgetData.budget),
        usedAmount: parseFloat(budgetData.usedAmount) || 0,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
        notes: budgetData.notes?.trim() || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create budget:', error);
      throw error;
    }
  },

  update: async (id, budgetData) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      const response = await api.put(`/budgets/${id}`, {
        category: budgetData.category?.trim(),
        budget: budgetData.budget !== undefined ? parseFloat(budgetData.budget) : undefined,
        usedAmount: budgetData.usedAmount !== undefined ? parseFloat(budgetData.usedAmount) : undefined,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
        notes: budgetData.notes?.trim(),
        status: budgetData.status
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update budget ${id}:`, error);
      throw error;
    }
  },

  updateUsed: async (id, usedAmount) => {
    try {
      if (!id) throw new Error('ID du budget requis');
      const response = await api.patch(`/budgets/${id}/used`, { usedAmount: parseFloat(usedAmount) });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateUsed budget ${id}:`, error);
      throw error;
    }
  },

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

  getStats: async () => {
    try {
      const response = await api.get('/budgets/stats');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getStats budgets:', error);
      throw error;
    }
  }
};
