// models/Invoice.js
const mongoose = require('mongoose');

// Schéma pour les lignes de facture
const invoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Le produit est requis']
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    maxlength: [255, 'La description ne peut pas dépasser 255 caractères']
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'La quantité doit être au moins 1'],
    validate: {
      validator: Number.isInteger,
      message: 'La quantité doit être un nombre entier'
    }
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Le prix unitaire ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100 // Arrondi à 2 décimales
  },
  taxRate: {
    type: Number,
    default: 20,
    enum: [0, 2.1, 5.5, 10, 20],
    set: v => Math.round(v * 10) / 10 // Arrondi à 1 décimale
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'La remise ne peut pas être négative'],
    max: [100, 'La remise ne peut pas dépasser 100%']
  },
  totalHT: {
    type: Number,
    default: 0,
    set: v => Math.round(v * 100) / 100
  },
  totalTTC: {
    type: Number,
    default: 0,
    set: v => Math.round(v * 100) / 100
  }
}, {
  _id: true // Génère un _id pour chaque ligne
});

// Index pour les items
invoiceItemSchema.index({ product: 1 });

// Schéma principal de la facture
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: {
      values: ['facture', 'avoir', 'acompte', 'proforma'],
      message: 'Type de facture invalide'
    },
    default: 'facture',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Le client est requis'],
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dueDate: {
    type: Date,
    required: [true, 'La date d\'échéance est requise'],
    validate: {
      validator: function(v) {
        return v > this.date;
      },
      message: 'La date d\'échéance doit être postérieure à la date de facture'
    }
  },
  items: {
    type: [invoiceItemSchema],
    required: [true, 'Au moins un article est requis'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'La facture doit contenir au moins un article'
    }
  },
  // Totaux
  subtotalHT: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Le total HT ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  totalTax: {
    type: Number,
    default: 0,
    min: [0, 'La TVA ne peut pas être négative'],
    set: v => Math.round(v * 100) / 100
  },
  totalTTC: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Le total TTC ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  // Paiements
  amountPaid: {
    type: Number,
    default: 0,
    min: [0, 'Le montant payé ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  amountDue: {
    type: Number,
    default: 0,
    min: [0, 'Le montant dû ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['carte', 'virement', 'cheque', 'especes', 'prelevement'],
      message: 'Mode de paiement invalide'
    }
  },
  paidAt: Date,
  // Statut
  status: {
    type: String,
    enum: {
      values: ['brouillon', 'envoyée', 'validée', 'payée', 'partiellement_payée', 'en_retard', 'annulée', 'avoir'],
      message: 'Statut invalide'
    },
    default: 'brouillon',
    required: true,
    index: true
  },
  // Référence commande
  orderId: {
    type: String,
    default: null,
    index: true
  },
  // Documents
  originalInvoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  }, // Pour les avoirs
  // Métadonnées
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Les notes ne peuvent pas dépasser 1000 caractères']
  },
  termsAndConditions: {
    type: String,
    default: 'Paiement à réception de facture. Aucun escompte pour paiement anticipé.'
  },
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  validatedAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  cancellationReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index supplémentaires pour les performances
invoiceSchema.index({ customer: 1, date: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 'text' });

// MIDDLEWARES
// Génération du numéro de facture (pre-validate pour que le champ soit prêt avant la validation)
invoiceSchema.pre('validate', async function() {
  if (this.isNew && !this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    let prefix = 'FACT';
    if (this.type === 'avoir') prefix = 'AVOIR';
    if (this.type === 'acompte') prefix = 'ACO';
    if (this.type === 'proforma') prefix = 'PRO';
    
    const count = await mongoose.model('Invoice').countDocuments({
      type: this.type,
      date: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    
    this.invoiceNumber = `${prefix}-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
});

// Calcul automatique des totaux
invoiceSchema.pre('save', function() {
  let subtotalHT = 0;
  let totalTax = 0;
  
  this.items.forEach(item => {
    // Calcul du montant HT avec remise
    const itemHT = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    // Calcul de la TVA
    const itemTax = itemHT * ((item.taxRate || 20) / 100);
    
    // Mise à jour des totaux de l'item
    item.totalHT = Math.round(itemHT * 100) / 100;
    item.totalTTC = Math.round((itemHT + itemTax) * 100) / 100;
    
    // Accumulation des totaux
    subtotalHT += itemHT;
    totalTax += itemTax;
  });
  
  // Mise à jour des totaux de la facture
  this.subtotalHT = Math.round(subtotalHT * 100) / 100;
  this.totalTax = Math.round(totalTax * 100) / 100;
  this.totalTTC = Math.round((subtotalHT + totalTax) * 100) / 100;
  
  // Mise à jour du montant dû
  if (this.amountPaid) {
    this.amountDue = Math.max(0, this.totalTTC - this.amountPaid);
  } else {
    this.amountDue = this.totalTTC;
  }
  
  // Mise à jour du statut en fonction des paiements
  if (this.amountDue <= 0 && this.amountPaid > 0) {
    this.status = 'payée';
    this.paidAt = this.paidAt || new Date();
  } else if (this.amountPaid > 0 && this.amountDue > 0) {
    this.status = 'partiellement_payée';
  }
  
  // Vérification retard
  if (this.status !== 'payée' && 
      this.status !== 'annulée' && 
      this.dueDate < new Date()) {
    this.status = 'en_retard';
  }
});

// VIRTUAL PROPERTIES
// Vérifie si la facture est en retard
invoiceSchema.virtual('isOverdue').get(function() {
  return this.status !== 'payée' && 
         this.status !== 'annulée' && 
         this.dueDate < new Date();
});

// Jours de retard
invoiceSchema.virtual('overdueDays').get(function() {
  if (!this.isOverdue) return 0;
  const diff = new Date() - this.dueDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Taux de TVA moyen
invoiceSchema.virtual('averageTaxRate').get(function() {
  if (this.subtotalHT === 0) return 0;
  return Math.round((this.totalTax / this.subtotalHT) * 1000) / 10;
});

// Nombre d'articles
invoiceSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// MÉTHODES D'INSTANCE
// Marquer comme payée
invoiceSchema.methods.markAsPaid = async function(amount, method, userId) {
  this.amountPaid += amount;
  this.paymentMethod = method;
  
  if (this.amountPaid >= this.totalTTC) {
    this.status = 'payée';
    this.paidAt = new Date();
  } else if (this.amountPaid > 0) {
    this.status = 'partiellement_payée';
  }
  
  return this.save();
};

// Annuler une facture
invoiceSchema.methods.cancel = async function(reason, userId) {
  if (this.status === 'payée') {
    throw new Error('Impossible d\'annuler une facture payée');
  }
  
  this.status = 'annulée';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  
  return this.save();
};

// Créer un avoir
invoiceSchema.methods.createCreditNote = async function(reason, userId) {
  const CreditNote = mongoose.model('Invoice');
  
  const creditNote = new CreditNote({
    type: 'avoir',
    customer: this.customer,
    originalInvoice: this._id,
    items: this.items.map(item => ({
      ...item.toObject(),
      quantity: -item.quantity,
      totalHT: -item.totalHT,
      totalTTC: -item.totalTTC
    })),
    notes: `Avoir pour la facture ${this.invoiceNumber} - ${reason}`,
    createdBy: userId,
    date: new Date(),
    dueDate: new Date()
  });
  
  return creditNote.save();
};

// MÉTHODES STATIQUES
// Statistiques des factures
invoiceSchema.statics.getStats = async function(userId, role) {
  const match = {};
  if (role === 'admin_facture') {
    match.createdBy = userId;
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalCount: { $sum: 1 },
              totalHT: { $sum: '$subtotalHT' },
              totalTTC: { $sum: '$totalTTC' },
              totalPaid: { $sum: '$amountPaid' },
              totalDue: { $sum: '$amountDue' }
            }
          }
        ],
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              total: { $sum: '$totalTTC' }
            }
          }
        ],
        byMonth: [
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' }
              },
              count: { $sum: 1 },
              total: { $sum: '$totalTTC' }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ]
      }
    }
  ]);
  
  return stats[0];
};

// Factures en retard
invoiceSchema.statics.findOverdue = function() {
  return this.find({
    status: { $nin: ['payée', 'annulée'] },
    dueDate: { $lt: new Date() }
  }).populate('customer', 'firstName lastName email');
};

module.exports = mongoose.model('Invoice', invoiceSchema);
