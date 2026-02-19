/**
 * Authentication routes
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import * as db from '../config/db';

const router = Router();

const OTP_EXPIRY_MINUTES = 5;

/**
 * POST /api/v1/auth/request-otp
 * Request OTP for login
 */
router.post('/request-otp',
  body('mobile').matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian mobile number'),
  async (req: Request, res: Response, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { mobile } = req.body;

      // Generate mock OTP (in production, send via SMS gateway)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in PostgreSQL
      await db.query(
        `INSERT INTO otp_tokens (mobile, otp, expires_at) VALUES ($1, $2, $3)`,
        [mobile, otp, expiresAt]
      );

      logger.info(`OTP generated for mobile: ${mobile.slice(0, 4)}****`);

      res.json({
        message: 'OTP sent successfully',
        demo_otp: process.env.NODE_ENV !== 'production' ? otp : undefined
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Verify OTP and login
 */
router.post('/login',
  body('mobile').matches(/^[6-9]\d{9}$/),
  body('otp').isLength({ min: 6, max: 6 }),
  async (req: Request, res: Response, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { mobile, otp } = req.body;

      // Verify OTP from database
      const otpResult = await db.query(
        `SELECT token_id, otp, expires_at FROM otp_tokens 
         WHERE mobile = $1 AND used = FALSE AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [mobile]
      );

      if (otpResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
      }

      const storedOtp = otpResult.rows[0];
      if (storedOtp.otp !== otp) {
        return res.status(401).json({ error: 'Invalid OTP' });
      }

      // Mark OTP as used
      await db.query(
        'UPDATE otp_tokens SET used = TRUE WHERE token_id = $1',
        [storedOtp.token_id]
      );

      // Get or create user in DB
      let user;
      const result = await db.query('SELECT * FROM users WHERE mobile = $1', [mobile]);

      if (result.rows.length > 0) {
        user = result.rows[0];
      } else {
        const insertResult = await db.query(
          'INSERT INTO users (mobile) VALUES ($1) RETURNING *',
          [mobile]
        );
        user = insertResult.rows[0];
      }

      // Generate JWT (includes role for admin access)
      const jwtSecret = process.env.JWT_SECRET || 'default-secret';
      const token = jwt.sign(
        { userId: user.user_id, mobile: user.mobile, role: user.role || 'user' },
        jwtSecret as string,
        { expiresIn: '7d' }
      );

      logger.info(`User logged in: ${mobile.slice(0, 4)}****`);

      res.json({
        token,
        user: {
          userId: user.user_id,
          mobile: user.mobile,
          role: user.role || 'user'
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh',
  body('token').notEmpty(),
  async (req: Request, res: Response) => {
    const { token } = req.body;

    try {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret';
      const decoded = jwt.verify(
        token,
        jwtSecret as string
      ) as { userId: string; mobile: string };

      const newToken = jwt.sign(
        { userId: decoded.userId, mobile: decoded.mobile },
        jwtSecret as string,
        { expiresIn: '7d' }
      );

      res.json({ token: newToken });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
);

export default router;
