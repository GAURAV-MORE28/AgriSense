/**
 * Global error handler middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  statusCode: number;
  
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error (redact sensitive paths)
  const sanitizedPath = req.path.replace(/\/\d+/g, '/:id');
  logger.error(`Error on ${req.method} ${sanitizedPath}: ${err.message}`, {
    stack: err.stack
  });
  
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  return res.status(500).json({
    error: message
  });
};
