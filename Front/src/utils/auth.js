// src/utils/auth.js

export const ROLE_HOME_PATH = {
  admin_principal: "/admin",
  admin_stock: "/stock",
  admin_finance: "/finance",
  admin_facture: "/facturation"
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getUserRole = () => {
  const storedRole = localStorage.getItem("userRole");
  if (storedRole) return storedRole;

  const user = getStoredUser();
  return user?.role || null;
};

export const getUserEmail = () => {
  const storedEmail = localStorage.getItem("userEmail");
  if (storedEmail) return storedEmail;

  const user = getStoredUser();
  return user?.email || null;
};

export const getHomePathForRole = (role) => {
  return ROLE_HOME_PATH[role] || "/dashboard";
};

export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  return Boolean(token && user);
};

export const persistAuth = ({ token, user }) => {
  if (!token || !user) return;

  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("isAuthenticated", "true");
  localStorage.setItem("userRole", user.role || "");
  localStorage.setItem("userEmail", user.email || "");
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
};

//  Fonctions utilitaires supplémentaires utiles
export const getUserName = () => {
  const user = getStoredUser();
  return user?.name || user?.username || null;
};

export const getUserId = () => {
  const user = getStoredUser();
  return user?.id || null;
};

export const hasRole = (role) => {
  const userRole = getUserRole();
  return userRole === role;
};

export const hasAnyRole = (roles) => {
  const userRole = getUserRole();
  return roles.includes(userRole);
};

export const redirectToHome = (navigate) => {
  const role = getUserRole();
  const homePath = getHomePathForRole(role);
  navigate(homePath);
};