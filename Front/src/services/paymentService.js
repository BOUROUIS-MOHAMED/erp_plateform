// src/services/paymentService.js
import api from './api';

export const paymentService = {
  // ===== CRUD STANDARD =====
  
  /**
   * Récupère tous les paiements
   * @param {Object} params - Paramètres optionnels (page, limit, method, status, startDate, endDate)
   * @returns {Promise<Object>} Liste des paiements avec pagination
   */
  getAllPayments: async (params = {}) => {
    try {
      const response = await api.get('/payments', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAllPayments:', error);
      throw error;
    }
  },

  /**
   * ALIAS pour compatibilité
   */
  getPayments: async (params = {}) => {
    return paymentService.getAllPayments(params);
  },

  /**
   * Récupère un paiement par ID
   * @param {string} id - ID du paiement
   * @returns {Promise<Object>} Détails du paiement
   */
  getPaymentById: async (id) => {
    try {
      if (!id) throw new Error('ID du paiement requis');
      const response = await api.get(`/payments/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getPaymentById ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crée un nouveau paiement
   * @param {Object} paymentData - Données du paiement
   * @param {string} paymentData.invoiceId - ID de la facture
   * @param {number} paymentData.amount - Montant
   * @param {string} paymentData.method - Mode de paiement (carte, virement, chèque, espèces)
   * @param {string} paymentData.reference - Référence (optionnel)
   * @param {string} paymentData.notes - Notes (optionnel)
   * @returns {Promise<Object>} Paiement créé
   */
  createPayment: async (paymentData) => {
    try {
      // Validation des données requises
      if (!paymentData.invoiceId) {
        throw new Error('L\'ID de la facture est requis');
      }
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new Error('Le montant est requis et doit être positif');
      }
      if (!paymentData.method) {
        throw new Error('Le mode de paiement est requis');
      }

      const response = await api.post('/payments', {
        invoice: paymentData.invoiceId,
        amount: parseFloat(paymentData.amount),
        method: paymentData.method,
        reference: paymentData.reference?.trim() || '',
        notes: paymentData.notes?.trim() || ''
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur createPayment:', error);
      throw error;
    }
  },

  /**
   * Met à jour un paiement
   * @param {string} id - ID du paiement
   * @param {Object} paymentData - Nouvelles données
   * @returns {Promise<Object>} Paiement mis à jour
   */
  updatePayment: async (id, paymentData) => {
    try {
      if (!id) throw new Error('ID du paiement requis');

      const response = await api.put(`/payments/${id}`, {
        method: paymentData.method,
        reference: paymentData.reference?.trim(),
        notes: paymentData.notes?.trim(),
        status: paymentData.status
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updatePayment ${id}:`, error);
      throw error;
    }
  },

  /**
   * Supprime un paiement
   * @param {string} id - ID du paiement
   * @returns {Promise<Object>} Confirmation de suppression
   */
  deletePayment: async (id) => {
    try {
      if (!id) throw new Error('ID du paiement requis');
      const response = await api.delete(`/payments/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur deletePayment ${id}:`, error);
      throw error;
    }
  },

  // ===== ACTIONS SPÉCIFIQUES =====
  
  /**
   * Valide un paiement
   * @param {string} id - ID du paiement
   * @returns {Promise<Object>} Paiement validé
   */
  validatePayment: async (id) => {
    try {
      if (!id) throw new Error('ID du paiement requis');
      const response = await api.patch(`/payments/${id}/validate`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur validatePayment ${id}:`, error);
      throw error;
    }
  },

  /**
   * Annule un paiement
   * @param {string} id - ID du paiement
   * @param {string} reason - Motif d'annulation
   * @returns {Promise<Object>} Paiement annulé
   */
  cancelPayment: async (id, reason) => {
    try {
      if (!id) throw new Error('ID du paiement requis');
      const response = await api.post(`/payments/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur cancelPayment ${id}:`, error);
      throw error;
    }
  },

  // ===== STATISTIQUES =====
  
  /**
   * Récupère les statistiques des paiements
   * @param {Object} params - Paramètres (period, startDate, endDate)
   * @returns {Promise<Object>} Statistiques
   */
  getPaymentStats: async (params = {}) => {
    try {
      const response = await api.get('/payments/stats', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getPaymentStats:', error);
      throw error;
    }
  },

  // ===== FILTRES =====
  
  /**
   * Récupère les paiements par facture
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<Array>} Paiements de la facture
   */
  getByInvoice: async (invoiceId) => {
    try {
      if (!invoiceId) throw new Error('ID de la facture requis');
      const response = await api.get('/payments', { 
        params: { invoice: invoiceId } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByInvoice ${invoiceId}:`, error);
      throw error;
    }
  },

  /**
   * Récupère les paiements par méthode
   * @param {string} method - Mode de paiement
   * @returns {Promise<Array>} Paiements avec cette méthode
   */
  getByMethod: async (method) => {
    try {
      if (!method) throw new Error('La méthode de paiement est requise');
      const response = await api.get('/payments', { 
        params: { method } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByMethod ${method}:`, error);
      throw error;
    }
  },

  // ===== EXPORT =====
  
  /**
   * Exporte les paiements (CSV/Excel)
   * @param {string} format - Format d'export ('csv' ou 'excel')
   * @param {Object} params - Filtres pour l'export
   * @returns {Promise<boolean>} Succès de l'export
   */
  exportPayments: async (format = 'csv', params = {}) => {
    try {
      const response = await api.get(`/payments/export/${format}`, {
        params,
        responseType: 'blob'
      });
      
      const filename = `paiements_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
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
      console.error('❌ Erreur exportPayments:', error);
      throw error;
    }
  }
};