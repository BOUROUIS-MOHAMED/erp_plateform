// src/services/moneyFlowService.js
import api from './api';

export const moneyFlowService = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/money-flow', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll money-flow:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.get(`/money-flow/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById money-flow ${id}:`, error);
      throw error;
    }
  },

  create: async (data) => {
    try {
      if (!data.category?.trim()) throw new Error('La catégorie est requise');
      if (data.amount === undefined || data.amount === '') throw new Error('Le montant est requis');
      if (data.isExpense === undefined) throw new Error('Le type est requis');
      const response = await api.post('/money-flow', {
        category: data.category.trim(),
        amount: parseFloat(data.amount),
        date: data.date || new Date().toISOString().split('T')[0],
        isExpense: Boolean(data.isExpense),
        note: data.note?.trim() || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create money-flow:', error);
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.put(`/money-flow/${id}`, {
        category: data.category?.trim(),
        amount: data.amount !== undefined ? parseFloat(data.amount) : undefined,
        date: data.date,
        isExpense: data.isExpense !== undefined ? Boolean(data.isExpense) : undefined,
        note: data.note?.trim()
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update money-flow ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.delete(`/money-flow/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete money-flow ${id}:`, error);
      throw error;
    }
  }
};
