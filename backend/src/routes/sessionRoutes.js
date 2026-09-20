const express = require('express');
const ctrl = require('../controllers/sessionController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/start', requireAuth, requireRole('CUSTOMER'), ctrl.startSession);
router.get('/active', requireAuth, requireRole('CUSTOMER'), ctrl.getActiveSession);
router.get('/', requireAuth, ctrl.listSessions);
router.get('/:id', requireAuth, ctrl.getSession);
router.post('/:id/scan-product', requireAuth, requireRole('CUSTOMER'), ctrl.scanProduct);
router.post('/:id/cancel', requireAuth, requireRole('CUSTOMER'), ctrl.cancelSession);

module.exports = router;
