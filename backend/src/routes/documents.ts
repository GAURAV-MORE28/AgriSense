/**
 * Document upload and OCR routes
 */

import path from 'path';
import fs from 'fs';
import { Router, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import * as db from '../config/db';

const router = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

/**
 * POST /api/v1/documents/upload
 * Upload document and process with OCR
 */
router.post('/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next) => {
    if (!req.file) {
      return next(new ApiError(400, 'No file uploaded'));
    }

    const userId = req.user!.userId;
    const docTypeHint = req.body.doc_type_hint;

    try {
      // Read file and convert to base64 for OCR
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Image = fileBuffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      // Call ML service for OCR
      const ocrResponse = await axios.post(
        `${ML_SERVICE_URL}/api/v1/ocr/process`,
        {
          image_base64: dataUrl,
          doc_type_hint: docTypeHint
        },
        { timeout: 30000 }
      );

      const ocrFields = ocrResponse.data.fields || {};
      const ocrConfidence = parseFloat(ocrResponse.data.ocr_confidence) || 0;
      const docType = ocrResponse.data.doc_type_guess || 'unknown';

      // Store document in PostgreSQL
      const insertResult = await db.query(
        `INSERT INTO documents (document_id, user_id, filename, mimetype, doc_type, ocr_fields, ocr_confidence, file_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING document_id, filename, doc_type, ocr_fields, ocr_confidence, uploaded_at`,
        [
          uuidv4(),
          userId,
          req.file.originalname,
          req.file.mimetype,
          docType,
          JSON.stringify(ocrFields),
          ocrConfidence,
          req.file.filename
        ]
      );

      const doc = insertResult.rows[0];

      logger.info(`Document uploaded: ${doc.document_id}`);

      res.status(201).json({
        document_id: doc.document_id,
        filename: doc.filename,
        doc_type_guess: doc.doc_type,
        fields: doc.ocr_fields || {},
        ocr_confidence: parseFloat(doc.ocr_confidence)
      });
    } catch (err) {
      // Clean up file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (axios.isAxiosError(err)) {
        logger.error(`OCR Service error: ${err.message}`);
        return next(new ApiError(503, 'OCR service unavailable'));
      }
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/documents/:id
 * Update/verify OCR fields (allow edit)
 */
router.patch('/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const { ocr_fields } = req.body;

      const checkRes = await db.query(
        'SELECT document_id, user_id FROM documents WHERE document_id = $1',
        [id]
      );
      if (checkRes.rows.length === 0) {
        return next(new ApiError(404, 'Document not found'));
      }
      if (checkRes.rows[0].user_id !== req.user!.userId) {
        return next(new ApiError(403, 'Access denied'));
      }

      await db.query(
        'UPDATE documents SET ocr_fields = $1 WHERE document_id = $2',
        [JSON.stringify(ocr_fields || {}), id]
      );

      const updated = await db.query(
        'SELECT document_id, filename, doc_type, ocr_fields, ocr_confidence FROM documents WHERE document_id = $1',
        [id]
      );

      res.json({ document: updated.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/documents
 * List user's uploaded documents
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;

    const result = await db.query(
      `SELECT document_id, user_id, filename, mimetype, doc_type, ocr_fields, ocr_confidence, uploaded_at
       FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [userId]
    );

    res.json({
      documents: result.rows.map((r: any) => ({
        document_id: r.document_id,
        user_id: r.user_id,
        filename: r.filename,
        mimetype: r.mimetype,
        doc_type: r.doc_type,
        ocr_fields: r.ocr_fields || {},
        ocr_confidence: parseFloat(r.ocr_confidence || 0),
        uploaded_at: r.uploaded_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/documents/:id
 * Get document details
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM documents WHERE document_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return next(new ApiError(404, 'Document not found'));
    }

    const doc = result.rows[0];
    if (doc.user_id !== req.user!.userId) {
      return next(new ApiError(403, 'Access denied'));
    }

    res.json({
      document: {
        document_id: doc.document_id,
        user_id: doc.user_id,
        filename: doc.filename,
        mimetype: doc.mimetype,
        doc_type: doc.doc_type,
        ocr_fields: doc.ocr_fields || {},
        ocr_confidence: parseFloat(doc.ocr_confidence || 0),
        uploaded_at: doc.uploaded_at
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/documents/:id/validate
 * Validate document against profile
 */
router.post('/:id/validate',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const result = await db.query(
        'SELECT document_id, user_id, ocr_fields FROM documents WHERE document_id = $1',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return next(new ApiError(404, 'Document not found'));
      }
      const document = result.rows[0];
      if (document.user_id !== req.user!.userId) {
        return next(new ApiError(403, 'Access denied'));
      }

      const { profile_fields } = req.body;
      if (!profile_fields) {
        return next(new ApiError(400, 'profile_fields required'));
      }

      const response = await axios.post(
        `${ML_SERVICE_URL}/api/v1/ocr/validate`,
        {
          ocr_fields: document.ocr_fields || {},
          profile_fields
        },
        { timeout: 5000 }
      );

      res.json(response.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`Validation Service error: ${err.message}`);
        return next(new ApiError(503, 'Validation service unavailable'));
      }
      next(err);
    }
  }
);

export default router;
