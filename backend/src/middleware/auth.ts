/**
 * JWT Authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    mobile: string;
    role: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

/**
 * Require valid JWT - rejects unauthenticated requests
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      mobile: string;
      role?: string;
    };

    req.user = {
      userId: decoded.userId,
      mobile: decoded.mobile,
      role: decoded.role || 'user'
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional auth - allows unauthenticated requests to pass through
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      mobile: string;
      role?: string;
    };

    req.user = {
      userId: decoded.userId,
      mobile: decoded.mobile,
      role: decoded.role || 'user'
    };
  } catch {
    // Invalid token -> treat as unauthenticated
  }
  next();
};

/**
 * Require admin role — must be used AFTER authenticate
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
