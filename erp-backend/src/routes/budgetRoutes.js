// routes/budgetRoutes.js
const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

const adminOnly = authorize('admin_principal', 'admin_finance');

router.get('/stats', budgetController.getStats);
router.get('/', budgetController.getAll);
router.get('/:id', budgetController.getById);
router.post('/', adminOnly, budgetController.create);
router.put('/:id', adminOnly, budgetController.update);
router.patch('/:id/used', adminOnly, budgetController.updateUsed);
router.delete('/:id', adminOnly, budgetController.delete);

module.exports = router;
