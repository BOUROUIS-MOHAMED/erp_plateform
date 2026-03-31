// src/services/api.js
import axios from 'axios';
import { clearAuth } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const IS_DEV = import.meta.env.MODE === 'development';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000,
});

const isAuthRequest = (url = '') =>
  url.includes('/auth/login') || url.includes('/auth/refresh-token');

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (IS_DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      if (config.data) {
        console.log('[API] Payload:', config.data);
      }
    }

    return config;
  },
  (error) => {
    if (IS_DEV) {
      console.error('[API] Request error:', error);
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      console.log(`[API] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Timeout');
      return Promise.reject({
        message: 'Le serveur met trop de temps à répondre',
        type: 'TIMEOUT',
      });
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      console.error(`[API] Error ${status}:`, data);

      if (status === 401) {
        const requestUrl = error.config?.url || '';
        const hasStoredSession = !!localStorage.getItem('token');

        if (!isAuthRequest(requestUrl) && hasStoredSession) {
          clearAuth();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }

        return Promise.reject({
          message: data.message || 'Session expirée',
          type: 'UNAUTHORIZED',
          status,
          data,
        });
      }

      if (status === 403) {
        return Promise.reject({
          message: data.message || 'Accès non autorisé',
          type: 'FORBIDDEN',
          status,
          data,
        });
      }

      if (status === 404) {
        return Promise.reject({
          message: data.message || 'Ressource non trouvée',
          type: 'NOT_FOUND',
          status,
          data,
        });
      }

      if (status >= 500) {
        return Promise.reject({
          message: data.message || 'Erreur serveur',
          type: 'SERVER_ERROR',
          status,
          data,
        });
      }

      return Promise.reject({
        message: data.message || `Erreur ${status}`,
        type: 'API_ERROR',
        status,
        data,
      });
    }

    if (error.request) {
      console.error('[API] No response from server');
      return Promise.reject({
        message: 'Impossible de contacter le serveur',
        type: 'NETWORK_ERROR',
      });
    }

    console.error('[API] Unknown error:', error.message);
    return Promise.reject({
      message: error.message || 'Erreur inconnue',
      type: 'UNKNOWN_ERROR',
    });
  }
);

export default api;
