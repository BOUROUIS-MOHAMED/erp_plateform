// routes/moneyFlowRoutes.js
const express = require('express');
const router = express.Router();
const moneyFlowController = require('../controllers/moneyFlowController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

const adminOnly = authorize('admin_principal', 'admin_finance');

router.get('/', moneyFlowController.getAll);
router.get('/:id', moneyFlowController.getById);
router.post('/', adminOnly, moneyFlowController.create);
router.put('/:id', adminOnly, moneyFlowController.update);
router.delete('/:id', adminOnly, moneyFlowController.delete);

module.exports = router;
