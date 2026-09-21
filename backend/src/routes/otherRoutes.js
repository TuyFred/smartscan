const express = require('express');
const sessionCtrl = require('../controllers/sessionController');
const cardCtrl = require('../controllers/cardController');
const exitCtrl = require('../controllers/exitController');
const adminCtrl = require('../controllers/adminController');
const { requireAuth, requireRole, requireDeviceAuth } = require('../middleware/auth');

const cartRouter = express.Router();
cartRouter.put('/:id', requireAuth, requireRole('CUSTOMER'), sessionCtrl.updateCartItem);
cartRouter.delete('/:id', requireAuth, requireRole('CUSTOMER'), sessionCtrl.removeCartItem);

const cardRouter = express.Router();
cardRouter.get('/me', requireAuth, requireRole('CUSTOMER'), cardCtrl.getMyCard);
cardRouter.post('/', requireAuth, requireRole('ADMIN', 'CASHIER'), cardCtrl.registerCard);
cardRouter.post('/sell', requireAuth, requireRole('CASHIER', 'ADMIN'), cardCtrl.sellCard);
cardRouter.post('/deposit', requireAuth, requireRole('CASHIER', 'ADMIN'), cardCtrl.deposit);
cardRouter.get('/customers', requireAuth, requireRole('CASHIER', 'ADMIN', 'MANAGER'), cardCtrl.searchCustomers);
cardRouter.get('/store-customers', requireAuth, requireRole('MANAGER', 'ADMIN'), cardCtrl.listStoreCustomers);

const rfidRouter = express.Router();
rfidRouter.post('/read', requireDeviceAuth, cardCtrl.rfidRead);
rfidRouter.post('/read-staff', requireAuth, requireRole('CASHIER', 'MANAGER', 'ADMIN'), cardCtrl.rfidRead);

const paymentRouter = express.Router();
paymentRouter.post('/authorize', requireAuth, requireRole('CUSTOMER'), cardCtrl.authorizePayment);
paymentRouter.post('/cancel/:id', requireAuth, requireRole('CUSTOMER'), cardCtrl.cancelAuthorization);
paymentRouter.get('/', requireAuth, adminCtrl.listPayments);

const exitRouter = express.Router();
exitRouter.post('/verify', requireDeviceAuth, exitCtrl.verifyExit);
exitRouter.get('/verifications', requireAuth, requireRole('ADMIN', 'MANAGER'), exitCtrl.listVerifications);

const receiptRouter = express.Router();
receiptRouter.get('/', requireAuth, exitCtrl.listReceipts);
receiptRouter.get('/:id', requireAuth, exitCtrl.getReceipt);

const adminRouter = express.Router();
adminRouter.get('/stats', requireAuth, adminCtrl.dashboardStats);
adminRouter.get('/users', requireAuth, requireRole('ADMIN', 'MANAGER'), adminCtrl.listUsers);
adminRouter.patch('/users/:id', requireAuth, requireRole('ADMIN'), adminCtrl.updateUser);
adminRouter.patch('/users/:id/status', requireAuth, requireRole('ADMIN'), adminCtrl.approveUser);
adminRouter.delete('/users/:id', requireAuth, requireRole('ADMIN'), adminCtrl.deleteUser);
adminRouter.post('/staff', requireAuth, requireRole('ADMIN', 'MANAGER'), adminCtrl.createStaff);
adminRouter.get('/devices', requireAuth, requireRole('ADMIN', 'MANAGER'), adminCtrl.listDevices);
adminRouter.post('/devices', requireAuth, requireRole('ADMIN', 'MANAGER'), adminCtrl.registerDevice);
adminRouter.get('/audit-logs', requireAuth, requireRole('ADMIN'), adminCtrl.auditLogs);
adminRouter.get('/pin-requests', requireAuth, requireRole('ADMIN'), adminCtrl.listPinRequests);
adminRouter.patch('/pin-requests/:id', requireAuth, requireRole('ADMIN'), adminCtrl.reviewPinRequest);

module.exports = {
  cartRouter,
  cardRouter,
  rfidRouter,
  paymentRouter,
  exitRouter,
  receiptRouter,
  adminRouter,
};
