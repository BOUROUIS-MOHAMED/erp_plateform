const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE',
      'UPDATE',
      'DELETE',
      'VIEW',
      'LOGIN',
      'LOGOUT',
      'EXPORT',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'TOGGLE_STATUS',
      'VALIDATE',
      'payment',
      'email_sent'
    ]
  },
  entity: {
    type: String,
    required: true,
    enum: [
      'USER',
      'PRODUCT',
      'INVOICE',
      'STOCK',
      'SUPPLIER',
      'CUSTOMER',
      'FINANCE',
      'ACCOUNT',
      'TARGET',
      'MONEYFLOW',
      'ORDER',
      'PAYMENT',
      'REPORT',
      'TRANSACTION'
    ]
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
