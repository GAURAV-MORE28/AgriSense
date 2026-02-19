"use strict";
/**
 * Farmer Profile routes
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const db = __importStar(require("../config/db"));
const router = (0, express_1.Router)();
/**
 * POST /api/v1/profile
 * Create or update farmer profile
 */
router.post('/', auth_1.authenticate, (0, express_validator_1.body)('name').notEmpty().trim(), (0, express_validator_1.body)('state').notEmpty().trim(), (0, express_validator_1.body)('district').notEmpty().trim(), (0, express_validator_1.body)('land_type').isIn(['irrigated', 'dry', 'mixed']), (0, express_validator_1.body)('acreage').isFloat({ min: 0 }), (0, express_validator_1.body)('main_crops').isArray({ min: 1 }), (0, express_validator_1.body)('family_count').isInt({ min: 1 }), (0, express_validator_1.body)('annual_income').isFloat({ min: 0 }), (0, express_validator_1.body)('farmer_type').isIn(['owner', 'tenant', 'sharecropper']), async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.userId;
        const mobile = req.user.mobile;
        // Check for existing profile
        const checkRes = await db.query('SELECT * FROM farmer_profiles WHERE user_id = $1', [userId]);
        const existingProfile = checkRes.rows[0];
        let profile;
        if (existingProfile) {
            // Update existing profile
            const updateRes = await db.query(`UPDATE farmer_profiles SET 
           name = $1, state = $2, district = $3, village = $4, 
           gps_lat = $5, gps_lng = $6, land_type = $7, acreage = $8, 
           main_crops = $9, family_count = $10, annual_income = $11, 
           farmer_type = $12 
           WHERE user_id = $13 RETURNING *`, [
                req.body.name, req.body.state, req.body.district, req.body.village,
                req.body.gps_lat, req.body.gps_lng, req.body.land_type, req.body.acreage,
                req.body.main_crops, req.body.family_count, req.body.annual_income,
                req.body.farmer_type, userId
            ]);
            profile = updateRes.rows[0];
            logger_1.logger.info(`Profile updated: ${profile.profile_id}`);
        }
        else {
            // Create new profile
            const insertRes = await db.query(`INSERT INTO farmer_profiles (
            user_id, name, mobile, state, district, village, 
            gps_lat, gps_lng, land_type, acreage, main_crops, 
            family_count, annual_income, farmer_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`, [
                userId, req.body.name, mobile, req.body.state, req.body.district, req.body.village,
                req.body.gps_lat, req.body.gps_lng, req.body.land_type, req.body.acreage,
                req.body.main_crops, req.body.family_count, req.body.annual_income, req.body.farmer_type
            ]);
            profile = insertRes.rows[0];
            logger_1.logger.info(`Profile created: ${profile.profile_id}`);
        }
        res.status(existingProfile ? 200 : 201).json({
            message: existingProfile ? 'Profile updated' : 'Profile created',
            profile
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/v1/profile
 * Get current user's profile
 */
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const result = await db.query('SELECT * FROM farmer_profiles WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ profile: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/v1/profile/:id
 * Get profile by ID
 */
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM farmer_profiles WHERE profile_id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ profile: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=profile.js.map