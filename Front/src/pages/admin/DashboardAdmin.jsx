// src/pages/admin/DashboardAdmin.jsx
import React, { useEffect, useState } from 'react';
import userService from '../../services/userService';
import { extractApiErrorMessage } from '../../utils/frontendApiAdapters';

const DashboardAdmin = () => {
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    message: 'Bienvenue dans le dashboard admin',
  });

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const response = await userService.getUsers();
        const users = response?.data || [];
        const activeUsers = users.filter((user) => user.isActive !== false).length;

        if (!mounted) {
          return;
        }

        setSummary({
          totalUsers: users.length,
          activeUsers,
          message:
            users.length > 0
              ? `${activeUsers} compte(s) actif(s) sur ${users.length}`
              : 'Aucun compte trouvé dans le backend',
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setSummary((current) => ({
          ...current,
          message: extractApiErrorMessage(error, 'Impossible de charger le dashboard admin'),
        }));
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard Administrateur</h1>
      <p>{summary.message}</p>
    </div>
  );
};

export default DashboardAdmin;

