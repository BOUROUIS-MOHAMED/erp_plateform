const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  contact: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
  },
  phone: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^[0-9+\-\s]+$/.test(v);
      },
      message: 'Format téléphone invalide'
    }
  },
  address: { 
    type: String, 
    default: '',
    trim: true
  },
  status: { 
    type: String, 
    enum: ['actif', 'inactif'], 
    default: 'actif',
    index: true
  },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5, 
    default: 4 
  },
  since: { 
    type: Date, 
    default: Date.now 
  },
  products: { 
    type: Number, 
    default: 0,
    min: 0
  }
}, {
  timestamps: true, // Ajoute createdAt et updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour la recherche
supplierSchema.index({ name: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ status: 1, name: 1 });
supplierSchema.index({ name: 'text', contact: 'text', email: 'text' });

// Méthode pour mettre à jour le compteur de produits
supplierSchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  this.products = await Product.countDocuments({ supplierId: this._id });
  await this.save();
  return this.products;
};

// Méthode statique pour incrémenter/décrémenter le compteur
supplierSchema.statics.updateCount = async function(supplierId, increment = 1) {
  return this.findByIdAndUpdate(
    supplierId,
    { $inc: { products: increment } },
    { new: true }
  );
};

// Méthode statique pour les fournisseurs actifs
supplierSchema.statics.findActive = function() {
  return this.find({ status: 'actif' }).sort('name');
};

// Virtual pour le nombre d'années d'activité
supplierSchema.virtual('yearsActive').get(function() {
  const years = (Date.now() - this.since) / (1000 * 60 * 60 * 24 * 365);
  return Math.round(years * 10) / 10;
});

module.exports = mongoose.model('Supplier', supplierSchema);