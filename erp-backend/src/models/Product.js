const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du produit est requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    unique: true,
    index: true
  },
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    trim: true,
    index: true,
    maxlength: [100, 'La catégorie ne peut pas dépasser 100 caractères']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Le stock ne peut pas être négatif'],
    index: true
  },
  price: {
    type: Number,
    required: [true, 'Le prix est requis'],
    min: [0, 'Le prix ne peut pas être négatif'],
    max: [1000000, 'Prix maximum dépassé'],
    set: v => Math.round(v * 100) / 100 // Arrondi à 2 décimales
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Le fournisseur est requis'],
    index: true
  },
  minStock: {
    type: Number,
    default: 5,
    min: [0, 'Le stock minimum ne peut pas être négatif']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true, // ✓ Ajoute createdAt et updatedAt automatiquement
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composés
productSchema.index({ category: 1, stock: 1 });
productSchema.index({ supplierId: 1, isActive: 1 });

// Virtuals
productSchema.virtual('status').get(function() {
  if (this.stock === 0) return 'rupture';
  if (this.stock < this.minStock) return 'stock faible';
  return 'en stock';
});

productSchema.virtual('totalValue').get(function() {
  return this.price * this.stock;
});

productSchema.virtual('isCritical').get(function() {
  return this.stock === 0 || this.stock < this.minStock / 2;
});

// Méthodes d'instance
productSchema.methods.updateStock = async function(quantity, session) {
  this.stock += quantity;
  return this.save({ session });
};

productSchema.methods.isLowStock = function() {
  return this.stock < this.minStock;
};

// Méthodes statiques
productSchema.statics.findLowStock = function() {
  return this.find({
    $expr: { $lte: ['$stock', '$minStock'] }
  }).populate('supplierId', 'name email phone');
};

productSchema.statics.findBySupplier = function(supplierId) {
  return this.find({ supplierId, isActive: true })
    .sort('name')
    .populate('supplierId', 'name email');
};

productSchema.statics.getCategoryStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$price', '$stock'] } }
      }
    },
    { $sort: { totalValue: -1 } }
  ]);
};

productSchema.statics.search = function(query) {
  return this.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } }
    ],
    isActive: true
  }).populate('supplierId', 'name email');
};

module.exports = mongoose.model('Product', productSchema);
