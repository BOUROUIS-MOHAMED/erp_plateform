// src/services/invoiceService.js
import api from './api';
export const invoiceService = {
  // ===== CRUD STANDARD =====
  /**
   * Récupérer toutes les factures
   * @param {Object} params - Paramètres (page, limit, status, customerId, startDate, endDate, sortBy, order)
   * @returns {Promise<Object>} Liste des factures avec pagination et totaux
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/invoices', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll invoices:', error);
      throw error;
    }
  },
  /**
   * Récupérer une facture par ID
   * @param {string} id - ID de la facture
   * @returns {Promise<Object>} Détails de la facture avec paiements
   */
  getById: async (id) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      const response = await api.get(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById invoice ${id}:`, error);
      throw error;
    }
  },
  /**
   * Créer une facture
   * @param {Object} invoiceData - Données de la facture
   * @returns {Promise<Object>} Facture créée
   */
  create: async (invoiceData) => {
    try {
      // Validation des données
      if (!invoiceData || typeof invoiceData !== 'object') {
        throw new Error('Données de la facture invalides');
      }
      // Validation du client
      if (!invoiceData.customer) {
        throw new Error('Le client est requis');
      }
      // Validation des articles
      if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
        throw new Error('Au moins un article est requis');
      }
      // Validation de la date d'échéance
      if (invoiceData.dueDate && new Date(invoiceData.dueDate) < new Date()) {
        throw new Error('La date d\'échéance doit être postérieure à aujourd\'hui');
      }
      const response = await api.post('/invoices', invoiceData);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create invoice:', error);
      throw error;
    }
  },
  /**
   * Mettre à jour une facture
   * @param {string} id - ID de la facture
   * @param {Object} invoiceData - Nouvelles données
   * @returns {Promise<Object>} Facture mise à jour
   */
  update: async (id, invoiceData) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      // Validation des données
      if (!invoiceData || typeof invoiceData !== 'object') {
        throw new Error('Données de la facture invalides');
      }
      // Validation de la date d'échéance si fournie
      if (invoiceData.dueDate && new Date(invoiceData.dueDate) < new Date()) {
        throw new Error('La date d\'échéance doit être postérieure à aujourd\'hui');
      }
      const response = await api.put(`/invoices/${id}`, invoiceData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update invoice ${id}:`, error);
      throw error;
    }
  },
  /**
   * Supprimer une facture
   * @param {string} id - ID de la facture
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      const response = await api.delete(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete invoice ${id}:`, error);
      throw error;
    }
  },
  // ===== ACTIONS SUR FACTURE =====
  /**
   * Valider une facture (changer statut de brouillon à envoyée)
   * @param {string} id - ID de la facture
   * @returns {Promise<Object>} Facture validée
   */
  validate: async (id) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      const response = await api.patch(`/invoices/${id}/validate`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur validate invoice ${id}:`, error);
      throw error;
    }
  },
  /**
   * Marquer une facture comme payée
   * @param {string} id - ID de la facture
   * @param {Object} paymentData - Données du paiement
   * @param {string} paymentData.paymentMethod - Mode de paiement
   * @param {number} paymentData.amount - Montant payé
   * @param {string} paymentData.reference - Référence du paiement
   * @returns {Promise<Object>} Facture mise à jour et paiement créé
   */
  markAsPaid: async (id, paymentData) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      // Validation des données de paiement
      if (!paymentData || typeof paymentData !== 'object') {
        throw new Error('Données de paiement invalides');
      }
      if (!paymentData.paymentMethod) {
        throw new Error('Le mode de paiement est requis');
      }
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new Error('Le montant doit être supérieur à 0');
      }
      const response = await api.patch(`/invoices/${id}/pay`, paymentData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur markAsPaid invoice ${id}:`, error);
      throw error;
    }
  },
  /**
   * Créer un avoir pour une facture
   * @param {string} id - ID de la facture originale
   * @param {Object} data - Données de l'avoir
   * @param {string} data.reason - Motif de l'avoir
   * @returns {Promise<Object>} Avoir créé
   */
  createCreditNote: async (id, data) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      // Validation du motif
      if (!data.reason?.trim()) {
        throw new Error('Le motif de l\'avoir est requis');
      }
      const response = await api.post(`/invoices/${id}/credit-note`, data);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur createCreditNote invoice ${id}:`, error);
      throw error;
    }
  },
  // ===== EXPORTS ET COMMUNICATION =====
  /**
   * Télécharger une facture en PDF
   * @param {string} id - ID de la facture
   * @returns {Promise<boolean>} Succès du téléchargement
   */
  downloadPdf: async (id) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      const response = await api.get(`/invoices/${id}/pdf`, {
        responseType: 'blob'
      });
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `facture-${id}-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      // Nettoyer
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      return true;
    } catch (error) {
      console.error(`❌ Erreur downloadPdf invoice ${id}:`, error);
      throw error;
    }
  },
  /**
   * Envoyer une facture par email
   * @param {string} id - ID de la facture
   * @param {string} email - Email du destinataire
   * @returns {Promise<Object>} Confirmation d'envoi
   */
  sendByEmail: async (id, email) => {
    try {
      // Validation de l'ID
      if (!id) {
        throw new Error('ID de la facture requis');
      }
      // Validation de l'email
      if (!email?.trim()) {
        throw new Error('L\'email du destinataire est requis');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Format d\'email invalide');
      }
      const response = await api.post(`/invoices/${id}/email`, { email });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur sendByEmail invoice ${id}:`, error);
      throw error;
    }
  },
  // ===== RECHERCHE ET STATISTIQUES =====
  /**
   * Recherche avancée de factures
   * @param {Object} params - Critères de recherche
   * @param {string} params.q - Terme de recherche
   * @param {string} params.customerId - ID client
   * @param {string} params.status - Statut
   * @param {number} params.minAmount - Montant minimum
   * @param {number} params.maxAmount - Montant maximum
   * @param {string} params.startDate - Date début
   * @param {string} params.endDate - Date fin
   * @param {number} params.page - Page
   * @param {number} params.limit - Limite
   * @returns {Promise<Object>} Résultats de recherche
   */
  search: async (params) => {
    try {
      const response = await api.get('/invoices/search', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur search invoices:', error);
      throw error;
    }
  }
};