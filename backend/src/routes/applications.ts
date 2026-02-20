/**
 * Application submission and tracking routes
 */

import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import * as db from '../config/db';

const router = Router();

/**
 * POST /api/v1/application/submit
 * Submit a new application
 */
router.post('/submit',
  authenticate,
  body('profile_id').notEmpty(),
  body('scheme_id').notEmpty(),
  body('scheme_name').notEmpty(),
  body('documents').isArray(),
  body('form_data').isObject(),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const { profile_id, scheme_id, scheme_name, documents, form_data, client_timestamp } = req.body;

      const now = new Date().toISOString();
      const statusHistory = [
        { status: 'SUBMITTED', timestamp: now, message: 'Application submitted successfully' }
      ];

      // Simulate sending to government API first to get reference
      let govApplicationId: string | null = null;
      let status = 'SUBMITTED';

      try {
        const port = process.env.BACKEND_PORT || process.env.PORT || 4000;
        const mockGovUrl = process.env.MOCK_GOV_URL || `http://localhost:${port}/api/v1/mock/gov`;
        const govResponse = await axios.post(
          `${mockGovUrl}/submit`,
          {
            application_id: null,
            scheme_id,
            profile_id,
            form_data
          },
          { timeout: 5000 }
        );

        govApplicationId = govResponse.data.gov_application_id;
        status = 'RECEIVED';
        statusHistory.push({
          status: 'RECEIVED',
          timestamp: new Date().toISOString(),
          message: 'Application received by government portal'
        });
      } catch (err) {
        logger.warn('Failed to submit to mock govt API, marking as pending');
        status = 'PENDING_SUBMISSION';
      }

      // Convert documents array to UUID[] format for PostgreSQL
      const docArray = Array.isArray(documents) ? documents : [];

      const insertResult = await db.query(
        `INSERT INTO applications (
          user_id, profile_id, scheme_id, scheme_name, documents, form_data,
          gov_application_id, status, status_history, synced, client_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
        RETURNING application_id, gov_application_id, status, created_at`,
        [
          userId,
          profile_id,
          scheme_id,
          scheme_name,
          docArray,
          JSON.stringify(form_data || {}),
          govApplicationId,
          status,
          JSON.stringify(statusHistory),
          client_timestamp || now
        ]
      );

      const app = insertResult.rows[0];

      logger.info(`Application submitted: ${app.application_id}`);

      res.status(201).json({
        application_id: app.application_id,
        gov_application_id: app.gov_application_id,
        status: app.status,
        message: 'Application submitted successfully'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/application/:id/status
 * Get application status and timeline
 */
router.get('/:id/status',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const result = await db.query(
        `SELECT application_id, user_id, profile_id, scheme_id, scheme_name,
                gov_application_id, status, status_history, created_at, updated_at
         FROM applications WHERE application_id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return next(new ApiError(404, 'Application not found'));
      }

      const application = result.rows[0];
      if (application.user_id !== req.user!.userId) {
        return next(new ApiError(403, 'Access denied'));
      }

      let statusHistory = application.status_history || [];
      let status = application.status;

      // Check for status updates from government API
      if (application.gov_application_id) {
        try {
          const port = process.env.BACKEND_PORT || process.env.PORT || 4000;
          const mockGovUrl = process.env.MOCK_GOV_URL || `http://localhost:${port}/api/v1/mock/gov`;
          const statusResponse = await axios.get(
            `${mockGovUrl}/status/${application.gov_application_id}`,
            { timeout: 5000 }
          );

          const newStatus = statusResponse.data.status;
          if (newStatus !== status) {
            status = newStatus;
            const newEntry = {
              status: newStatus,
              timestamp: new Date().toISOString(),
              message: statusResponse.data.message || ''
            };
            statusHistory = Array.isArray(statusHistory) ? [...statusHistory, newEntry] : [newEntry];

            await db.query(
              'UPDATE applications SET status = $1, status_history = $2, updated_at = NOW() WHERE application_id = $3',
              [status, JSON.stringify(statusHistory), application.application_id]
            );
          }
        } catch (err) {
          logger.warn('Failed to fetch status from mock govt API');
        }
      }

      res.json({
        application_id: application.application_id,
        gov_application_id: application.gov_application_id,
        scheme_id: application.scheme_id,
        scheme_name: application.scheme_name,
        status,
        status_history: statusHistory,
        created_at: application.created_at,
        updated_at: application.updated_at
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/application
 * List user's applications
 */
router.get('/',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;

      const result = await db.query(
        `SELECT application_id, scheme_id, scheme_name, status, created_at
         FROM applications WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        total: result.rows.length,
        applications: result.rows.map((r: any) => ({
          application_id: r.application_id,
          scheme_id: r.scheme_id,
          scheme_name: r.scheme_name,
          status: r.status,
          created_at: r.created_at
        }))
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
