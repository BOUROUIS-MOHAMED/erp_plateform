const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Le montant ne peut pas être négatif']
  },
  method: {
    type: String,
    enum: ['carte', 'virement', 'chèque', 'espèces', 'prélèvement'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  reference: String,
  status: {
    type: String,
    enum: ['en_attente', 'validé', 'rejeté', 'remboursé'],
    default: 'en_attente'
  },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  validatedAt: Date,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

paymentSchema.pre('save', async function() {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentNumber = `PAY-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
});

paymentSchema.post('save', async function(doc) {
  if (doc.status === 'validé') {
    const Invoice = mongoose.model('Invoice');
    const invoice = await Invoice.findById(doc.invoice);
    
    if (invoice) {
      invoice.amountPaid += doc.amount;
      invoice.amountDue = invoice.totalTTC - invoice.amountPaid;
      
      if (invoice.amountDue <= 0) {
        invoice.status = 'payée';
        invoice.paidAt = new Date();
      } else if (invoice.amountPaid > 0) {
        invoice.status = 'partiellement_payée';
      }
      
      await invoice.save();
    }
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
