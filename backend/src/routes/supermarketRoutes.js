const express = require('express');
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/supermarketController');
const { requireAuth, requireRole } = require('../middleware/auth');

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
  }),
});

const router = express.Router();

router.get('/public', ctrl.publicList);
router.get('/', requireAuth, ctrl.listSupermarkets);
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER', 'CUSTOMER'), upload.single('logo'), ctrl.createSupermarket);
router.put('/:id', requireAuth, requireRole('ADMIN'), upload.single('logo'), ctrl.updateSupermarket);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ctrl.deleteSupermarket);
router.post('/:id/activate', requireAuth, requireRole('MANAGER'), ctrl.switchActiveSupermarket);
router.post('/branches', requireAuth, requireRole('ADMIN', 'MANAGER'), ctrl.addBranch);
router.get('/branches/:id/qrcode', requireAuth, ctrl.getBranchQr);

module.exports = router;
