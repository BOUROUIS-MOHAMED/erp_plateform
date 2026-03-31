// src/services/moduleService.js
import api from './api';

export const moduleService = {
  // Récupérer les modules de base
  getBaseModules: async () => {
    try {
      const response = await api.get('/modules/base');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getBaseModules:', error);
      throw error;
    }
  },

  // Récupérer les modules personnalisés
  getCustomModules: async () => {
    try {
      const response = await api.get('/modules/custom');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getCustomModules:', error);
      throw error;
    }
  },

  // ✅ VALIDATION RENFORCÉE pour activer/désactiver un module
  toggleModule: async (moduleId, active) => {
    try {
      // Validation de l'ID
      if (!moduleId) {
        throw new Error('ID du module requis');
      }

      // Validation du type d'ID
      if (typeof moduleId !== 'string' && typeof moduleId !== 'number') {
        throw new Error('ID du module invalide');
      }

      // Validation du statut actif (doit être un booléen)
      if (active === undefined || active === null) {
        throw new Error('Le statut (actif/inactif) est requis');
      }

      if (typeof active !== 'boolean') {
        throw new Error('Le statut doit être un booléen (true/false)');
      }

      // Préparation des données
      const data = { 
        active: active,
        updatedAt: new Date().toISOString()
      };

      const response = await api.patch(`/modules/${moduleId}/toggle`, data);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur toggleModule ${moduleId}:`, error);
      throw error;
    }
  },

  // Créer un module personnalisé
  createCustomModule: async (moduleData) => {
    try {
      // Validation des données
      if (!moduleData || typeof moduleData !== 'object') {
        throw new Error('Données du module invalides');
      }

      // Validation du nom
      if (!moduleData.name?.trim()) {
        throw new Error('Le nom du module est requis');
      }

      const response = await api.post('/modules/custom', moduleData);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur createCustomModule:', error);
      throw error;
    }
  },

};