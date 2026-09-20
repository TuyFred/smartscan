const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const config = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const supermarketRoutes = require('./routes/supermarketRoutes');
const productRoutes = require('./routes/productRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const {
  cartRouter,
  cardRouter,
  rfidRouter,
  paymentRouter,
  exitRouter,
  receiptRouter,
  adminRouter,
} = require('./routes/otherRoutes');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join', ({ userId, supermarketId }) => {
    if (userId) socket.join(`user:${userId}`);
    if (supermarketId) socket.join(`supermarket:${supermarketId}`);
  });
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin) || config.isLocalhostOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false })
);

app.get('/health', (_req, res) => {
  res.send('ok');
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, service: 'SMARTSCAN API', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/supermarkets', supermarketRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/cart', cartRouter);
app.use('/api/cards', cardRouter);
app.use('/api/rfid', rfidRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/exit', exitRouter);
app.use('/api/receipts', receiptRouter);
app.use('/api/admin', adminRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`SMARTSCAN API running on port ${config.port}`);
});

module.exports = { app, server, io };
