/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const SERVICE_START_TIME = Date.now();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'krishi-ai-backend',
    uptime_seconds: Math.round((Date.now() - SERVICE_START_TIME) / 1000)
  });
});

/**
 * GET /health/ready
 * Readiness check for kubernetes
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    backend: true
  };
  
  // Check ML service
  try {
    await axios.get(
      `${process.env.ML_SERVICE_URL || 'http://localhost:5000'}/health`,
      { timeout: 2000 }
    );
    checks.ml_service = true;
  } catch {
    checks.ml_service = false;
  }
  
  const ready = Object.values(checks).every(v => v);
  
  res.status(ready ? 200 : 503).json({
    ready,
    checks
  });
});

/**
 * GET /health/live
 * Liveness check for kubernetes
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true });
});

export default router;
