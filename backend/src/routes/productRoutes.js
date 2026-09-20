const express = require('express');
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/productController');
const { requireAuth, requireRole } = require('../middleware/auth');

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
  }),
});

const router = express.Router();

router.get('/', requireAuth, ctrl.listProducts);
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), upload.single('image'), ctrl.createProduct);
router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), upload.single('image'), ctrl.updateProduct);
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), ctrl.deleteProduct);
router.get('/:id/qrcode', requireAuth, ctrl.getProductQr);

module.exports = router;
