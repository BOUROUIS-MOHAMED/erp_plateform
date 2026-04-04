// src/pages/facturation/DashboardFacturation.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole } from '../../utils/auth';
import api from '../../services/api';
import { extractApiErrorMessage, mapInvoiceToUi } from '../../utils/frontendApiAdapters';
import './DashboardFacturation.css';

const DashboardFacturation = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState('');
  const [factures, setFactures] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const response = await api.get('/dashboard/facture');
        const invoices = (response.data?.data?.recentInvoices || []).map(mapInvoiceToUi);

        if (!mounted) {
          return;
        }

        setFactures(invoices);
        setErrorMessage('');
      } catch (error) {
        if (!mounted) {
          return;
        }

        setFactures([]);
        setErrorMessage(extractApiErrorMessage(error, 'Impossible de charger les factures'));
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

    if (userRole === 'admin_facture') {
      navigate('/facturation');
      return;
    }

    navigate('/');
  };

  const totalAmount = factures.reduce((total, facture) => total + (facture.amount || 0), 0);

  return (
    <div className="dashboard-facturation">
      <button
        className="back-button"
        onClick={handleRetour}
        style={{
          padding: '10px 20px',
          marginBottom: '20px',
          background: userRole === 'admin_principal' ? '#667eea' : '#f59e0b',
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
          e.target.style.background = userRole === 'admin_principal' ? '#5a67d8' : '#e67e22';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = userRole === 'admin_principal' ? '#667eea' : '#f59e0b';
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>←</span>
        {userRole === 'admin_principal' ? "Retour à l'administration" : 'Retour à la gestion des factures'}
      </button>

      <h1>Dashboard Facturation</h1>

      {errorMessage && (
        <div style={{ marginBottom: '16px', color: '#c53030', fontWeight: 600 }}>
          {errorMessage}
        </div>
      )}

      <div className="stats">
        <div className="stat-card">
          <h3>Total Factures</h3>
          <p>{factures.length}</p>
        </div>
        <div className="stat-card">
          <h3>Montant Total</h3>
          <p>{totalAmount} €</p>
        </div>
      </div>

      <table className="factures-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Montant</th>
            <th>Date</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {factures.map((facture) => (
            <tr key={facture.id}>
              <td>{facture.client}</td>
              <td>{facture.amount} €</td>
              <td>{facture.date}</td>
              <td>
                <span className={`statut ${facture.status === 'payée' ? 'paye' : 'attente'}`}>
                  {facture.status}
                </span>
              </td>
            </tr>
          ))}
          {!factures.length && (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '16px' }}>
                Aucune facture disponible
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardFacturation;

