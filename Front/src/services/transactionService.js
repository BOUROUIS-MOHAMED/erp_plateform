// src/services/transactionService.js
import api from './api';

export const transactionService = {
  // Récupérer toutes les transactions
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll transactions:', error);
      throw error;
    }
  },

  // Récupérer une transaction par ID
  getById: async (id) => {
    try {
      const response = await api.get(`/transactions/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById transaction ${id}:`, error);
      throw error;
    }
  },

  // Créer une transaction
  create: async (transactionData) => {
    try {
      const response = await api.post('/transactions', transactionData);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create transaction:', error);
      throw error;
    }
  },

  // Mettre à jour une transaction
  update: async (id, transactionData) => {
    try {
      const response = await api.put(`/transactions/${id}`, transactionData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update transaction ${id}:`, error);
      throw error;
    }
  },

  // Valider une transaction (brouillon → validé)
  validate: async (id) => {
    try {
      const response = await api.patch(`/transactions/${id}/validate`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur validate transaction ${id}:`, error);
      throw error;
    }
  },

  // Supprimer une transaction
  delete: async (id) => {
    try {
      const response = await api.delete(`/transactions/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete transaction ${id}:`, error);
      throw error;
    }
  },

  // Récupérer les transactions par compte
  getByAccount: async (accountId, params = {}) => {
    try {
      const response = await api.get(`/transactions/account/${accountId}`, { params });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByAccount ${accountId}:`, error);
      throw error;
    }
  },

  // Récupérer les transactions par période
  getByDateRange: async (startDate, endDate) => {
    try {
      const response = await api.get('/transactions/range', {
        params: { start: startDate, end: endDate }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getByDateRange:', error);
      throw error;
    }
  },

  // Récupérer les statistiques
  getStats: async (params = {}) => {
    try {
      const response = await api.get('/transactions/stats', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getStats transactions:', error);
      throw error;
    }
  },

  // Exporter les transactions
  exportToCSV: async (params = {}) => {
    try {
      const response = await api.get('/transactions/export/csv', { 
        params,
        responseType: 'blob' 
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return true;
    } catch (error) {
      console.error('❌ Erreur exportToCSV:', error);
      throw error;
    }
  }
};