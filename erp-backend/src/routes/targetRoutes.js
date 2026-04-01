// routes/targetRoutes.js
const express = require('express');
const router = express.Router();
const targetController = require('../controllers/targetController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

const adminOnly = authorize('admin_principal', 'admin_finance');

router.get('/', targetController.getAll);
router.get('/:id', targetController.getById);
router.post('/', adminOnly, targetController.create);
router.put('/:id', adminOnly, targetController.update);
router.patch('/:id/realised', adminOnly, targetController.updateRealised);
router.delete('/:id', adminOnly, targetController.delete);

module.exports = router;
