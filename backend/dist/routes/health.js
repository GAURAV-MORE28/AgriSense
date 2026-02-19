"use strict";
/**
 * Health check routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
const SERVICE_START_TIME = Date.now();
/**
 * GET /health
 * Basic health check
 */
router.get('/', (req, res) => {
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
router.get('/ready', async (req, res) => {
    const checks = {
        backend: true
    };
    // Check ML service
    try {
        await axios_1.default.get(`${process.env.ML_SERVICE_URL || 'http://localhost:5000'}/health`, { timeout: 2000 });
        checks.ml_service = true;
    }
    catch {
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
router.get('/live', (req, res) => {
    res.json({ alive: true });
});
exports.default = router;
//# sourceMappingURL=health.js.map