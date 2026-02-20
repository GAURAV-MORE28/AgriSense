/**
 * Scheme matching routes
 */

import { Router, Response } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import * as db from '../config/db';

const router = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * GET /api/v1/schemes
 * Get scheme recommendations for the logged-in user's profile
 */
router.get('/',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;
      const { top_k = '10' } = req.query;

      // Fetch the real profile from DB
      const profileRes = await db.query(
        'SELECT * FROM farmer_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileRes.rows.length === 0) {
        throw new ApiError(400, 'Please create a profile first');
      }

      const p = profileRes.rows[0];
      // Send ALL available fields to ML model for comprehensive matching
      const apiProfile = {
        profile_id: p.profile_id,
        name: p.name,
        mobile: p.mobile,
        state: p.state,
        district: p.district,
        village: p.village || null,
        land_type: p.land_type,
        acreage: parseFloat(p.acreage),
        main_crops: p.main_crops || [],
        family_count: p.family_count,
        annual_income: parseFloat(p.annual_income),
        farmer_type: p.farmer_type,
        // Extended fields for better ML matching
        education_level: p.education_level || 'none',
        irrigation_available: p.irrigation_available ?? false,
        loan_status: p.loan_status || 'none',
        bank_account_linked: p.bank_account_linked ?? false,
        aadhaar_linked: p.aadhaar_linked ?? false,
        caste_category: p.caste_category || 'general',
        livestock: p.livestock || [],
        soil_type: p.soil_type || 'unknown',
        water_source: p.water_source || 'rainfed',
        machinery_owned: p.machinery_owned || []
      };

      // Call ML service
      const response = await axios.post(
        `${ML_SERVICE_URL}/api/v1/schemes/match`,
        { profile: apiProfile, top_k: parseInt(top_k as string) },
        { timeout: 15000 }
      );

      logger.info(`Scheme match completed for user ${userId}`);

      // Normalize ML response to include legacy shape expected by E2E scripts
      const mlData = response.data || {};
      const recommendations = (mlData.recommendations || []).map((r: any) => {
        // If it's the modern shape (SchemeRecommendation), r has scheme_id, name, etc.
        // If it's the legacy shape, it might be { scheme: { scheme_id, name }, score, ... }
        const schemeData = r.scheme || r;
        return {
          scheme: schemeData,
          scheme_id: schemeData.scheme_id, // Ensure top-level for easy access
          name: schemeData.name,         // Ensure top-level for easy access
          score: r.score,
          why: r.why || [],
          eligibility_status: r.eligibility_status || 'unknown'
        };
      });

      res.json({
        profile_id: mlData.profile_id || apiProfile.profile_id,
        total_schemes_evaluated: mlData.total_schemes_evaluated || (mlData.recommendations || []).length,
        recommendations,
        processing_time_ms: mlData.processing_time_ms || 0
      });
    } catch (err) {
      if (err instanceof ApiError) {
        return next(err);
      }
      if (axios.isAxiosError(err)) {
        logger.error(`ML Service error: ${err.message}`);
        return next(new ApiError(503, 'Scheme matching service unavailable'));
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/schemes/match
 * Match schemes with provided profile data (direct JSON, no DB lookup)
 */
router.post('/match',
  optionalAuth,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { profile, documents, top_k = 10 } = req.body;

      if (!profile) {
        throw new ApiError(400, 'profile is required');
      }

      // Call ML service
      const response = await axios.post(
        `${ML_SERVICE_URL}/api/v1/schemes/match`,
        { profile, documents, top_k },
        { timeout: 15000 }
      );

      logger.info(`Scheme match completed`);

      res.json(response.data);
    } catch (err) {
      if (err instanceof ApiError) {
        return next(err);
      }
      if (axios.isAxiosError(err)) {
        logger.error(`ML Service error: ${err.message}`);
        return next(new ApiError(503, 'Scheme matching service unavailable'));
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/schemes/list
 * List all available schemes
 */
router.get('/list', async (req, res, next) => {
  try {
    const response = await axios.get(
      `${ML_SERVICE_URL}/api/v1/schemes`,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      logger.error(`ML Service error: ${err.message}`);
      return next(new ApiError(503, 'Scheme service unavailable'));
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
    const response = await axios.get(
      `${ML_SERVICE_URL}/api/v1/schemes/${req.params.id}`,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return next(new ApiError(404, 'Scheme not found'));
    }
    next(err);
  }
});

export default router;
