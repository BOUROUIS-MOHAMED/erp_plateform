// src/services/accountService.js
import api from './api';

export const accountService = {
  // ===== CRUD STANDARD =====
  //de voir les comptes dans l'interface
  /**
   * Récupère tous les comptes
   * @param {Object} params - Paramètres optionnels (page, limit, type, status, search)
   * @returns {Promise<Object>} Liste des comptes avec pagination
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/accounts', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll accounts:', error);
      throw error;
    }
  },
  /**
   * ALIAS pour compatibilité
   */
  getAccounts: async (params = {}) => {
    return accountService.getAll(params);
  },
  /**
   * Récupère un compte par ID
   * @param {string} id - ID du compte
   * @returns {Promise<Object>} Détails du compte
   */
  getById: async (id) => {
    try {
      if (!id) throw new Error('ID du compte requis');
      const response = await api.get(`/accounts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById account ${id}:`, error);
      throw error;
    }
  },
  /**
   * Crée un nouveau compte
   * @param {Object} accountData - Données du compte
   * @param {string} accountData.name - Nom du compte
   * @param {string} accountData.type - Type de compte (Banque, Épargne, Créance, Dette)
   * @param {number} accountData.balance - Solde initial
   * @param {string} accountData.number - Numéro de compte (optionnel)
   * @param {string} accountData.iban - IBAN (optionnel)
   * @param {string} accountData.bic - BIC (optionnel)
   * @param {string} accountData.status - Statut (actif/inactif)
   * @returns {Promise<Object>} Compte créé
   */
  create: async (accountData) => {
    try {
      // Validation des données requises
      if (!accountData.name?.trim()) {
        throw new Error('Le nom du compte est requis');
      }
      if (!accountData.type) {
        throw new Error('Le type de compte est requis');
      }
      const response = await api.post('/accounts', {
        name: accountData.name.trim(),
        type: accountData.type,
        balance: parseFloat(accountData.balance) || 0,
        number: accountData.number?.trim() || '',
        iban: accountData.iban?.trim() || '',
        bic: accountData.bic?.trim() || '',
        status: accountData.status || 'actif',
        inMoneyFlow: Boolean(accountData.inMoneyFlow ?? accountData.inBudget)
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create account:', error);
      throw error;
    }
  },
  /**
   * Met à jour un compte
   * @param {string} id - ID du compte
   * @param {Object} accountData - Nouvelles données
   * @returns {Promise<Object>} Compte mis à jour
   */
  update: async (id, accountData) => {
    try {
      if (!id) throw new Error('ID du compte requis');
      const response = await api.put(`/accounts/${id}`, {
        name: accountData.name?.trim(),
        type: accountData.type,
        balance: accountData.balance !== undefined ? parseFloat(accountData.balance) || 0 : undefined,
        number: accountData.number?.trim(),
        iban: accountData.iban?.trim(),
        bic: accountData.bic?.trim(),
        status: accountData.status,
        notes: accountData.notes?.trim(),
        inMoneyFlow: (accountData.inMoneyFlow !== undefined || accountData.inBudget !== undefined)
          ? Boolean(accountData.inMoneyFlow ?? accountData.inBudget)
          : undefined
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update account ${id}:`, error);
      throw error;
    }
  },
  /**
   * Supprime un compte
   * @param {string} id - ID du compte
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      if (!id) throw new Error('ID du compte requis');
      const response = await api.delete(`/accounts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete account ${id}:`, error);
      throw error;
    }
  },
  // ===== FONCTIONS DE SOLDE =====
  /**
   * Récupère le solde d'un compte
   * @param {string} id - ID du compte
   * @returns {Promise<Object>} Solde du compte
   */
  getBalance: async (id) => {
    try {
      if (!id) throw new Error('ID du compte requis');
      const response = await api.get(`/accounts/${id}/balance`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getBalance account ${id}:`, error);
      throw error;
    }
  },
  /**
   * Met à jour le solde d'un compte
   * @param {string} id - ID du compte
   * @param {number} amount - Montant à ajouter (positif) ou retirer (négatif)
   * @returns {Promise<Object>} Compte mis à jour
   */
  updateBalance: async (id, amount) => {
    try {
      if (!id) throw new Error('ID du compte requis');
      if (amount === undefined || amount === null) {
        throw new Error('Le montant est requis');
      }
      const response = await api.patch(`/accounts/${id}/balance`, {
        amount: parseFloat(amount)
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updateBalance account ${id}:`, error);
      throw error;
    }
  },
  // ===== FONCTIONS DE RELATIONS =====
  /**
   * Récupère les transactions d'un compte
   * @param {string} id - ID du compte
   * @param {Object} params - Paramètres optionnels (page, limit, startDate, endDate)
   * @returns {Promise<Object>} Liste des transactions du compte
   */
  getTransactions: async (id, params = {}) => {
    try {
      if (!id) throw new Error('ID du compte requis');
      const response = await api.get(`/accounts/${id}/transactions`, { params });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getTransactions account ${id}:`, error);
      throw error;
    }
  },
  // ===== FONCTIONS DE RECHERCHE ET FILTRAGE =====
  /**
   * Récupère les comptes par type
   * @param {string} type - Type de compte
   * @returns {Promise<Array>} Comptes du type spécifié
   */
  getByType: async (type) => {
    try {
      if (!type) throw new Error('Le type est requis');
      const response = await api.get('/accounts', { 
        params: { type } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByType ${type}:`, error);
      throw error;
    }
  },
  /**
   * Récupère les comptes par statut
   * @param {string} status - Statut (actif/inactif)
   * @returns {Promise<Array>} Comptes avec le statut spécifié
   */
  getByStatus: async (status) => {
    try {
      if (!status) throw new Error('Le statut est requis');
      const response = await api.get('/accounts', { 
        params: { status } 
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getByStatus ${status}:`, error);
      throw error;
    }
  },
  /**
   * Recherche avancée de comptes
   * @param {string} query - Terme de recherche
   * @returns {Promise<Array>} Résultats de recherche
   */
  search: async (query) => {
    try {
      if (!query) throw new Error('Terme de recherche requis');
      const response = await api.get('/accounts/search', { 
        params: { q: query } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur search accounts:', error);
      throw error;
    }
  },
};
