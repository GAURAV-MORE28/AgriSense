/**
 * Farmer Profile routes
 */

import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import * as db from '../config/db';

const router = Router();

/**
 * POST /api/v1/profile
 * Create or update farmer profile
 */
router.post('/',
  authenticate,
  body('name').notEmpty().trim(),
  body('state').notEmpty().trim(),
  body('district').notEmpty().trim(),
  body('land_type').isIn(['irrigated', 'dry', 'mixed']),
  body('acreage').isFloat({ min: 0 }),
  body('main_crops').isArray({ min: 1 }),
  body('family_count').isInt({ min: 1 }),
  body('annual_income').isFloat({ min: 0 }),
  body('farmer_type').isIn(['owner', 'tenant', 'sharecropper']),
  // Extended fields (all optional)
  body('education_level').optional().isString(),
  body('irrigation_available').optional().isBoolean(),
  body('loan_status').optional().isIn(['none', 'active', 'repaid', 'defaulted']),
  body('bank_account_linked').optional().isBoolean(),
  body('aadhaar_linked').optional().isBoolean(),
  body('caste_category').optional().isIn(['general', 'obc', 'sc', 'st', 'nt', 'vjnt']),
  body('livestock').optional().isArray(),
  body('soil_type').optional().isString(),
  body('water_source').optional().isString(),
  body('machinery_owned').optional().isArray(),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const mobile = req.user!.mobile;

      const {
        name, state, district, village, gps_lat, gps_lng,
        land_type, acreage, main_crops, family_count, annual_income, farmer_type,
        education_level, irrigation_available, loan_status,
        bank_account_linked, aadhaar_linked, caste_category,
        livestock, soil_type, water_source, machinery_owned
      } = req.body;

      // Check for existing profile
      const checkRes = await db.query('SELECT profile_id FROM farmer_profiles WHERE user_id = $1', [userId]);
      const existingProfile = checkRes.rows[0];

      let profile;
      let useExtendedFields = true;

      try {
        if (existingProfile) {
          // Try updating with extended fields first
          const updateRes = await db.query(
            `UPDATE farmer_profiles SET 
             name = $1, state = $2, district = $3, village = $4, 
             gps_lat = $5, gps_lng = $6, land_type = $7, acreage = $8, 
             main_crops = $9, family_count = $10, annual_income = $11, 
             farmer_type = $12,
             education_level = COALESCE($13, education_level),
             irrigation_available = COALESCE($14, irrigation_available),
             loan_status = COALESCE($15, loan_status),
             bank_account_linked = COALESCE($16, bank_account_linked),
             aadhaar_linked = COALESCE($17, aadhaar_linked),
             caste_category = COALESCE($18, caste_category),
             livestock = COALESCE($19, livestock),
             soil_type = COALESCE($20, soil_type),
             water_source = COALESCE($21, water_source),
             machinery_owned = COALESCE($22, machinery_owned)
             WHERE user_id = $23 RETURNING *`,
            [
              name, state, district, village,
              gps_lat, gps_lng, land_type, acreage,
              main_crops, family_count, annual_income, farmer_type,
              education_level, irrigation_available, loan_status,
              bank_account_linked, aadhaar_linked, caste_category,
              livestock || null, soil_type, water_source, machinery_owned || null,
              userId
            ]
          );
          profile = updateRes.rows[0];
          logger.info(`Profile updated with extended fields: ${profile.profile_id}`);
        } else {
          // Try inserting with extended fields first
          const insertRes = await db.query(
            `INSERT INTO farmer_profiles (
              user_id, name, mobile, state, district, village, 
              gps_lat, gps_lng, land_type, acreage, main_crops, 
              family_count, annual_income, farmer_type,
              education_level, irrigation_available, loan_status,
              bank_account_linked, aadhaar_linked, caste_category,
              livestock, soil_type, water_source, machinery_owned
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
            [
              userId, name, mobile, state, district, village,
              gps_lat, gps_lng, land_type, acreage,
              main_crops, family_count, annual_income, farmer_type,
              education_level || 'none', irrigation_available ?? false, loan_status || 'none',
              bank_account_linked ?? false, aadhaar_linked ?? false, caste_category || 'general',
              livestock || [], soil_type || 'unknown', water_source || 'rainfed', machinery_owned || []
            ]
          );
          profile = insertRes.rows[0];
          logger.info(`Profile created with extended fields: ${profile.profile_id}`);
        }
      } catch (columnErr) {
        // Fallback: use basic fields if extended columns don't exist
        useExtendedFields = false;
        logger.warn('Extended profile fields not available, using fallback', { err: (columnErr as Error).message });
        if (existingProfile) {
          const updateRes = await db.query(
            `UPDATE farmer_profiles SET 
             name = $1, state = $2, district = $3, village = $4, 
             gps_lat = $5, gps_lng = $6, land_type = $7, acreage = $8, 
             main_crops = $9, family_count = $10, annual_income = $11, 
             farmer_type = $12
             WHERE user_id = $13 RETURNING *`,
            [
              name, state, district, village,
              gps_lat, gps_lng, land_type, acreage,
              main_crops, family_count, annual_income, farmer_type,
              userId
            ]
          );
          profile = updateRes.rows[0];
        } else {
          const insertRes = await db.query(
            `INSERT INTO farmer_profiles (
              user_id, name, mobile, state, district, village, 
              gps_lat, gps_lng, land_type, acreage, main_crops, 
              family_count, annual_income, farmer_type
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [
              userId, name, mobile, state, district, village,
              gps_lat, gps_lng, land_type, acreage,
              main_crops, family_count, annual_income, farmer_type
            ]
          );
          profile = insertRes.rows[0];
        }
        // Append extended fields to response for consistency
        profile = {
          ...profile,
          education_level: education_level || 'none',
          irrigation_available: irrigation_available ?? false,
          loan_status: loan_status || 'none',
          bank_account_linked: bank_account_linked ?? false,
          aadhaar_linked: aadhaar_linked ?? false,
          caste_category: caste_category || 'general',
          livestock: livestock || [],
          soil_type: soil_type || 'unknown',
          water_source: water_source || 'rainfed',
          machinery_owned: machinery_owned || []
        };
      }

      res.status(existingProfile ? 200 : 201).json({
        message: existingProfile ? 'Profile updated' : 'Profile created',
        profile,
        extended_fields_available: useExtendedFields
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/profile
 * Get current user's profile
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const result = await db.query('SELECT * FROM farmer_profiles WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/profile/:id
 * Get profile by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const result = await db.query('SELECT * FROM farmer_profiles WHERE profile_id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
