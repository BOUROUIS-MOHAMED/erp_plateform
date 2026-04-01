// models/Target.js
const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    trim: true,
    set: v => String(v).toLowerCase().trim(),
    index: true
  },
  amount: {
    type: Number,
    required: [true, "L'objectif est requis"],
    min: [0, "L'objectif ne peut pas être négatif"],
    set: v => Math.round(v * 100) / 100
  },
  realisedAmount: {
    type: Number,
    default: 0,
    min: [0, 'Le réalisé ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  status: {
    type: String,
    enum: ['desactivated', 'in_progress', 'reached', 'failed'],
    default: 'in_progress'
  },
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise']
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
targetSchema.pre('validate', function () {
  if (this.status === 'desactivated') return;
  if (this.realisedAmount >= this.amount) {
    this.status = 'reached';
  } else if (this.endDate < new Date()) {
    this.status = 'failed';
  } else {
    this.status = 'in_progress';
  }
});

// Virtual: progression percentage (0-100)
targetSchema.virtual('progression').get(function () {
  if (!this.amount) return 0;
  return Math.min((this.realisedAmount / this.amount) * 100, 100);
});

targetSchema.set('toJSON', { virtuals: true });
targetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Target', targetSchema);
