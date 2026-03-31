// src/services/clientService.js
import api from './api';

const normalizePayload = (clientData = {}) => {
  if (clientData.company || clientData.firstName || clientData.lastName || clientData.address?.street) {
    return {
      ...clientData,
      email: clientData.email?.trim()?.toLowerCase() || '',
      phone: clientData.phone?.trim() || ''
    };
  }

  return {
    ...clientData,
    name: clientData.name?.trim(),
    email: clientData.email?.trim()?.toLowerCase() || '',
    phone: clientData.phone?.trim() || ''
  };
};

export const clientService = {
  normalizePayload,

  // Recuperer tous les clients
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/customers', { params });
      return response.data;
    } catch (error) {
      console.error('Erreur getAll clients:', error);
      throw error;
    }
  },

  // Alias pour compatibilite avec FacturationAdmin
  getClients: async (params = {}) => {
    return clientService.getAll(params);
  },

  // Recuperer un client par ID
  getById: async (id) => {
    try {
      if (!id) {
        throw new Error('ID du client requis');
      }

      const response = await api.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur getById client ${id}:`, error);
      throw error;
    }
  },

  // Creer un client
  create: async (clientData) => {
    try {
      if (!clientData || typeof clientData !== 'object') {
        throw new Error('Donnees client invalides');
      }

      const payload = normalizePayload(clientData);
      const displayName =
        payload.name ||
        payload.company ||
        [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim();

      if (!displayName) {
        throw new Error('Le nom du client est requis');
      }
      if (displayName.length > 100) {
        throw new Error('Le nom ne peut pas depasser 100 caracteres');
      }

      if (!payload.email) {
        throw new Error("L'email est requis");
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        throw new Error("Format d'email invalide");
      }

      if (!payload.phone) {
        throw new Error('Le telephone est requis');
      }
      const phoneRegex = /^[0-9+\-\s]+$/;
      if (!phoneRegex.test(payload.phone)) {
        throw new Error('Format de telephone invalide');
      }

      if (payload.siret) {
        const siretRegex = /^\d{14}$/;
        if (!siretRegex.test(payload.siret.replace(/\s/g, ''))) {
          throw new Error('Le SIRET doit contenir 14 chiffres');
        }
      }

      const response = await api.post('/customers', payload);
      return response.data;
    } catch (error) {
      console.error('Erreur create client:', error);
      throw error;
    }
  },

  // Mettre a jour un client
  update: async (id, clientData) => {
    try {
      if (!id) {
        throw new Error('ID du client requis');
      }
      if (!clientData || typeof clientData !== 'object') {
        throw new Error('Donnees client invalides');
      }

      const updatedData = normalizePayload(clientData);

      if (updatedData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updatedData.email)) {
          throw new Error("Format d'email invalide");
        }
      }

      if (updatedData.phone) {
        const phoneRegex = /^[0-9+\-\s]+$/;
        if (!phoneRegex.test(updatedData.phone)) {
          throw new Error('Format de telephone invalide');
        }
      }

      const displayName =
        updatedData.name ||
        updatedData.company ||
        [updatedData.firstName, updatedData.lastName].filter(Boolean).join(' ').trim();

      if (displayName && displayName.length > 100) {
        throw new Error('Le nom ne peut pas depasser 100 caracteres');
      }

      if (updatedData.siret) {
        const siretRegex = /^\d{14}$/;
        if (!siretRegex.test(updatedData.siret.replace(/\s/g, ''))) {
          throw new Error('Le SIRET doit contenir 14 chiffres');
        }
      }

      const response = await api.put(`/customers/${id}`, updatedData);
      return response.data;
    } catch (error) {
      console.error(`Erreur update client ${id}:`, error);
      throw error;
    }
  },

  // Supprimer un client
  delete: async (id) => {
    try {
      if (!id) {
        throw new Error('ID du client requis');
      }

      const response = await api.delete(`/customers/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur delete client ${id}:`, error);
      throw error;
    }
  },

  // Recherche de clients
  search: async (query) => {
    try {
      if (!query?.trim()) {
        throw new Error('Terme de recherche requis');
      }

      const response = await api.get('/customers/search', {
        params: { q: query.trim() }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur search clients:', error);
      throw error;
    }
  },

  // Recuperer les commandes d'un client
  getOrders: async (clientId) => {
    try {
      if (!clientId) {
        throw new Error('ID du client requis');
      }

      const response = await api.get(`/customers/${clientId}/orders`);
      return response.data;
    } catch (error) {
      console.error(`Erreur getOrders client ${clientId}:`, error);
      throw error;
    }
  },

  // Recuperer les factures d'un client
  getInvoices: async (clientId) => {
    try {
      if (!clientId) {
        throw new Error('ID du client requis');
      }

      const response = await api.get(`/customers/${clientId}/invoices`);
      return response.data;
    } catch (error) {
      console.error(`Erreur getInvoices client ${clientId}:`, error);
      throw error;
    }
  }
};

export const customerService = clientService;
export default clientService;
