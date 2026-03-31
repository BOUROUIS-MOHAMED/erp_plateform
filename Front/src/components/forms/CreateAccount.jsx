import { useState } from 'react';

function CreateAccount({ onClose, onAccountCreated, standalone = false, onCancel }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});

  const clearFieldError = (fieldName) => {
    setErrors((prev) => {
      if (!prev[fieldName]) {
        return prev;
      }

      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearFieldError(name);

    if (name === 'password' || name === 'confirmPassword') {
      setErrors((prev) => {
        if (!prev.password && !prev.confirmPassword) {
          return prev;
        }

        const next = { ...prev };
        delete next.password;
        delete next.confirmPassword;
        return next;
      });
    }

    if (message.type === 'error') {
      setMessage({ type: '', text: '' });
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedRole = formData.role.trim();

    if (!trimmedFirstName) {
      nextErrors.firstName = 'Le prénom est requis';
    }

    if (!trimmedLastName) {
      nextErrors.lastName = 'Le nom est requis';
    }

    if (!trimmedEmail) {
      nextErrors.email = "L'email est requis";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        nextErrors.email = "Format d'email invalide";
      }
    }

    if (!formData.password) {
      nextErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 6) {
      nextErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Veuillez confirmer le mot de passe';
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (!trimmedRole) {
      nextErrors.role = 'Le rôle est requis';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setMessage({ type: 'error', text: 'Veuillez corriger les champs indiqués.' });
      return false;
    }

    setMessage({ type: '', text: '' });
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setMessage({ type: 'info', text: 'Création du compte en cours...' });

    try {
      const { confirmPassword, ...userData } = formData;

      if (onAccountCreated) {
        await onAccountCreated({
          ...userData,
          firstName: userData.firstName.trim(),
          lastName: userData.lastName.trim(),
          email: userData.email.trim(),
          role: userData.role.trim(),
          department: userData.department.trim(),
        });
      }

      setErrors({});
      setMessage({ type: 'success', text: 'Compte créé avec succès !' });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: '',
        department: '',
      });

      if (!standalone) {
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      } else {
        setTimeout(() => {
          setMessage({ type: '', text: '' });
        }, 3000);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error?.message || 'La création du compte a échoué',
      });
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = standalone ? styles.pageContainer : styles.modalOverlay;
  const contentStyle = standalone ? styles.pageContent : styles.modalContent;

  const getInputStyle = (fieldName) => {
    if (errors[fieldName]) {
      return { ...styles.input, borderColor: '#f56565' };
    }

    if (
      fieldName === 'confirmPassword' &&
      formData.confirmPassword &&
      formData.password === formData.confirmPassword
    ) {
      return { ...styles.input, borderColor: '#48bb78' };
    }

    return styles.input;
  };

  const renderFieldError = (fieldName) => {
    if (!errors[fieldName]) {
      return null;
    }

    return <small style={styles.fieldError}>{errors[fieldName]}</small>;
  };

  return (
    <div style={containerStyle} onClick={!standalone ? onClose : undefined}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <span style={{ fontSize: '2rem' }}>{'\uD83D\uDC64'}</span>
            {'Créer un nouveau compte'}
          </h2>
          {!standalone && (
            <button onClick={onClose} style={styles.closeButton}>
              {'\u2715'}
            </button>
          )}
        </div>

        {message.text && (
          <div
            style={{
              ...styles.messageBox,
              backgroundColor:
                message.type === 'success'
                  ? '#c6f6d5'
                  : message.type === 'error'
                    ? '#fed7d7'
                    : '#e6f7ff',
              color:
                message.type === 'success'
                  ? '#22543d'
                  : message.type === 'error'
                    ? '#742a2a'
                    : '#0052cc',
              borderColor:
                message.type === 'success'
                  ? '#9ae6b4'
                  : message.type === 'error'
                    ? '#feb2b2'
                    : '#91d5ff',
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              {'Prénom'} <span style={styles.requiredMark}>*</span>
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              style={getInputStyle('firstName')}
              required
            />
            {renderFieldError('firstName')}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Nom <span style={styles.requiredMark}>*</span>
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              style={getInputStyle('lastName')}
              required
            />
            {renderFieldError('lastName')}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Email <span style={styles.requiredMark}>*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={getInputStyle('email')}
              required
              placeholder="@exemple.com"
            />
            {renderFieldError('email')}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Mot de passe <span style={styles.requiredMark}>*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={getInputStyle('password')}
              required
              minLength="6"
            />
            {renderFieldError('password')}
            {!errors.password && <small style={styles.inputHelp}>Minimum 6 caractères</small>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Confirmer le mot de passe <span style={styles.requiredMark}>*</span>
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              style={getInputStyle('confirmPassword')}
              required
            />
            {renderFieldError('confirmPassword')}
            {!errors.confirmPassword &&
              formData.confirmPassword &&
              formData.password === formData.confirmPassword && (
                <small style={{ ...styles.inputHelp, color: '#48bb78' }}>
                  {'\u2713'} Les mots de passe correspondent
                </small>
              )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              {'Rôle'} <span style={styles.requiredMark}>*</span>
            </label>
            <input
              type="text"
              name="role"
              value={formData.role}
              onChange={handleChange}
              style={getInputStyle('role')}
              required
              placeholder="Ex: Administrateur, Manager, Commercial..."
            />
            {renderFieldError('role')}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{'Département'}</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              style={styles.input}
              placeholder="Ex: Direction, Commercial, IT..."
            />
          </div>

          {!standalone ? (
            <div style={styles.buttonContainer}>
              <button
                type="button"
                onClick={onClose}
                style={styles.cancelButton}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f7fafc';
                  e.target.style.borderColor = '#cbd5e0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#e2e8f0';
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                style={loading ? { ...styles.submitButton, ...styles.loadingStyle } : styles.submitButton}
                onMouseEnter={(e) => {
                  if (!loading) e.target.style.background = '#38a169';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.target.style.background = '#48bb78';
                }}
              >
                {loading ? (
                  <>
                    <span style={styles.spinner}></span>
                    {'Création...'}
                  </>
                ) : (
                  <>
                    <span>{'\u2795'}</span>
                    {'Créer le compte'}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={styles.pageButtonContainer}>
              <button
                type="button"
                onClick={onCancel}
                style={styles.cancelButtonLarge}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f7fafc';
                  e.target.style.borderColor = '#cbd5e0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#e2e8f0';
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                style={loading ? { ...styles.submitButtonLarge, ...styles.loadingStyle } : styles.submitButtonLarge}
                onMouseEnter={(e) => {
                  if (!loading) e.target.style.background = '#38a169';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.target.style.background = '#48bb78';
                }}
              >
                {loading ? (
                  <>
                    <span style={styles.spinner}></span>
                    {'Création en cours...'}
                  </>
                ) : (
                  'Créer le compte'
                )}
              </button>
            </div>
          )}
        </form>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(5px)',
  },
  modalContent: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    width: '500px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  pageContainer: {
    width: '100%',
    background: 'transparent',
  },
  pageContent: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '1.5rem',
    color: '#1a202c',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#a0aec0',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'all 0.3s',
  },
  messageBox: {
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 600,
    color: '#4a5568',
    fontSize: '0.95rem',
  },
  requiredMark: {
    color: '#f56565',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    backgroundColor: 'white',
    boxSizing: 'border-box',
  },
  inputHelp: {
    color: '#718096',
    fontSize: '0.8rem',
    marginTop: '4px',
    display: 'block',
  },
  fieldError: {
    color: '#f56565',
    fontSize: '0.8rem',
    marginTop: '4px',
    display: 'block',
  },
  buttonContainer: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '20px',
    marginTop: '10px',
  },
  pageButtonContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '20px',
    marginTop: '10px',
  },
  cancelButton: {
    padding: '10px 20px',
    background: 'white',
    color: '#4a5568',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  cancelButtonLarge: {
    padding: '12px 30px',
    background: 'white',
    color: '#4a5568',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s',
    marginRight: '12px',
  },
  submitButton: {
    padding: '10px 20px',
    background: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  submitButtonLarge: {
    padding: '12px 30px',
    background: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  loadingStyle: {
    background: '#a0aec0',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid white',
    borderRadius: '50%',
    borderTopColor: 'transparent',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
};

export default CreateAccount;
