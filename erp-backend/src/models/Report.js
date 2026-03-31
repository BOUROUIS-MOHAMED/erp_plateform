// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true
  },
  type: {
    type: String,
    default: 'analytique'
  },
  format: {
    type: String,
    enum: ['pdf', 'excel', 'csv', 'json'],
    default: 'pdf'
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  fileUrl: String,
  fileSize: Number,
  generatedAt: Date,
  date: {
    type: Date,
    default: Date.now
  },
  author: {
    type: String,
    default: 'system'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour la recherche
reportSchema.index({ title: 'text', description: 'text' });
reportSchema.index({ type: 1, date: -1 });
reportSchema.index({ createdBy: 1, createdAt: -1 });
reportSchema.index({ isPublic: 1, type: 1 });

// Virtual pour la durée de génération
reportSchema.virtual('generationTime').get(function() {
  if (!this.generatedAt) return null;
  return this.generatedAt - this.createdAt;
});

// Méthode pour marquer comme généré
reportSchema.methods.markAsGenerated = function(fileUrl, fileSize) {
  this.generatedAt = new Date();
  this.fileUrl = fileUrl;
  this.fileSize = fileSize;
  this.status = 'completed';
  return this.save();
};

module.exports = mongoose.model('Report', reportSchema);