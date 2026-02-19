"use strict";
/**
 * Scheme matching routes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const db = __importStar(require("../config/db"));
const router = (0, express_1.Router)();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
/**
 * GET /api/v1/schemes
 * Get scheme recommendations for the logged-in user's profile
 */
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { top_k = '10' } = req.query;
        // Fetch the real profile from DB
        const profileRes = await db.query('SELECT * FROM farmer_profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0) {
            throw new errorHandler_1.ApiError(400, 'Please create a profile first');
        }
        const p = profileRes.rows[0];
        const apiProfile = {
            profile_id: p.profile_id,
            name: p.name,
            mobile: p.mobile,
            state: p.state,
            district: p.district,
            village: p.village,
            land_type: p.land_type,
            acreage: parseFloat(p.acreage),
            main_crops: p.main_crops,
            family_count: p.family_count,
            annual_income: parseFloat(p.annual_income),
            farmer_type: p.farmer_type
        };
        // Call ML service
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/api/v1/schemes/match`, { profile: apiProfile, top_k: parseInt(top_k) }, { timeout: 15000 });
        logger_1.logger.info(`Scheme match completed for user ${userId}`);
        res.json(response.data);
    }
    catch (err) {
        if (err instanceof errorHandler_1.ApiError) {
            return next(err);
        }
        if (axios_1.default.isAxiosError(err)) {
            logger_1.logger.error(`ML Service error: ${err.message}`);
            return next(new errorHandler_1.ApiError(503, 'Scheme matching service unavailable'));
        }
        next(err);
    }
});
/**
 * POST /api/v1/schemes/match
 * Match schemes with provided profile data (direct JSON, no DB lookup)
 */
router.post('/match', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { profile, documents, top_k = 10 } = req.body;
        if (!profile) {
            throw new errorHandler_1.ApiError(400, 'profile is required');
        }
        // Call ML service
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/api/v1/schemes/match`, { profile, documents, top_k }, { timeout: 15000 });
        logger_1.logger.info(`Scheme match completed`);
        res.json(response.data);
    }
    catch (err) {
        if (err instanceof errorHandler_1.ApiError) {
            return next(err);
        }
        if (axios_1.default.isAxiosError(err)) {
            logger_1.logger.error(`ML Service error: ${err.message}`);
            return next(new errorHandler_1.ApiError(503, 'Scheme matching service unavailable'));
        }
        next(err);
    }
});
/**
 * GET /api/v1/schemes/list
 * List all available schemes
 */
router.get('/list', async (req, res, next) => {
    try {
        const response = await axios_1.default.get(`${ML_SERVICE_URL}/api/v1/schemes`, { timeout: 5000 });
        res.json(response.data);
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err)) {
            logger_1.logger.error(`ML Service error: ${err.message}`);
            return next(new errorHandler_1.ApiError(503, 'Scheme service unavailable'));
        }
        next(err);
    }
});
/**
 * GET /api/v1/schemes/:id
 * Get scheme details
 */
router.get('/:id', async (req, res, next) => {
    try {
        const response = await axios_1.default.get(`${ML_SERVICE_URL}/api/v1/schemes/${req.params.id}`, { timeout: 5000 });
        res.json(response.data);
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err) && err.response?.status === 404) {
            return next(new errorHandler_1.ApiError(404, 'Scheme not found'));
        }
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=schemes.js.map