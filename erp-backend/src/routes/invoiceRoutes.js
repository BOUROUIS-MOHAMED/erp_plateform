const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  validateInvoice,
  markAsPaid,
  downloadInvoicePDF,    // ← Changé: generatePDF → downloadInvoicePDF
  getInvoiceStats,
  sendInvoiceEmail,
  searchInvoices,
  createCreditNote
} = require('../controllers/invoiceController');

router.use(protect);

// Routes spécifiques
router.get('/stats', getInvoiceStats);
router.get('/search', searchInvoices);
router.patch('/:id/validate', authorize('admin_principal', 'admin_facture'), validateInvoice);
router.patch('/:id/pay', authorize('admin_principal', 'admin_facture'), markAsPaid);
router.get('/:id/pdf', authorize('admin_principal', 'admin_facture'), downloadInvoicePDF); // ← Changé
router.post('/:id/email', authorize('admin_principal', 'admin_facture'), sendInvoiceEmail);
router.post('/:id/credit-note', authorize('admin_principal', 'admin_facture'), createCreditNote);

// Routes CRUD standard
router.route('/')
  .get(authorize('admin_principal', 'admin_facture', 'admin_finance'), getAllInvoices)
  .post(authorize('admin_principal', 'admin_facture'), createInvoice);

router.route('/:id')
  .get(getInvoiceById)
  .put(authorize('admin_principal', 'admin_facture'), updateInvoice)
  .delete(authorize('admin_principal'), deleteInvoice);

module.exports = router;