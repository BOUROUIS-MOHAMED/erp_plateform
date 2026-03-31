const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const {
  getGlobalModuleAccess,
  getUserPreferenceValue,
  setUserPreferenceValue,
} = require('../utils/moduleAccess');

const buildProfilePayload = async (user) => {
  const moduleAccess = await getGlobalModuleAccess();

  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || '',
    department: user.department || '',
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    moduleAccess,
  };
};

// ========== FONCTIONS DE PROFIL UTILISATEUR ==========

// @desc    Récupérer le profil de l'utilisateur connecté
// @route   GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    res.json({
      success: true,
      data: await buildProfilePayload(user)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mettre à jour le profil
// @route   PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, department } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    const modifications = [];

    // Mise à jour des champs
    if (firstName && firstName !== user.firstName) {
      user.firstName = firstName;
      modifications.push('prénom');
    }
    
    if (lastName && lastName !== user.lastName) {
      user.lastName = lastName;
      modifications.push('nom');
    }
    
    if (email && email !== user.email) {
      // Vérifier si l'email est déjà pris
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cet email est déjà utilisé' 
        });
      }
      user.email = email;
      modifications.push('email');
    }
    
    if (phone !== undefined) {
      user.phone = phone;
      modifications.push('téléphone');
    }
    
    if (department !== undefined) {
      user.department = department;
      modifications.push('département');
    }
    
    if (modifications.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucune modification détectée' 
      });
    }
    
    user.updatedAt = Date.now();
    await user.save();

    // Journaliser
    await AuditLog.create({
      user: user._id,
      action: 'UPDATE',
      entity: 'USER',
      entityId: user._id,
      details: { modifications },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Profil mis à jour (${modifications.join(', ')})`,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        department: user.department || '',
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Changer le mot de passe
// @route   POST /api/users/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' 
      });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    // Vérifier l'ancien mot de passe
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Mot de passe actuel incorrect' 
      });
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.updatedAt = Date.now();
    await user.save();

    // Journaliser
    await AuditLog.create({
      user: user._id,
      action: 'PASSWORD_CHANGE',
      entity: 'USER',
      entityId: user._id,
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      message: 'Mot de passe mis à jour avec succès' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Récupérer les préférences d'un module
// @route   GET /api/users/preferences/:module
exports.getPreferences = async (req, res) => {
  try {
    const { module } = req.params;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    const preferences = getUserPreferenceValue(user, module);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mettre à jour les préférences d'un module
// @route   PUT /api/users/preferences/:module
exports.updatePreferences = async (req, res) => {
  try {
    const { module } = req.params;
    const preferences = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    const nextPreferences = {
      ...getUserPreferenceValue(user, module),
      ...preferences
    };

    setUserPreferenceValue(user, module, nextPreferences);
    
    user.updatedAt = Date.now();
    await user.save();
    
    res.json({
      success: true,
      data: nextPreferences
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ========== FONCTIONS D'ADMINISTRATION (AJOUTÉES) ==========

// @desc    Récupérer tous les utilisateurs (admin)
// @route   GET /api/users
exports.getAllUsers = async (req, res) => {
  try {
    // Filtres optionnels
    const { role, department, isActive } = req.query;
    const filter = {};
    
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: users.length,
      data: users.map(user => ({
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Récupérer un utilisateur par ID (admin)
// @route   GET /api/users/:id
exports.getUserById = async (req, res) => {
  try {
    // Valider l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur invalide' 
      });
    }
    
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Créer un nouvel utilisateur (admin)
// @route   POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, department, role } = req.body;
    
    // Validation des champs requis
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Les champs requis: firstName, lastName, email, password' 
      });
    }
    
    // Validation email
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format d\'email invalide' 
      });
    }
    
    // Validation mot de passe
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }
    
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet email est déjà utilisé' 
      });
    }
    
    // Créer l'utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone: phone || '',
      department: department || '',
      role: role || 'user',
      isActive: true,
      createdAt: Date.now()
    });
    
    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
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

// @desc    Mettre à jour un utilisateur (admin)
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    // Valider l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur invalide' 
      });
    }
    
    const { firstName, lastName, email, phone, department, role, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    // Empêcher la modification de son propre rôle (sécurité)
    if (user._id.toString() === req.user._id.toString() && role && role !== user.role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas modifier votre propre rôle' 
      });
    }
    
    // Vérifier si l'email est déjà pris (si changement d'email)
    if (email && email !== user.email) {
      // Validation email
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Format d\'email invalide' 
        });
      }
      
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cet email est déjà utilisé' 
        });
      }
    }
    
    // Mise à jour des champs
    const modifications = [];
    if (firstName && firstName !== user.firstName) {
      user.firstName = firstName;
      modifications.push('prénom');
    }
    if (lastName && lastName !== user.lastName) {
      user.lastName = lastName;
      modifications.push('nom');
    }
    if (email && email !== user.email) {
      user.email = email;
      modifications.push('email');
    }
    if (phone !== undefined) {
      user.phone = phone;
      modifications.push('téléphone');
    }
    if (department !== undefined) {
      user.department = department;
      modifications.push('département');
    }
    if (role && role !== user.role) {
      user.role = role;
      modifications.push('rôle');
    }
    if (isActive !== undefined && isActive !== user.isActive) {
      user.isActive = isActive;
      modifications.push('statut');
    }
    
    if (modifications.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucune modification détectée' 
      });
    }
    
    user.updatedAt = Date.now();
    await user.save();
    
    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE',
      entity: 'USER',
      entityId: user._id,
      details: { modifications },
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: `Utilisateur mis à jour (${modifications.join(', ')})`,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Supprimer un utilisateur (admin) - Soft delete
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    // Valider l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur invalide' 
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    // Empêcher la suppression de soi-même
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas supprimer votre propre compte' 
      });
    }
    
    // Soft delete (désactiver plutôt que supprimer)
    user.isActive = false;
    user.deletedAt = Date.now();
    await user.save();
    
    // Alternative: Suppression réelle (décommentez si nécessaire)
    // await user.deleteOne();
    
    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email, softDelete: true },
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: 'Utilisateur désactivé avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Activer/désactiver un utilisateur (admin)
// @route   PATCH /api/users/:id/toggle
exports.toggleUserStatus = async (req, res) => {
  try {
    // Valider l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur invalide' 
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    // Empêcher la désactivation de soi-même
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas modifier votre propre statut' 
      });
    }
    
    user.isActive = !user.isActive;
    user.updatedAt = Date.now();
    await user.save();
    
    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'TOGGLE_STATUS',
      entity: 'USER',
      entityId: user._id,
      details: { isActive: user.isActive },
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: `Utilisateur ${user.isActive ? 'activé' : 'désactivé'} avec succès`,
      data: { isActive: user.isActive }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Réinitialiser le mot de passe d'un utilisateur (admin)
// @route   POST /api/users/:id/reset-password
exports.resetUserPassword = async (req, res) => {
  try {
    // Valider l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur invalide' 
      });
    }
    
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nouveau mot de passe requis' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.updatedAt = Date.now();
    await user.save();
    
    // Journaliser
    await AuditLog.create({
      user: req.user._id,
      action: 'PASSWORD_RESET',
      entity: 'USER',
      entityId: user._id,
      details: { email: user.email },
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
