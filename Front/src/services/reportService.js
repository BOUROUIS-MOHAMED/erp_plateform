// src/services/reportService.js
import api from './api';

export const reportService = {
  // Récupérer tous les rapports
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/reports', { params });
      return response.data;
    } catch (error) {
      console.error('Erreur getAll reports:', error);
      throw error;
    }
  },

  // ALIAS pour compatibilité avec FacturationAdmin
  getReports: async (params = {}) => {
    return reportService.getAll(params);
  },

  // Récupérer un rapport par ID
  getById: async (id) => {
    try {
      const response = await api.get(`/reports/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur getById report ${id}:`, error);
      throw error;
    }
  },

  // Créer un rapport
  create: async (reportData) => {
    try {
      const response = await api.post('/reports', reportData);
      return response.data;
    } catch (error) {
      console.error('Erreur create report:', error);
      throw error;
    }
  },

  // Mettre à jour un rapport
  update: async (id, reportData) => {
    try {
      const response = await api.put(`/reports/${id}`, reportData);
      return response.data;
    } catch (error) {
      console.error(`Erreur update report ${id}:`, error);
      throw error;
    }
  },

  // Supprimer un rapport
  delete: async (id) => {
    try {
      const response = await api.delete(`/reports/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur delete report ${id}:`, error);
      throw error;
    }
  },

  // Générer un rapport PDF
  generatePdf: async (id) => {
    try {
      const response = await api.get(`/reports/${id}/pdf`, {
        responseType: 'blob',
        timeout: 30000
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { link.remove(); window.URL.revokeObjectURL(url); }, 200);

      return true;
    } catch (error) {
      // If it's a network/timeout error, the browser may have already downloaded the file
      if (error?.type === 'NETWORK_ERROR' || error?.type === 'TIMEOUT') {
        console.warn('PDF may have downloaded despite network error');
        return true;
      }
      console.error(`Erreur generatePdf report ${id}:`, error);
      throw error;
    }
  },

  // Générer un rapport Excel
  generateExcel: async (id) => {
    try {
      const response = await api.get(`/reports/${id}/excel`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport-${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return true;
    } catch (error) {
      console.error(`Erreur generateExcel report ${id}:`, error);
      throw error;
    }
  },

  // Récupérer les rapports par type
  getByType: async (type) => {
    try {
      const response = await api.get(`/reports/type/${type}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur getByType ${type}:`, error);
      throw error;
    }
  }
};