// roleMiddleware.js

const isAdminPrincipal = (req, res, next) => {
  if (req.user.role !== 'admin_principal') {
    return res.status(403).json({ 
      success: false,
      message: 'Accès réservé à l\'administrateur principal' 
    });
  }
  next();
};

const isAdminFacture = (req, res, next) => {
  if (!['admin_principal', 'admin_facture'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      message: 'Accès réservé au département Facturation' 
    });
  }
  next();
};

const isAdminStock = (req, res, next) => {
  if (!['admin_principal', 'admin_stock'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      message: 'Accès réservé au département Stock' 
    });
  }
  next();
};

const isAdminFinance = (req, res, next) => {
  if (!['admin_principal', 'admin_finance'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      message: 'Accès réservé au département Finance' 
    });
  }
  next();
};

// ✅ Fonction authorize ajoutée ici
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Non autorisé - Utilisateur non trouvé' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Accès interdit - Rôle requis: ${roles.join(', ')}` 
            });
        }

        next();
    };
};

// ✅ UN SEUL module.exports avec toutes les fonctions
module.exports = {
  isAdminPrincipal,
  isAdminFacture,
  isAdminStock,
  isAdminFinance,
  authorize  // ← Maintenant authorize est bien exporté
};