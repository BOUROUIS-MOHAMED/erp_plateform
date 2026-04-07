// src/pages/stock/DashboardStock.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole } from '../../utils/auth';
import productService from '../../services/productService';
import { extractApiErrorMessage, mapProductToUi } from '../../utils/frontendApiAdapters';
import './DashboardStock.css';

const DashboardStock = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState('');
  const [produits, setProduits] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadProducts = async () => {
      try {
        const response = await productService.getAll({ limit: 20 });
        const items = (response.products || []).map(mapProductToUi);

        if (!mounted) {
          return;
        }

        setProduits(items);
        setErrorMessage('');
      } catch (error) {
        if (!mounted) {
          return;
        }

        setProduits([]);
        setErrorMessage(extractApiErrorMessage(error, 'Impossible de charger les produits'));
      }
    };

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRetour = () => {
    if (userRole === 'admin_principal') {
      navigate('/admin');
      return;
    }

    if (userRole === 'admin_stock') {
      navigate('/stock');
      return;
    }

    navigate('/');
  };

  return (
    <div className="dashboard-stock">
      <button
        className="back-button"
        onClick={handleRetour}
        style={{
          padding: '10px 20px',
          marginBottom: '20px',
          background: userRole === 'admin_principal' ? '#667eea' : '#48bb78',
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
          e.target.style.background = userRole === 'admin_principal' ? '#5a67d8' : '#38a169';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = userRole === 'admin_principal' ? '#667eea' : '#48bb78';
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>←</span>
        {userRole === 'admin_principal' ? "Retour à l'administration" : 'Retour à la gestion des stocks'}
      </button>

      <h1>Dashboard Stock</h1>

      {errorMessage && (
        <div style={{ marginBottom: '16px', color: '#c53030', fontWeight: 600 }}>
          {errorMessage}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Prix</th>
            <th>Valeur</th>
          </tr>
        </thead>
        <tbody>
          {produits.map((produit) => (
            <tr key={produit.id}>
              <td>{produit.name}</td>
              <td>{produit.stock}</td>
              <td>{produit.price} €</td>
              <td>{produit.stock * produit.price} €</td>
            </tr>
          ))}
          {!produits.length && (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '16px' }}>
                Aucun produit disponible
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardStock;

