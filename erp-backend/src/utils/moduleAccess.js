const User = require('../models/User');

const DEFAULT_MODULE_ACCESS = Object.freeze({
  facturation: true,
  stock: true,
  finance: true,
});

const ROLE_MODULE_MAP = Object.freeze({
  admin_facture: 'facturation',
  admin_stock: 'stock',
  admin_finance: 'finance',
});

const normalizeModuleAccess = (adminPreferences = {}) => {
  const moduleAccess = { ...DEFAULT_MODULE_ACCESS };

  if (Array.isArray(adminPreferences?.modules)) {
    adminPreferences.modules.forEach((module) => {
      if (!module || typeof module.id !== 'string') {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(moduleAccess, module.id)) {
        moduleAccess[module.id] = module.active !== false;
      }
    });
  }

  if (adminPreferences?.moduleStates && typeof adminPreferences.moduleStates === 'object') {
    Object.entries(adminPreferences.moduleStates).forEach(([moduleId, active]) => {
      if (Object.prototype.hasOwnProperty.call(moduleAccess, moduleId)) {
        moduleAccess[moduleId] = active !== false;
      }
    });
  }

  return moduleAccess;
};

const getUserPreferenceValue = (user, moduleKey) => {
  if (!user?.preferences) {
    return {};
  }

  if (typeof user.preferences.get === 'function') {
    return user.preferences.get(moduleKey) || {};
  }

  return user.preferences[moduleKey] || {};
};

const setUserPreferenceValue = (user, moduleKey, value) => {
  if (!user.preferences) {
    user.preferences = new Map();
  }

  if (typeof user.preferences.set === 'function') {
    user.preferences.set(moduleKey, value);
  } else {
    user.preferences[moduleKey] = value;
  }

  if (typeof user.markModified === 'function') {
    user.markModified('preferences');
  }

  return value;
};

const getGlobalModuleAccess = async () => {
  const adminUser = await User.findOne({ role: 'admin_principal' })
    .sort({ updatedAt: -1, createdAt: 1 })
    .select('preferences');

  if (!adminUser) {
    return { ...DEFAULT_MODULE_ACCESS };
  }

  return normalizeModuleAccess(getUserPreferenceValue(adminUser, 'admin'));
};

const getModuleForRole = (role) => ROLE_MODULE_MAP[role] || null;

const isModuleEnabledForRole = (role, moduleAccess = DEFAULT_MODULE_ACCESS) => {
  const moduleId = getModuleForRole(role);

  if (!moduleId) {
    return true;
  }

  return moduleAccess[moduleId] !== false;
};

module.exports = {
  DEFAULT_MODULE_ACCESS,
  ROLE_MODULE_MAP,
  normalizeModuleAccess,
  getUserPreferenceValue,
  setUserPreferenceValue,
  getGlobalModuleAccess,
  getModuleForRole,
  isModuleEnabledForRole,
};
