// models/MoneyFlow.js
const mongoose = require('mongoose');

const moneyFlowSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    trim: true,
    set: v => String(v).toLowerCase().trim(),
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0, 'Le montant ne peut pas être négatif'],
    set: v => Math.round(v * 100) / 100
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  isExpense: {
    type: Boolean,
    required: [true, 'Le type (dépense/revenu) est requis']
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'La note ne peut pas dépasser 500 caractères']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('MoneyFlow', moneyFlowSchema);
