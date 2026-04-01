// models/Budget.js
const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    trim: true,
    set: v => String(v).toLowerCase().trim(),
    index: true
  },
  budget: {
    type: Number,
    required: [true, 'Le montant du budget est requis'],
    min: [0, 'Le budget ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  usedAmount: {
    type: Number,
    default: 0,
    min: [0, 'Le montant utilisé ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise']
  },
  status: {
    type: String,
    enum: ['desactivated', 'respected', 'passed'],
    default: 'respected'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
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
}, { timestamps: true });

// Auto-calculate status before validation (so enum check sees valid value)
budgetSchema.pre('validate', function () {
  if (this.status !== 'desactivated') {
    this.status = this.usedAmount > this.budget ? 'passed' : 'respected';
  }
});

module.exports = mongoose.model('Budget', budgetSchema);
