"use strict";
/**
 * Admin dashboard routes
 * Provides analytics metrics, application management, fraud alerts
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
const auth_1 = require("../middleware/auth");
const db = __importStar(require("../config/db"));
const router = (0, express_1.Router)();
/**
 * GET /api/v1/admin/metrics
 * Dashboard metrics overview
 */
router.get('/metrics', auth_1.authenticate, async (req, res, next) => {
    try {
        // Total users
        const usersRes = await db.query('SELECT COUNT(*) as total FROM users');
        const totalUsers = parseInt(usersRes.rows[0].total);
        // Total profiles
        const profilesRes = await db.query('SELECT COUNT(*) as total FROM farmer_profiles');
        const totalProfiles = parseInt(profilesRes.rows[0].total);
        // Total applications + status breakdown
        const appsRes = await db.query(`
      SELECT status, COUNT(*) as count
      FROM applications
      GROUP BY status
    `);
        const appsByStatus = {};
        let totalApplications = 0;
        for (const row of appsRes.rows) {
            appsByStatus[row.status] = parseInt(row.count);
            totalApplications += parseInt(row.count);
        }
        // Total documents
        const docsRes = await db.query('SELECT COUNT(*) as total FROM documents');
        const totalDocuments = parseInt(docsRes.rows[0].total);
        // OCR success rate (confidence >= 0.7)
        const ocrRateRes = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE ocr_confidence >= 0.7) as success_count,
                COUNT(*) as total_count
            FROM documents
        `);
        const ocrSuccess = parseInt(ocrRateRes.rows[0].success_count || '0');
        const ocrTotal = parseInt(ocrRateRes.rows[0].total_count || '0');
        const ocr_success_rate = ocrTotal > 0 ? Math.round((ocrSuccess / ocrTotal) * 100) : 0;
        // Recent applications (last 7 days)
        const recentRes = await db.query(`
      SELECT COUNT(*) as count FROM applications
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
        const recentApplications = parseInt(recentRes.rows[0].count);
        // Average income of profiled farmers
        const incomeRes = await db.query('SELECT AVG(annual_income) as avg FROM farmer_profiles');
        const avgIncome = Math.round(parseFloat(incomeRes.rows[0].avg || '0'));
        // Top states
        const statesRes = await db.query(`
      SELECT state, COUNT(*) as count
      FROM farmer_profiles
      GROUP BY state
      ORDER BY count DESC
      LIMIT 5
    `);
        // Top schemes applied for
        const topSchemesRes = await db.query(`
      SELECT scheme_name, COUNT(*) as count
      FROM applications
      GROUP BY scheme_name
      ORDER BY count DESC
      LIMIT 5
    `);
        res.json({
            overview: {
                total_users: totalUsers,
                total_profiles: totalProfiles,
                total_applications: totalApplications,
                total_documents: totalDocuments,
                ocr_success_rate,
                recent_applications_7d: recentApplications,
                avg_farmer_income: avgIncome
            },
            applications_by_status: appsByStatus,
            top_states: statesRes.rows.map(r => ({ state: r.state, count: parseInt(r.count) })),
            top_schemes: topSchemesRes.rows.map(r => ({ scheme: r.scheme_name, count: parseInt(r.count) })),
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/v1/admin/applications
 * Paginated list of all applications
 */
router.get('/applications', auth_1.authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const countRes = await db.query('SELECT COUNT(*) as total FROM applications');
        const total = parseInt(countRes.rows[0].total);
        const appsRes = await db.query(`
      SELECT a.*, fp.name as farmer_name, fp.state, fp.district
      FROM applications a
      LEFT JOIN farmer_profiles fp ON a.profile_id = fp.profile_id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
        res.json({
            applications: appsRes.rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit)
            }
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/v1/admin/fraud-alerts
 * List documents with low OCR confidence (potential fraud)
 */
router.get('/fraud-alerts', auth_1.authenticate, async (req, res, next) => {
    try {
        const alertsRes = await db.query(`
      SELECT d.*, u.mobile
      FROM documents d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.ocr_confidence < 0.5
      ORDER BY d.uploaded_at DESC
      LIMIT 20
    `);
        res.json({
            alerts: alertsRes.rows,
            total: alertsRes.rows.length
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map