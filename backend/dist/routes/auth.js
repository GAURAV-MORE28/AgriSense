"use strict";
/**
 * Authentication routes
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
const express_validator_1 = require("express-validator");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const db = __importStar(require("../config/db"));
const router = (0, express_1.Router)();
const OTP_EXPIRY_MINUTES = 5;
/**
 * POST /api/v1/auth/request-otp
 * Request OTP for login
 */
router.post('/request-otp', (0, express_validator_1.body)('mobile').matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian mobile number'), async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { mobile } = req.body;
        // Generate mock OTP (in production, send via SMS gateway)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        // Store OTP in PostgreSQL
        await db.query(`INSERT INTO otp_tokens (mobile, otp, expires_at) VALUES ($1, $2, $3)`, [mobile, otp, expiresAt]);
        logger_1.logger.info(`OTP generated for mobile: ${mobile.slice(0, 4)}****`);
        res.json({
            message: 'OTP sent successfully',
            demo_otp: process.env.NODE_ENV !== 'production' ? otp : undefined
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/v1/auth/login
 * Verify OTP and login
 */
router.post('/login', (0, express_validator_1.body)('mobile').matches(/^[6-9]\d{9}$/), (0, express_validator_1.body)('otp').isLength({ min: 6, max: 6 }), async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { mobile, otp } = req.body;
        // Verify OTP from database
        const otpResult = await db.query(`SELECT token_id, otp, expires_at FROM otp_tokens 
         WHERE mobile = $1 AND used = FALSE AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`, [mobile]);
        if (otpResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }
        const storedOtp = otpResult.rows[0];
        if (storedOtp.otp !== otp) {
            return res.status(401).json({ error: 'Invalid OTP' });
        }
        // Mark OTP as used
        await db.query('UPDATE otp_tokens SET used = TRUE WHERE token_id = $1', [storedOtp.token_id]);
        // Get or create user in DB
        let user;
        const result = await db.query('SELECT * FROM users WHERE mobile = $1', [mobile]);
        if (result.rows.length > 0) {
            user = result.rows[0];
        }
        else {
            const insertResult = await db.query('INSERT INTO users (mobile) VALUES ($1) RETURNING *', [mobile]);
            user = insertResult.rows[0];
        }
        // Generate JWT
        const jwtSecret = process.env.JWT_SECRET || 'default-secret';
        const token = jsonwebtoken_1.default.sign({ userId: user.user_id, mobile: user.mobile }, jwtSecret, { expiresIn: '7d' });
        logger_1.logger.info(`User logged in: ${mobile.slice(0, 4)}****`);
        res.json({
            token,
            user: {
                userId: user.user_id,
                mobile: user.mobile
            }
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/v1/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', (0, express_validator_1.body)('token').notEmpty(), async (req, res) => {
    const { token } = req.body;
    try {
        const jwtSecret = process.env.JWT_SECRET || 'default-secret';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        const newToken = jsonwebtoken_1.default.sign({ userId: decoded.userId, mobile: decoded.mobile }, jwtSecret, { expiresIn: '7d' });
        res.json({ token: newToken });
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map