// src/pages/finance/DashboardFinancier.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole } from '../../utils/auth';
import api from '../../services/api';
import { extractApiErrorMessage, mapTransactionToUi } from '../../utils/frontendApiAdapters';
import './DashboardFinancier.css';

const DashboardFinancier = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({
    revenus: 0,
    depenses: 0,
    benefice: 0,
  });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const [financeResponse, transactionResponse] = await Promise.all([
          api.get('/finance/dashboard'),
          api.get('/transactions', { params: { limit: 10 } }),
        ]);

        if (!mounted) {
          return;
        }

        const financeData = financeResponse.data?.data || {};
        const mappedTransactions = (transactionResponse.data?.data || []).map(mapTransactionToUi);

        setTransactions(mappedTransactions);
        setTotals({
          revenus: Number(financeData.revenue?.monthly || 0),
          depenses: Number(financeData.expenses?.monthly || 0),
          benefice: Number(financeData.profit?.monthly || 0),
        });
        setErrorMessage('');
      } catch (error) {
        if (!mounted) {
          return;
        }

        setTransactions([]);
        setTotals({ revenus: 0, depenses: 0, benefice: 0 });
        setErrorMessage(extractApiErrorMessage(error, 'Impossible de charger les données financières'));
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRetour = () => {
    if (userRole === 'admin_principal') {
      navigate('/admin');
      return;
    }

    if (userRole === 'admin_finance') {
      navigate('/finance');
      return;
    }

    navigate('/');
  };

  return (
    <div className="dashboard-financier">
      <button
        className="back-button"
        onClick={handleRetour}
        style={{
          padding: '10px 20px',
          marginBottom: '20px',
          background: userRole === 'admin_principal' ? '#667eea' : '#4299e1',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '1rem',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = userRole === 'admin_principal' ? '#5a67d8' : '#3182ce';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = userRole === 'admin_principal' ? '#667eea' : '#4299e1';
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>←</span>
        {userRole === 'admin_principal' ? "Retour à l'administration" : 'Retour à la gestion financière'}
      </button>

      <h1>Dashboard Financier</h1>

      {errorMessage && (
        <div style={{ marginBottom: '16px', color: '#c53030', fontWeight: 600 }}>
          {errorMessage}
        </div>
      )}

      <div className="stats">
        <div className="stat-card revenu">
          <h3>Revenus</h3>
          <p>{totals.revenus} €</p>
        </div>
        <div className="stat-card depense">
          <h3>Dépenses</h3>
          <p>{totals.depenses} €</p>
        </div>
        <div className="stat-card benefice">
          <h3>Bénéfice</h3>
          <p>{totals.benefice} €</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Montant</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.date}</td>
              <td>{transaction.description}</td>
              <td>{transaction.montant} €</td>
              <td>{transaction.type}</td>
            </tr>
          ))}
          {!transactions.length && (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '16px' }}>
                Aucune transaction disponible
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardFinancier;

