/**
 * KRISHI-AI Backend API Server
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (look in current dir, then root)
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import schemeRoutes from './routes/schemes';
import documentRoutes from './routes/documents';
import applicationRoutes from './routes/applications';
import mockGovRoutes from './routes/mockGov';
import syncRoutes from './routes/sync';
import healthRoutes from './routes/health';
import adminRoutes from './routes/admin';
import aiChatRoutes from './routes/aiChat';

const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Request logging (redact sensitive data)
app.use((req, res, next) => {
  const sanitizedBody = { ...req.body };
  if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
  if (sanitizedBody.otp) sanitizedBody.otp = '[REDACTED]';

  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip
  });
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/schemes', schemeRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/application', applicationRoutes);
app.use('/api/v1/mock/gov', mockGovRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ai', aiChatRoutes);
app.use('/health', healthRoutes);
app.use('/healthz', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'KRISHI-AI Backend API',
    version: '1.0.0',
    status: 'running',
    docs: '/api-docs'
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`KRISHI-AI Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
