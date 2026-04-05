// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const accountRoutes = require('./routes/accountRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const stockMovementRoutes = require('./routes/stockMovementRoutes');
const orderRoutes = require('./routes/orderRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const financeRoutes = require('./routes/financeRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const targetRoutes = require('./routes/targetRoutes');
const moneyFlowRoutes = require('./routes/moneyFlowRoutes');
const dashboardPrincipalRoutes = require('./routes/dashboardPrincipalRoutes');
const dashboardFactureRoutes = require('./routes/dashboardFactureRoutes');
const dashboardStockRoutes = require('./routes/dashboardStockRoutes');
const dashboardFinanceRoutes = require('./routes/dashboardFinanceRoutes');

// CrÃ©er l'application
const app = express();

// ============================================
// MIDDLEWARE DE DÃ‰BOGAGE (Ã  garder temporairement)
// ============================================
app.use((req, res, next) => {
  console.log(`\nðŸ” [${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('   Headers:', req.headers['content-type']);
  console.log('   Body:', req.body);
  
  // VÃ©rification que next est une fonction
  if (typeof next !== 'function') {
    console.error('âŒ ERREUR CRITIQUE: next n\'est pas une fonction');
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur middleware - next non dÃ©fini' 
    });
  }
  
  next();
});

// ============================================
// 1. Security
// ============================================
app.use(helmet());

// ============================================
// 2. CORS
// ============================================
const defaultAllowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(',')
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    const isLocalDevOrigin = typeof origin === 'string'
      && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

    if (!origin || isLocalDevOrigin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// 3. Rate limiting
// ============================================
const apiRateLimitMax = process.env.NODE_ENV === 'development' ? 5000 : 1000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: apiRateLimitMax,
  message: {
    success: false,
    message: 'Trop de requ\u00EAtes, veuillez r\u00E9essayer plus tard.'
  },
  
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// 5. Logging
// ============================================
app.use(morgan('dev'));

// ============================================
// 6. Routes
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stock', stockMovementRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/money-flow', moneyFlowRoutes);
app.use('/api/dashboard/principal', dashboardPrincipalRoutes);
app.use('/api/dashboard/facture', dashboardFactureRoutes);
app.use('/api/dashboard/stock', dashboardStockRoutes);
app.use('/api/dashboard/finance', dashboardFinanceRoutes);

// ============================================
// 7. Routes de test
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date(), 
    message: 'Serveur ERP opérationnel',
    version: '1.0.0'
    });
});

app.get('/api/test', (req, res) => {
  console.log('âœ… Route /api/test appelÃ©e depuis:', req.headers.origin);
  res.json({ 
    success: true,
    message: 'Back-end ERP fonctionne correctement',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 8. Gestion des erreurs 404 - Ã€ GARDER Ã€ LA FIN
// ============================================
app.use((req, res) => {
  console.log('âŒ Route non trouvÃ©e:', req.method, req.url);
  res.status(404).json({ 
    success: false,
    message: 'Route non trouvÃ©e',
    path: req.url
  });
});

// ============================================
// 9. Error handler - DOIT AVOIR 4 PARAMÃˆTRES (err, req, res, next)
// ============================================
app.use((err, req, res, next) => {
  console.error('âŒ Erreur serveur:', err);
  
  // VÃ©rifier le type d'erreur
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Erreur de validation',
      errors: err.errors 
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      success: false, 
      message: 'Non autorisé' 
    });
  }
  
  // Erreur par dÃ©faut
  res.status(500).json({ 
    success: false,
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
module.exports = app;
