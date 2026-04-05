// models/Transaction.js
const mongoose = require('mongoose');

/**
 * Schéma pour une ligne d'écriture comptable
 */
const transactionEntrySchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Le compte est requis'],
    index: true
  },
  debit: {
    type: Number,
    default: 0,
    min: [0, 'Le débit ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100 // Arrondi à 2 décimales
  },
  credit: {
    type: Number,
    default: 0,
    min: [0, 'Le crédit ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  label: {
    type: String,
    trim: true,
    maxlength: [200, 'Le libellé ne peut pas dépasser 200 caractères']
  }
}, {
  _id: true // Génère un _id pour chaque ligne
});

// Validation : une ligne ne peut pas avoir à la fois débit et crédit
transactionEntrySchema.pre('validate', function() {
  if (this.debit > 0 && this.credit > 0) {
    throw new Error('Une ligne ne peut pas avoir à la fois un débit et un crédit');
  }
  if (this.debit === 0 && this.credit === 0) {
    throw new Error('Une ligne doit avoir soit un débit soit un crédit');
  }
});

/**
 * Schéma principal de la transaction
 */
const transactionSchema = new mongoose.Schema({
  transactionNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  entries: {
    type: [transactionEntrySchema],
    required: [true, 'Au moins une écriture est requise'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'La transaction doit contenir au moins une écriture'
    }
  },
  totalDebit: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  totalCredit: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  reference: {
    type: String,
    trim: true,
    index: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel',
    index: true
  },
  referenceModel: {
    type: String,
      enum: {
        values: ['Invoice', 'Order', 'Payment'],
        message: 'Modèle de référence invalide'
      }
  },
  status: {
    type: String,
    enum: {
      values: ['brouillon', 'validé', 'annulé', 'rejeté'],
      message: 'Statut invalide'
    },
    default: 'brouillon',
    required: true,
    index: true
  },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  validatedAt: Date,
  validatedNote: {
    type: String,
    trim: true,
    maxlength: [300, 'La note de validation ne peut pas dépasser 300 caractères']
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

// Index composés pour les recherches fréquentes
transactionSchema.index({ date: -1, status: 1 });
transactionSchema.index({ 'entries.account': 1, date: -1 });
transactionSchema.index({ referenceId: 1, referenceModel: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ transactionNumber: 'text', description: 'text' });

/**
 * MIDDLEWARE pre-save
 */

// Validation de l'équilibre comptable
transactionSchema.pre('save', function() {
  if (Math.abs(this.totalDebit - this.totalCredit) > 0.01) {
    throw new Error(`Déséquilibre comptable: Débit (${this.totalDebit.toFixed(2)}) ≠ Crédit (${this.totalCredit.toFixed(2)})`);
  }
});

// Génération du numéro de transaction
transactionSchema.pre('save', async function() {
  if (this.isNew && !this.transactionNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const count = await mongoose.model('Transaction').countDocuments({
      transactionNumber: { $regex: `^ECR-${year}${month}` }
    });
    
    this.transactionNumber = `ECR-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
});

// Calcul automatique des totaux
transactionSchema.pre('save', function() {
  let totalDebit = 0;
  let totalCredit = 0;
  
  this.entries.forEach(entry => {
    totalDebit += entry.debit || 0;
    totalCredit += entry.credit || 0;
  });
  
  this.totalDebit = Math.round(totalDebit * 100) / 100;
  this.totalCredit = Math.round(totalCredit * 100) / 100;
});

/**
 * VIRTUAL PROPERTIES
 */

// Vérifie si la transaction est équilibrée
transactionSchema.virtual('isBalanced').get(function() {
  return Math.abs(this.totalDebit - this.totalCredit) < 0.01;
});

// Montant de la transaction (pour affichage)
transactionSchema.virtual('amount').get(function() {
  return Math.max(this.totalDebit, this.totalCredit);
});

// Type de transaction (débit ou crédit)
transactionSchema.virtual('type').get(function() {
  if (this.totalDebit > this.totalCredit) return 'débit';
  if (this.totalCredit > this.totalDebit) return 'crédit';
  return 'équilibré';
});

/**
 * METHODS D'INSTANCE
 */

// Valider une transaction
transactionSchema.methods.validate = async function(userId, note) {
  if (this.status !== 'brouillon') {
    throw new Error('Seules les transactions en brouillon peuvent être validées');
  }
  
  this.status = 'validé';
  this.validatedBy = userId;
  this.validatedAt = new Date();
  this.validatedNote = note;
  
  return this.save();
};

// Annuler une transaction
transactionSchema.methods.cancel = async function(userId, reason) {
  if (this.status === 'validé') {
    throw new Error('Impossible d\'annuler une transaction validée');
  }
  
  this.status = 'annulé';
  this.validatedBy = userId;
  this.validatedAt = new Date();
  this.validatedNote = reason;
  
  return this.save();
};

// Rejeter une transaction
transactionSchema.methods.reject = async function(userId, reason) {
  if (this.status !== 'brouillon') {
    throw new Error('Seules les transactions en brouillon peuvent être rejetées');
  }
  
  this.status = 'rejeté';
  this.validatedBy = userId;
  this.validatedAt = new Date();
  this.validatedNote = reason;
  
  return this.save();
};

// Ajouter une écriture
transactionSchema.methods.addEntry = function(entry) {
  this.entries.push(entry);
  return this.save();
};

/**
 * STATIC METHODS
 */

// Récupérer les transactions par période
transactionSchema.statics.getByPeriod = async function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('entries.account', 'code name')
    .populate('createdBy', 'firstName lastName')
    .sort({ date: -1 });
};

// Récupérer le journal d'un compte
transactionSchema.statics.getAccountLedger = async function(accountId, startDate, endDate) {
  const match = {
    'entries.account': accountId,
    status: 'validé'
  };
  
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    { $unwind: '$entries' },
    { $match: { 'entries.account': accountId } },
    {
      $project: {
        date: 1,
        transactionNumber: 1,
        description: 1,
        debit: '$entries.debit',
        credit: '$entries.credit',
        label: '$entries.label',
        reference: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
};

// Récupérer les statistiques
transactionSchema.statics.getStats = async function(year) {
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);
  
  const stats = await this.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        status: 'validé'
      }
    },
    {
      $facet: {
        monthly: [
          {
            $group: {
              _id: { $month: '$date' },
              count: { $sum: 1 },
              totalDebit: { $sum: '$totalDebit' },
              totalCredit: { $sum: '$totalCredit' }
            }
          },
          { $sort: { _id: 1 } }
        ],
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ],
        totals: [
          {
            $group: {
              _id: null,
              totalTransactions: { $sum: 1 },
              totalDebit: { $sum: '$totalDebit' },
              totalCredit: { $sum: '$totalCredit' }
            }
          }
        ]
      }
    }
  ]);
  
  return stats[0];
};

module.exports = mongoose.model('Transaction', transactionSchema);
