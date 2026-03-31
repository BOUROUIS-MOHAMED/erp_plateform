// src/services/authService.js
import api from './api';
import { persistAuth, clearAuth, getStoredUser } from '../utils/auth';

const authService = {
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.success && response.data.token) {
        persistAuth({
          token: response.data.token,
          user: response.data.user,
        });

        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
      }

      return {
        success: false,
        message: response.data.message || 'Erreur de connexion',
      };
    } catch (error) {
      console.error('Erreur login:', error);

      return {
        success: false,
        message: error?.message || 'Erreur de connexion au serveur',
      };
    }
  },

  logout: () => {
    clearAuth();
    window.location.href = '/login';
  },

  refreshToken: async () => {
    try {
      const response = await api.post('/auth/refresh-token');

      if (response.data.success && response.data.token) {
        const currentUser = getStoredUser();
        persistAuth({
          token: response.data.token,
          user: currentUser,
        });

        return {
          success: true,
          token: response.data.token,
        };
      }

      return { success: false };
    } catch (error) {
      console.error('Erreur refreshToken:', error);
      return { success: false };
    }
  },

  getCurrentUser: () => getStoredUser(),

  isAuthenticated: () => !!localStorage.getItem('token') && !!getStoredUser(),

  getToken: () => localStorage.getItem('token'),
};

export default authService;
