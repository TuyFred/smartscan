const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

router.post('/register', upload.single('profileImage'), auth.register);
router.post('/verify-otp', auth.verifyOtp);
router.post('/resend-otp', auth.resendOtp);
router.post('/login', auth.login);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.get('/me', requireAuth, auth.me);
router.put('/profile', requireAuth, upload.single('profileImage'), auth.updateProfile);

// Payment PIN: customer creates/resets → email OTP → admin approves
router.post('/payment-pin', requireAuth, requireRole('CUSTOMER'), auth.requestPaymentPin);
router.post('/payment-pin/request', requireAuth, requireRole('CUSTOMER'), auth.requestPaymentPin);
router.post('/payment-pin/verify-otp', requireAuth, requireRole('CUSTOMER'), auth.verifyPaymentPinOtp);
router.post('/payment-pin/resend-otp', requireAuth, requireRole('CUSTOMER'), auth.resendPaymentPinOtp);
router.get('/payment-pin/status', requireAuth, requireRole('CUSTOMER'), auth.getPaymentPinStatus);

module.exports = router;
