import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { isAuthenticated, getUserRole, getHomePathForRole } from '../../utils/auth';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(getHomePathForRole(getUserRole()), { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authService.login(email, password);

      if (result.success) {
        navigate(getHomePathForRole(result.user.role), { replace: true });
      } else {
        setError(result.message || 'Echec de connexion');
      }
    } catch {
      setError('Une erreur inattendue est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>ERP System</h1>
          <h2>Connexion</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@test.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            background: '#f0f7ff',
            borderRadius: '8px',
            fontSize: '0.85rem',
            border: '1px solid #b8daff'
          }}
        >
          <p style={{ fontWeight: 'bold', marginBottom: '10px', color: '#004085' }}>
            Comptes de test (back-end):
          </p>
          <p><strong>admin@test.com</strong> / password -&gt; admin_principal</p>
          <p><strong>stock@erp.com</strong> / stock123 -&gt; admin_stock</p>
          <p><strong>finance@erp.com</strong> / finance123 -&gt; admin_finance</p>
          <p><strong>facturation@erp.com</strong> / fact123 -&gt; admin_facture</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
