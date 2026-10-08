import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { setupSocketIO } from './realtime/socket.js';
import { errorHandler } from './middleware/error.js';
import { prisma } from './db/prisma.js';

import authRouter from './routes/auth.routes.js';
import mapsRouter from './routes/maps.routes.js';
import ridesRouter from './routes/rides.routes.js';
import driverRouter from './routes/driver.routes.js';
import paymentsRouter from './routes/payments.routes.js';
import promosRouter from './routes/promos.routes.js';
import supportRouter from './routes/support.routes.js';
import safetyRouter from './routes/safety.routes.js';
import adminRouter from './routes/admin.routes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // allow local OSM tile images and scripts
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any origin in dev / demo
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-user-role',
      'Idempotency-Key',
    ],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health Checks
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/readyz', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err: any) {
    res.status(503).json({ status: 'unready', error: err.message });
  }
});

// API Routes
app.use('/api/v1', authRouter);
app.use('/api/v1', mapsRouter);
app.use('/api/v1', ridesRouter);
app.use('/api/v1', driverRouter);
app.use('/api/v1', paymentsRouter);
app.use('/api/v1', promosRouter);
app.use('/api/v1', supportRouter);
app.use('/api/v1', safetyRouter);
app.use('/api/v1', adminRouter);

// Central Error Handler
app.use(errorHandler);

// Setup Realtime Socket.IO
setupSocketIO(server);

// Start Server only outside test runs
if (process.env.NODE_ENV !== 'test') {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Cab Booking API Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/healthz`);
    console.log(`📍 Database readyz: http://localhost:${PORT}/readyz`);
  });
}

export { app, server };

