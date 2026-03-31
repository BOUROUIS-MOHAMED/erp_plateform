const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['admin_principal', 'admin_facture', 'admin_stock', 'admin_finance', 'employe'],
    default: 'employe',
    index: true
  },
  department: {
    type: String,
    enum: ['administration', 'facturation', 'stock', 'finance'],
    required: function() {
      return this.role !== 'admin_principal';
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[0-9+\-\s]+$/.test(v);
      },
      message: 'Format téléphone invalide'
    }
  },
  avatar: String,
  preferences: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {
      stock: {},
      finance: {},
      facturation: {}
    }
  },
  lastLogin: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshToken: String,
  refreshTokenExpires: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index supplémentaires
userSchema.index({ role: 1, department: 1 });
userSchema.index({ isActive: 1, lastLogin: -1 });

// Middleware pre-save pour hasher le mot de passe
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = Date.now();
});

// Middleware pour nettoyer les tokens expirés
userSchema.pre('save', function() {
  if (this.isModified('password')) {
    this.refreshToken = undefined;
    this.refreshTokenExpires = undefined;
  }
});

// Comparer mot de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Générer token JWT
userSchema.methods.generateToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email, 
      role: this.role,
      department: this.department
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Générer refresh token
userSchema.methods.generateRefreshToken = function() {
  this.refreshToken = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  this.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return this.refreshToken;
};

// Vérifier les permissions
userSchema.methods.hasPermission = function(requiredRole) {
  if (this.role === 'admin_principal') return true;
  return this.role === requiredRole;
};

userSchema.methods.canAccessModule = function(module) {
  if (this.role === 'admin_principal') return true;
  
  const moduleRoles = {
    stock: ['admin_stock'],
    finance: ['admin_finance'],
    facturation: ['admin_facture']
  };
  
  return moduleRoles[module]?.includes(this.role) || false;
};

// Virtual pour le nom complet
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual pour savoir si l'utilisateur est en ligne récemment
userSchema.virtual('isOnline').get(function() {
  if (!this.lastLogin) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastLogin > fiveMinutesAgo;
});

module.exports = mongoose.model('User', userSchema);
