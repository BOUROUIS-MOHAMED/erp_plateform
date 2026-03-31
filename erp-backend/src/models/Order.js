const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'La quantité doit être au moins 1']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Le prix unitaire ne peut pas être négatif']
  },
  totalHT: Number,
  totalTTC: Number
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['vente', 'achat'],
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedDate: Date,
  items: [orderItemSchema],
  subtotalHT: {
    type: Number,
    required: true,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  totalTTC: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['en_attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'],
    default: 'en_attente'
  },
  paymentStatus: {
    type: String,
    enum: ['impayé', 'partiel', 'payé'],
    default: 'impayé'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  validatedAt: Date
}, {
  timestamps: true
});

orderSchema.pre('save', async function() {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = this.type === 'vente' ? 'CMD' : 'ACH';
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `${prefix}-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
});

orderSchema.pre('save', function() {
  let subtotal = 0;
  
  this.items.forEach(item => {
    const itemTotal = item.quantity * item.unitPrice;
    item.totalHT = itemTotal;
    item.totalTTC = itemTotal * 1.2;
    subtotal += itemTotal;
  });
  
  this.subtotalHT = subtotal;
  this.tax = subtotal * 0.2;
  this.totalTTC = subtotal * 1.2;
  
  // next() retired in Mongoose 9
});

module.exports = mongoose.model('Order', orderSchema);
