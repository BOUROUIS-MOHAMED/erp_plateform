// src/services/targetService.js
import api from './api';

export const targetService = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/targets', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll targets:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.get(`/targets/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById target ${id}:`, error);
      throw error;
    }
  },

  create: async (data) => {
    try {
      if (!data.category?.trim()) throw new Error('La catégorie est requise');
      if (data.amount === undefined || data.amount === '') throw new Error("L'objectif est requis");
      if (!data.startDate) throw new Error('La date de début est requise');
      if (!data.endDate) throw new Error('La date de fin est requise');
      const response = await api.post('/targets', {
        category: data.category.trim(),
        amount: parseFloat(data.amount),
        realisedAmount: parseFloat(data.realisedAmount) || 0,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes?.trim() || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create target:', error);
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.put(`/targets/${id}`, {
        category: data.category?.trim(),
        amount: data.amount !== undefined ? parseFloat(data.amount) : undefined,
        realisedAmount: data.realisedAmount !== undefined ? parseFloat(data.realisedAmount) : undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes?.trim(),
        status: data.status
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update target ${id}:`, error);
      throw error;
    }
  },

  updateRealised: async (id, realisedAmount) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.patch(`/targets/${id}/realised`, { realisedAmount: parseFloat(realisedAmount) });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateRealised target ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      if (!id) throw new Error('ID requis');
      const response = await api.delete(`/targets/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete target ${id}:`, error);
      throw error;
    }
  }
};
