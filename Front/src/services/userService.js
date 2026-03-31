// src/services/userService.js - VERSION COMPLÈTE ET AMÉLIORÉE
import api from './api';
import { persistAuth, getStoredUser, clearAuth } from '../utils/auth';

const userService = {
  // ===== PROFIL UTILISATEUR =====
  /**
   * Récupère le profil de l'utilisateur connecté
   * @returns {Promise<Object>} Données du profil
   */
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getProfile:', error);
      throw error;
    }
  },
  /**
   * ALIAS pour compatibilité
   * @returns {Promise<Object>} Données du profil
   */
  getCurrentUser: async () => {
    return userService.getProfile();
  },
  /**
   * Met à jour le profil utilisateur
   * @param {Object} userData - Nouvelles données
   * @param {string} userData.firstName - Prénom
   * @param {string} userData.lastName - Nom
   * @param {string} userData.email - Email
   * @param {string} userData.phone - Téléphone (optionnel)
   * @param {string} userData.department - Département (optionnel)
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  updateProfile: async (userData) => {
    try {
      // Validation des données
      if (!userData.firstName?.trim()) {
        throw new Error('Le prénom est requis');
      }
      if (!userData.lastName?.trim()) {
        throw new Error('Le nom est requis');
      }
      if (!userData.email?.trim()) {
        throw new Error('L\'email est requis');
      }

      const response = await api.put('/users/profile', {
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.trim().toLowerCase(),
        phone: userData.phone?.trim() || '',
        department: userData.department?.trim() || ''
      });
      
      // Mise à jour du localStorage si succès
      if (response.data?.success) {
        const currentUser = getStoredUser();
        const updatedUser = { 
          ...currentUser, 
          ...response.data.data || userData 
        };
        
        persistAuth({
          token: localStorage.getItem('token'),
          user: updatedUser
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Erreur updateProfile:', error);
      throw error;
    }
  },

  /**
   * Change le mot de passe
   * @param {string} currentPassword - Mot de passe actuel
   * @param {string} newPassword - Nouveau mot de passe
   * @returns {Promise<Object>} Résultat du changement
   */
  changePassword: async (currentPassword, newPassword) => {
    try {
      // Validation
      if (!currentPassword) {
        throw new Error('Le mot de passe actuel est requis');
      }
      if (!newPassword) {
        throw new Error('Le nouveau mot de passe est requis');
      }
      if (newPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      }

      const response = await api.post('/users/change-password', {
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur changePassword:', error);
      throw error;
    }
  },

  /**
   * Récupère les préférences d'un module
   * @param {string} module - Nom du module (stock, finance, facturation)
   * @returns {Promise<Object>} Préférences du module
   */
  getPreferences: async (module) => {
    try {
      if (!module) {
        throw new Error('Le nom du module est requis');
      }

      const response = await api.get(`/users/preferences/${module}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getPreferences ${module}:`, error);
      throw error;
    }
  },

  /**
   * Met à jour les préférences d'un module
   * @param {string} module - Nom du module
   * @param {Object} preferences - Nouvelles préférences
   * @returns {Promise<Object>} Préférences mises à jour
   */
  updatePreferences: async (module, preferences) => {
    try {
      if (!module) {
        throw new Error('Le nom du module est requis');
      }
      if (!preferences || typeof preferences !== 'object') {
        throw new Error('Les préférences sont requises');
      }

      const response = await api.put(`/users/preferences/${module}`, preferences);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur updatePreferences ${module}:`, error);
      throw error;
    }
  },

  // ===== SESSION =====
  
  /**
   * Vérifie si l'utilisateur est authentifié
   * @returns {boolean} True si authentifié
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('token') && !!getStoredUser();
  },

  /**
   * Récupère le token JWT
   * @returns {string|null} Token ou null
   */
  getToken: () => {
    return localStorage.getItem('token');
  },

  /**
   * Récupère le rôle de l'utilisateur connecté
   * @returns {string|null} Rôle ou null
   */
  getUserRole: () => {
    const user = getStoredUser();
    return user?.role || null;
  },

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   * @param {string|string[]} roles - Rôle ou liste de rôles autorisés
   * @returns {boolean} True si autorisé
   */
  hasRole: (roles) => {
    const userRole = userService.getUserRole();
    if (!userRole) return false;
    
    if (Array.isArray(roles)) {
      return roles.includes(userRole);
    }
    return userRole === roles;
  },

  /**
   * Déconnecte l'utilisateur
   */
  logout: () => {
    clearAuth();
    window.location.href = '/login';
  },

  // ===== FONCTIONS ADMIN =====
  
  /**
   * Récupère tous les utilisateurs (admin)
   * @param {Object} params - Paramètres de filtrage
   * @param {number} params.page - Numéro de page
   * @param {number} params.limit - Nombre d'éléments par page
   * @param {string} params.role - Filtre par rôle
   * @param {string} params.department - Filtre par département
   * @param {boolean} params.isActive - Filtre par statut actif
   * @param {string} params.search - Recherche textuelle
   * @returns {Promise<Object>} Liste des utilisateurs
   */
  getAllUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAllUsers:', error);
      throw error;
    }
  },

  /**
   * ALIAS pour compatibilité
   * @param {Object} params - Paramètres de filtrage
   * @returns {Promise<Object>} Liste des utilisateurs
   */
  getUsers: async (params = {}) => {
    return userService.getAllUsers(params);
  },

  /**
   * Récupère un utilisateur par ID (admin)
   * @param {string} id - ID de l'utilisateur
   * @returns {Promise<Object>} Données de l'utilisateur
   */
  getUserById: async (id) => {
    try {
      if (!id) throw new Error('ID utilisateur requis');
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getUserById:', error);
      throw error;
    }
  },

  /**
   * Crée un nouvel utilisateur (admin)
   * @param {Object} userData - Données du nouvel utilisateur
   * @param {string} userData.firstName - Prénom
   * @param {string} userData.lastName - Nom
   * @param {string} userData.email - Email
   * @param {string} userData.password - Mot de passe
   * @param {string} userData.phone - Téléphone (optionnel)
   * @param {string} userData.department - Département (optionnel)
   * @param {string} userData.role - Rôle (admin_principal, admin_stock, etc.)
   * @returns {Promise<Object>} Utilisateur créé
   */
  createUser: async (userData) => {
    try {
      // Validation
      if (!userData.firstName?.trim()) {
        throw new Error('Le prénom est requis');
      }
      if (!userData.lastName?.trim()) {
        throw new Error('Le nom est requis');
      }
      if (!userData.email?.trim()) {
        throw new Error('L\'email est requis');
      }
      if (!userData.password || userData.password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères');
      }

      const response = await api.post('/users', {
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        phone: userData.phone?.trim() || '',
        department: userData.department?.trim() || '',
        role: userData.role || 'employe'
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur createUser:', error);
      throw error;
    }
  },

  /**
   * Met à jour un utilisateur (admin)
   * @param {string} id - ID de l'utilisateur
   * @param {Object} userData - Nouvelles données
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  updateUser: async (id, userData) => {
    try {
      if (!id) throw new Error('ID utilisateur requis');

      const response = await api.put(`/users/${id}`, {
        firstName: userData.firstName?.trim(),
        lastName: userData.lastName?.trim(),
        email: userData.email?.trim()?.toLowerCase(),
        phone: userData.phone?.trim(),
        department: userData.department?.trim(),
        role: userData.role,
        isActive: userData.isActive
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur updateUser:', error);
      throw error;
    }
  },

  /**
   * Supprime un utilisateur (admin)
   * @param {string} id - ID de l'utilisateur
   * @returns {Promise<Object>} Confirmation de suppression
   */
  deleteUser: async (id) => {
    try {
      if (!id) throw new Error('ID utilisateur requis');
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur deleteUser:', error);
      throw error;
    }
  },

  /**
   * Active/désactive un utilisateur (admin)
   * @param {string} id - ID de l'utilisateur
   * @returns {Promise<Object>} Nouveau statut
   */
  toggleUserStatus: async (id) => {
    try {
      if (!id) throw new Error('ID utilisateur requis');
      const response = await api.patch(`/users/${id}/toggle`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur toggleUserStatus:', error);
      throw error;
    }
  },

  /**
   * Réinitialise le mot de passe d'un utilisateur (admin)
   * @param {string} id - ID de l'utilisateur
   * @param {string} newPassword - Nouveau mot de passe
   * @returns {Promise<Object>} Confirmation
   */
  resetUserPassword: async (id, newPassword) => {
    try {
      if (!id) throw new Error('ID utilisateur requis');
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      }

      const response = await api.post(`/users/${id}/reset-password`, { newPassword });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur resetUserPassword:', error);
      throw error;
    }
  },

  // ===== RÔLES ET PERMISSIONS =====
  
  /**
   * Récupère la liste des rôles disponibles
   * @returns {Promise<Array>} Liste des rôles
   */
  getRoles: async () => {
    try {
      const response = await api.get('/users/roles');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getRoles:', error);
      throw error;
    }
  },

  /**
   * Récupère les permissions d'un rôle
   * @param {string} role - Nom du rôle
   * @returns {Promise<Array>} Liste des permissions
   */
  getPermissions: async (role) => {
    try {
      if (!role) throw new Error('Le rôle est requis');
      const response = await api.get(`/users/roles/${role}/permissions`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getPermissions:', error);
      throw error;
    }
  },

  // ===== STATISTIQUES =====
  
  /**
   * Récupère les statistiques des utilisateurs
   * @returns {Promise<Object>} Statistiques
   */
  getUserStats: async () => {
    try {
      const response = await api.get('/users/stats');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getUserStats:', error);
      throw error;
    }
  },

  // ===== RECHERCHE =====
  
  /**
   * Recherche avancée d'utilisateurs
   * @param {string} query - Terme de recherche
   * @returns {Promise<Array>} Résultats de recherche
   */
  searchUsers: async (query) => {
    try {
      if (!query) throw new Error('Terme de recherche requis');
      const response = await api.get('/users/search', { 
        params: { q: query } 
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur searchUsers:', error);
      throw error;
    }
  },

  // ===== EXPORT =====
  
  /**
   * Exporte la liste des utilisateurs
   * @param {string} format - Format d'export ('csv' ou 'excel')
   * @param {Object} params - Filtres pour l'export
   * @returns {Promise<boolean>} Succès de l'export
   */
  exportUsers: async (format = 'csv', params = {}) => {
    try {
      const response = await api.get(`/users/export/${format}`, {
        params,
        responseType: 'blob'
      });
      
      const filename = `utilisateurs_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
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
      console.error('❌ Erreur exportUsers:', error);
      throw error;
    }
  }
};

export default userService;