import { useEffect, useState } from "react";
import userService from "../services/userService";
import { getStoredUser, getUserRole } from "../utils/auth";

export const MODULE_ROLE_MAP = {
  facturation: "admin_facture",
  stock: "admin_stock",
  finance: "admin_finance",
};

const isModuleBlockedForRole = (role, moduleId, moduleAccess = {}) => (
  role !== "admin_principal"
  && MODULE_ROLE_MAP[moduleId] === role
  && moduleAccess?.[moduleId] === false
);

export const useModuleAvailability = (moduleId) => {
  const role = getUserRole();
  const [blocked, setBlocked] = useState(() => {
    const storedAccess = getStoredUser()?.moduleAccess || {};
    return isModuleBlockedForRole(role, moduleId, storedAccess);
  });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const loadAvailability = async () => {
      if (!role || role === "admin_principal" || MODULE_ROLE_MAP[moduleId] !== role) {
        if (active) {
          setBlocked(false);
          setChecking(false);
        }
        return;
      }

      try {
        const response = await userService.getProfile();
        const profile = response?.data || response;

        if (!active) {
          return;
        }

        setBlocked(isModuleBlockedForRole(role, moduleId, profile?.moduleAccess || {}));
      } catch {
        if (active) {
          const storedAccess = getStoredUser()?.moduleAccess || {};
          setBlocked(isModuleBlockedForRole(role, moduleId, storedAccess));
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    loadAvailability();

    return () => {
      active = false;
    };
  }, [moduleId, role]);

  return { blocked, checking, role };
};
