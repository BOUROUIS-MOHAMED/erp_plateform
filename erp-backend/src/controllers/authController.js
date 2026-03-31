const User = require('../models/User');
const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');
const { getGlobalModuleAccess } = require('../utils/moduleAccess');

// @desc    Inscription
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, department } = req.body;

    // Vérifier si l'utilisateur existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un utilisateur avec cet email existe déjà' 
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'employe',
      department
    });

    // Générer token
    const token = user.generateToken();

    // Journaliser
    await AuditLog.create({
      user: user._id,
      action: 'CREATE',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Connexion
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  console.log('🔥 LOGIN EXÉCUTÉ - req.url:', req.url);
  console.log('   req.body:', req.body);
  
  try {
    const { email, password } = req.body;

    // Vérifier email et mot de passe
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si compte actif
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'This account is deactivated, please contact the admin.' 
      });
    }

    // Mettre à jour dernière connexion
    user.lastLogin = Date.now();
    await user.save();

    // Générer token
    const token = user.generateToken();
    const moduleAccess = await getGlobalModuleAccess();

    // Journaliser
    await AuditLog.create({
      user: user._id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        moduleAccess
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Déconnexion
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        action: 'LOGOUT',
        entity: 'USER',
        entityId: req.user._id,
        ipAddress: req.ip
      });
    }
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Rafraîchir le token
// @route   POST /api/auth/refresh-token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Refresh token requis' 
      });
    }

    // Vérifier le refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Générer un nouveau token
    const newToken = user.generateToken();

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Refresh token invalide' 
    });
  }
};
