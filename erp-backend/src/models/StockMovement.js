const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true,
    index: true
  },
  product: { 
    type: String, 
    required: true,
    trim: true
  },
  date: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  type: { 
    type: String, 
    enum: ['entrée', 'sortie'], 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  user: { 
    type: String, 
    default: 'system',
    trim: true
  },
  note: { 
    type: String, 
    default: '',
    trim: true
  },
  reason: { 
    type: String, 
    enum: ['purchase', 'sale', 'return', 'adjustment', 'damage', 'initial'],
    default: 'adjustment'
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true // Ajoute createdAt et updatedAt
});

// Index pour les performances
stockMovementSchema.index({ productId: 1, date: -1 });
stockMovementSchema.index({ date: -1 });
stockMovementSchema.index({ type: 1, date: -1 });
stockMovementSchema.index({ user: 1, date: -1 });
stockMovementSchema.index({ reason: 1 });
stockMovementSchema.index({ createdAt: -1 });

// Middleware pre-save pour validation
stockMovementSchema.pre('save', async function() {
  if (this.isNew && this.type === 'sortie') {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.productId);
    if (!product) {
      throw new Error('Produit non trouvé');
    }
    if (product.stock < this.quantity) {
      throw new Error(`Stock insuffisant. Disponible: ${product.stock}`);
    }
  }
});

// Méthode statique pour les statistiques
stockMovementSchema.statics.getProductHistory = async function(productId, limit = 50) {
  return this.find({ productId })
    .sort('-date')
    .limit(limit)
    .lean();
};

// Méthode statique pour les statistiques globales
stockMovementSchema.statics.getStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $facet: {
        byType: [
          {
            $group: {
              _id: '$type',
              total: { $sum: '$quantity' },
              count: { $sum: 1 }
            }
          }
        ],
        byReason: [
          {
            $group: {
              _id: '$reason',
              total: { $sum: '$quantity' },
              count: { $sum: 1 }
            }
          }
        ],
        topProducts: [
          {
            $group: {
              _id: '$productId',
              product: { $first: '$product' },
              total: { $sum: '$quantity' },
              count: { $sum: 1 }
            }
          },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ]
      }
    }
  ]);
};

// Méthode d'instance pour annuler un mouvement
stockMovementSchema.methods.reverse = async function() {
  const reverseMovement = new this.constructor({
    productId: this.productId,
    product: this.product,
    type: this.type === 'entrée' ? 'sortie' : 'entrée',
    quantity: this.quantity,
    user: this.user,
    note: `Annulation du mouvement ${this._id}`,
    reason: 'adjustment',
    metadata: {
      reversedMovementId: this._id,
      originalDate: this.date
    }
  });
  
  await reverseMovement.save();
  return reverseMovement;
};

module.exports = mongoose.model('StockMovement', stockMovementSchema);
