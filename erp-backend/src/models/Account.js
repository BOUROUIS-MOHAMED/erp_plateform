// models/Account.js
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Le code compte est requis'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[0-9]+$/, 'Le code doit contenir uniquement des chiffres'],
    maxlength: [10, 'Le code ne peut pas dépasser 10 caractères']
  },
  name: {
    type: String,
    required: [true, 'Le nom du compte est requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['actif', 'passif', 'produit', 'charge', 'tresorerie'],
      message: 'Type de compte invalide'
    },
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: {
      values: [
        'banque', 'caisse', 'client', 'fournisseur', 
        'capital', 'vente', 'achat', 'salaire', 'taxe',
        'immobilisation', 'stock', 'emprunt', 'investissement'
      ],
      message: 'Catégorie de compte invalide'
    },
    index: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Le solde ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100 // Arrondi à 2 décimales
  },
  currency: {
    type: String,
    default: 'TND',
    enum: ['TND', 'EUR', 'USD'],
    uppercase: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'La description ne peut pas dépasser 300 caractères']
  },
  // ✅ Nouveaux champs pour plus de fonctionnalités
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
    validate: {
      validator: function(v) {
        return !v || v.toString() !== this._id.toString();
      },
      message: 'Un compte ne peut pas être son propre parent'
    }
  },
  level: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
    validate: {
      validator: function(v) {
        // Validation basée sur la longueur du code
        return !this.code || v === this.code.length;
      },
      message: 'Le niveau doit correspondre à la longueur du code'
    }
  },
  taxRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  analyticalCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true
  },
  // Pour les comptes de tiers
  contactInfo: {
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    address: String,
    siret: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ Index optimisés
accountSchema.index({ code: 1 }, { unique: true });
accountSchema.index({ type: 1, category: 1 });
accountSchema.index({ isActive: 1, type: 1 });
accountSchema.index({ parentAccount: 1 });
accountSchema.index({ 'contactInfo.email': 1 }, { sparse: true });

// ✅ Middleware pre-save
accountSchema.pre('save', function() {
  // Définir le niveau automatiquement basé sur la longueur du code
  if (this.code && this.isModified('code')) {
    this.level = this.code.length;
  }
});

// ✅ Virtuals
accountSchema.virtual('fullName').get(function() {
  return `${this.code} - ${this.name}`;
});

accountSchema.virtual('isBank').get(function() {
  return this.category === 'banque' || this.category === 'caisse';
});

accountSchema.virtual('isThirdParty').get(function() {
  return ['client', 'fournisseur'].includes(this.category);
});

accountSchema.virtual('children', {
  ref: 'Account',
  localField: '_id',
  foreignField: 'parentAccount'
});

// ✅ Méthodes d'instance
accountSchema.methods.credit = async function(amount, session) {
  if (this.type === 'actif' || this.type === 'charge') {
    this.balance -= amount;
  } else {
    this.balance += amount;
  }
  return this.save({ session });
};

accountSchema.methods.debit = async function(amount, session) {
  if (this.type === 'actif' || this.type === 'charge') {
    this.balance += amount;
  } else {
    this.balance -= amount;
  }
  return this.save({ session });
};

accountSchema.methods.getBalanceHistory = async function(startDate, endDate) {
  const Transaction = mongoose.model('Transaction');
  return Transaction.getAccountLedger(this._id, startDate, endDate);
};

// ✅ Méthodes statiques
accountSchema.statics.getChartOfAccounts = async function() {
  return this.find({ isActive: true })
    .sort('code')
    .populate('parentAccount', 'code name');
};

accountSchema.statics.getBalanceSheet = async function(date = new Date()) {
  const accounts = await this.find({ 
    isActive: true,
    type: { $in: ['actif', 'passif'] }
  });
  
  const assets = accounts.filter(a => a.type === 'actif')
    .reduce((sum, a) => sum + a.balance, 0);
  const liabilities = accounts.filter(a => a.type === 'passif')
    .reduce((sum, a) => sum + a.balance, 0);
  
  return { assets, liabilities, equity: assets - liabilities };
};

module.exports = mongoose.model('Account', accountSchema);