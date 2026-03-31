// models/Budget.js
const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    trim: true,
    index: true
  },
  budget: {
    type: Number,
    required: [true, 'Le montant du budget est requis'],
    min: [0, 'Le budget ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  actual: {
    type: Number,
    default: 0,
    min: [0, 'Le réalisé ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  month: {
    type: String,
    required: [true, 'Le mois est requis'],
    match: [/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)'],
    index: true
  },
  status: {
    type: String,
    enum: ['respecté', 'dépassé', 'en_attente'],
    default: 'en_attente'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
  },
  variance: {
    type: Number,
    default: 0
  },
  variancePercentage: {
    type: Number,
    default: 0
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composé pour éviter les doublons
budgetSchema.index({ category: 1, month: 1 }, { unique: true });

// Middleware pour calculer la variance avant sauvegarde
budgetSchema.pre('save', function() {
  if (this.budget > 0) {
    this.variance = this.actual - this.budget;
    this.variancePercentage = (this.variance / this.budget) * 100;
    
    // Mettre à jour le statut automatiquement
    if (this.variance <= 0) {
      this.status = 'respecté';
    } else if (this.variance > 0) {
      this.status = 'dépassé';
    }
  }
});

// Méthode pour mettre à jour le réalisé
budgetSchema.methods.updateActual = async function(amount) {
  this.actual += amount;
  return this.save();
};

// Méthode statique pour les budgets du mois
budgetSchema.statics.getByMonth = function(month) {
  return this.find({ month }).sort('category');
};

// Méthode statique pour les statistiques
budgetSchema.statics.getStats = async function(month) {
  const match = month ? { month } : {};
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalBudget: { $sum: '$budget' },
        totalActual: { $sum: '$actual' },
        totalVariance: { $sum: '$variance' },
        count: { $sum: 1 },
        respected: {
          $sum: { $cond: [{ $eq: ['$status', 'respecté'] }, 1, 0] }
        },
        exceeded: {
          $sum: { $cond: [{ $eq: ['$status', 'dépassé'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || { totalBudget: 0, totalActual: 0, totalVariance: 0, count: 0, respected: 0, exceeded: 0 };
};

module.exports = mongoose.model('Budget', budgetSchema);