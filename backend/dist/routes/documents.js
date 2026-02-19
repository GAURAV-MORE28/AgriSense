"use strict";
/**
 * Document upload and OCR routes
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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const db = __importStar(require("../config/db"));
const router = (0, express_1.Router)();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const UPLOADS_DIR = path_1.default.join(process.cwd(), 'uploads');
// Ensure uploads directory exists
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Configure multer for disk storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname) || '.bin';
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    }
});
/**
 * POST /api/v1/documents/upload
 * Upload document and process with OCR
 */
router.post('/upload', auth_1.authenticate, upload.single('file'), async (req, res, next) => {
    if (!req.file) {
        return next(new errorHandler_1.ApiError(400, 'No file uploaded'));
    }
    const userId = req.user.userId;
    const docTypeHint = req.body.doc_type_hint;
    try {
        // Read file and convert to base64 for OCR
        const fileBuffer = fs_1.default.readFileSync(req.file.path);
        const base64Image = fileBuffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
        // Call ML service for OCR
        const ocrResponse = await axios_1.default.post(`${ML_SERVICE_URL}/api/v1/ocr/process`, {
            image_base64: dataUrl,
            doc_type_hint: docTypeHint
        }, { timeout: 30000 });
        const ocrFields = ocrResponse.data.fields || {};
        const ocrConfidence = parseFloat(ocrResponse.data.ocr_confidence) || 0;
        const docType = ocrResponse.data.doc_type_guess || 'unknown';
        // Store document in PostgreSQL
        const insertResult = await db.query(`INSERT INTO documents (document_id, user_id, filename, mimetype, doc_type, ocr_fields, ocr_confidence, file_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING document_id, filename, doc_type, ocr_fields, ocr_confidence, uploaded_at`, [
            (0, uuid_1.v4)(),
            userId,
            req.file.originalname,
            req.file.mimetype,
            docType,
            JSON.stringify(ocrFields),
            ocrConfidence,
            req.file.filename
        ]);
        const doc = insertResult.rows[0];
        logger_1.logger.info(`Document uploaded: ${doc.document_id}`);
        res.status(201).json({
            document_id: doc.document_id,
            filename: doc.filename,
            doc_type_guess: doc.doc_type,
            fields: doc.ocr_fields || {},
            ocr_confidence: parseFloat(doc.ocr_confidence)
        });
    }
    catch (err) {
        // Clean up file on error
        if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        if (axios_1.default.isAxiosError(err)) {
            logger_1.logger.error(`OCR Service error: ${err.message}`);
            return next(new errorHandler_1.ApiError(503, 'OCR service unavailable'));
        }
        next(err);
    }
});
/**
 * PATCH /api/v1/documents/:id
 * Update/verify OCR fields (allow edit)
 */
router.patch('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { ocr_fields } = req.body;
        const checkRes = await db.query('SELECT document_id, user_id FROM documents WHERE document_id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return next(new errorHandler_1.ApiError(404, 'Document not found'));
        }
        if (checkRes.rows[0].user_id !== req.user.userId) {
            return next(new errorHandler_1.ApiError(403, 'Access denied'));
        }
        await db.query('UPDATE documents SET ocr_fields = $1 WHERE document_id = $2', [JSON.stringify(ocr_fields || {}), id]);
        const updated = await db.query('SELECT document_id, filename, doc_type, ocr_fields, ocr_confidence FROM documents WHERE document_id = $1', [id]);
        res.json({ document: updated.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/v1/documents
 * List user's uploaded documents
 */
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const result = await db.query(`SELECT document_id, user_id, filename, mimetype, doc_type, ocr_fields, ocr_confidence, uploaded_at
       FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC`, [userId]);
        res.json({
            documents: result.rows.map((r) => ({
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
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/v1/documents/:id
 * Get document details
 */
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM documents WHERE document_id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return next(new errorHandler_1.ApiError(404, 'Document not found'));
        }
        const doc = result.rows[0];
        if (doc.user_id !== req.user.userId) {
            return next(new errorHandler_1.ApiError(403, 'Access denied'));
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
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/v1/documents/:id/validate
 * Validate document against profile
 */
router.post('/:id/validate', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await db.query('SELECT document_id, user_id, ocr_fields FROM documents WHERE document_id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return next(new errorHandler_1.ApiError(404, 'Document not found'));
        }
        const document = result.rows[0];
        if (document.user_id !== req.user.userId) {
            return next(new errorHandler_1.ApiError(403, 'Access denied'));
        }
        const { profile_fields } = req.body;
        if (!profile_fields) {
            return next(new errorHandler_1.ApiError(400, 'profile_fields required'));
        }
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/api/v1/ocr/validate`, {
            ocr_fields: document.ocr_fields || {},
            profile_fields
        }, { timeout: 5000 });
        res.json(response.data);
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err)) {
            logger_1.logger.error(`Validation Service error: ${err.message}`);
            return next(new errorHandler_1.ApiError(503, 'Validation service unavailable'));
        }
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=documents.js.map