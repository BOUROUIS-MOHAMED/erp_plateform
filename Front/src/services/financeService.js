// src/services/financeService.js
import api from './api';

const financeService = {
  

  // ===== ANALYSES FINANCIÈRES =====
  
  /**
   * Récupère le flux de trésorerie
   * @param {Object} params - Paramètres (period, startDate, endDate)
   * @returns {Promise<Object>} Données de trésorerie
   */
  getCashFlow: async (params = {}) => {
    try {
      const response = await api.get('/finance/cashflow', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getCashFlow:', error);
      throw error;
    }
  },

  // ===== COMPTE DE R?SULTAT =====
  /**
   * Récupère le compte de résultat
   * @param {string} period - Période (monthly, quarterly, yearly)
   * @returns {Promise<Object>} Compte de résultat
   */
  getProfitLoss: async (period = 'monthly') => {
    try {
      const response = await api.get('/finance/profit-loss', { 
        params: { period } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getProfitLoss:', error);
      throw error;
    }
  },

  /**
   * Récupère le bilan comptable
   * @param {string} date - Date du bilan
   * @returns {Promise<Object>} Bilan comptable
   */
  getBalanceSheet: async (date) => {
    try {
      const response = await api.get('/finance/balance-sheet', { 
        params: { date } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getBalanceSheet:', error);
      throw error;
    }
  },

  /**
   * Récupère les ratios financiers
   * @returns {Promise<Object>} Ratios financiers
   */
  getFinancialRatios: async () => {
    try {
      const response = await api.get('/finance/ratios');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getFinancialRatios:', error);
      throw error;
    }
  },

  // ===== EXPORTS =====
  
  /**
   * Exporte un rapport financier en PDF
   * @param {string} type - Type de rapport (dashboard, cashflow, profit-loss, balance-sheet)
   * @param {Object} params - Paramètres du rapport
   * @returns {Promise<boolean>} Succès de l'export
   */
  exportToPDF: async (type, params = {}) => {
    try {
      const response = await api.get(`/finance/export/pdf/${type}`, {
        params,
        responseType: 'blob'
      });
      
      const filename = `rapport-financier-${type}-${new Date().toISOString().split('T')[0]}.pdf`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur exportToPDF:', error);
      throw error;
    }
  },

  /**
   * Exporte un rapport financier en Excel
   * @param {string} type - Type de rapport (dashboard, cashflow, profit-loss, balance-sheet)
   * @param {Object} params - Paramètres du rapport
   * @returns {Promise<boolean>} Succès de l'export
   */
  exportToExcel: async (type, params = {}) => {
    try {
      const response = await api.get(`/finance/export/excel/${type}`, {
        params,
        responseType: 'blob'
      });
      
      const filename = `rapport-financier-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur exportToExcel:', error);
      throw error;
    }
  },

  // ===== PRÉVISIONS =====
  
  /**
   * Récupère les prévisions financières
   * @param {Object} params - Paramètres (period, months)
   * @returns {Promise<Object>} Données de prévision
   */
  getForecasts: async (params = {}) => {
    try {
      const response = await api.get('/finance/forecasts', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getForecasts:', error);
      throw error;
    }
  }
};

export default financeService;