"use strict";
/**
 * Offline sync routes
 * Handles synchronization of offline data when connection is restored
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Track sync status per user
const syncStatus = new Map();
/**
 * GET /api/v1/sync/status
 * Get current sync status for user
 */
router.get('/status', auth_1.authenticate, async (req, res) => {
    const userId = req.user.userId;
    let status = syncStatus.get(userId);
    if (!status) {
        status = {
            user_id: userId,
            queued_profiles: 0,
            queued_applications: 0,
            synced_profiles: 0,
            synced_applications: 0,
            last_sync: null,
            conflicts: []
        };
        syncStatus.set(userId, status);
    }
    res.json(status);
});
/**
 * POST /api/v1/sync/batch
 * Sync a batch of offline data
 */
router.post('/batch', auth_1.authenticate, (0, express_validator_1.body)('profiles').optional().isArray(), (0, express_validator_1.body)('applications').optional().isArray(), (0, express_validator_1.body)('client_timestamp').notEmpty(), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user.userId;
    const { profiles = [], applications = [], client_timestamp } = req.body;
    const results = {
        profiles: [],
        applications: [],
        sync_timestamp: new Date().toISOString()
    };
    // Process profiles
    for (const profile of profiles) {
        // Check for conflicts (simplified - in production check actual DB)
        const hasConflict = Math.random() < 0.1; // 10% chance of conflict for demo
        if (hasConflict) {
            const conflict = {
                type: 'profile',
                id: profile.profile_id,
                client_timestamp: profile.updated_at,
                server_timestamp: new Date().toISOString(),
                resolution: 'pending'
            };
            results.profiles.push({
                id: profile.profile_id,
                status: 'conflict',
                conflict
            });
        }
        else {
            results.profiles.push({
                id: profile.profile_id,
                status: 'synced'
            });
        }
    }
    // Process applications
    for (const application of applications) {
        results.applications.push({
            id: application.application_id,
            status: 'synced'
        });
    }
    // Update sync status
    let status = syncStatus.get(userId);
    if (!status) {
        status = {
            user_id: userId,
            queued_profiles: 0,
            queued_applications: 0,
            synced_profiles: 0,
            synced_applications: 0,
            last_sync: null,
            conflicts: []
        };
    }
    status.synced_profiles += results.profiles.filter(p => p.status === 'synced').length;
    status.synced_applications += results.applications.filter(a => a.status === 'synced').length;
    status.last_sync = results.sync_timestamp;
    status.conflicts = results.profiles
        .filter(p => p.conflict)
        .map(p => p.conflict);
    syncStatus.set(userId, status);
    logger_1.logger.info(`Sync batch processed for user ${userId}: ${profiles.length} profiles, ${applications.length} applications`);
    res.json(results);
});
/**
 * POST /api/v1/sync/resolve
 * Resolve a sync conflict
 */
router.post('/resolve', auth_1.authenticate, (0, express_validator_1.body)('conflict_id').notEmpty(), (0, express_validator_1.body)('resolution').isIn(['client_wins', 'server_wins']), async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user.userId;
    const { conflict_id, resolution } = req.body;
    const status = syncStatus.get(userId);
    if (!status) {
        return res.status(404).json({ error: 'No sync status found' });
    }
    const conflictIndex = status.conflicts.findIndex(c => c.id === conflict_id);
    if (conflictIndex === -1) {
        return res.status(404).json({ error: 'Conflict not found' });
    }
    status.conflicts[conflictIndex].resolution = resolution;
    // Remove resolved conflicts
    status.conflicts = status.conflicts.filter(c => c.resolution === 'pending');
    syncStatus.set(userId, status);
    logger_1.logger.info(`Conflict resolved: ${conflict_id} -> ${resolution}`);
    res.json({
        message: 'Conflict resolved',
        resolution
    });
});
exports.default = router;
//# sourceMappingURL=sync.js.map