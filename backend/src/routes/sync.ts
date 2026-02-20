/**
 * Sync Route – Persistent offline data synchronization
 * Uses the PostgreSQL sync_queue table instead of in-memory storage
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import db from '../config/db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/* ───── GET sync status for a user ───── */
router.get('/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Count pending, synced, and conflict items
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
         COUNT(*) FILTER (WHERE status = 'synced')   AS synced,
         COUNT(*) FILTER (WHERE status = 'conflict') AS conflicts,
         MAX(synced_at)                               AS last_synced
       FROM sync_queue WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0] || {};

    res.json({
      userId,
      pending: parseInt(row.pending || '0', 10),
      synced: parseInt(row.synced || '0', 10),
      conflicts: parseInt(row.conflicts || '0', 10),
      lastSynced: row.last_synced || null
    });
  } catch (err) {
    next(err);
  }
});

/* ───── POST batch of offline changes ───── */
router.post('/batch', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results: Array<{ clientId: string; status: string; serverId?: string; error?: string }> = [];

    for (const item of items) {
      const { clientId, type, operation, data, clientTimestamp } = item;

      if (!clientId || !type || !operation || !data) {
        results.push({ clientId: clientId || 'unknown', status: 'error', error: 'Missing required fields' });
        continue;
      }

      try {
        // Check for conflicting updates (same entity modified on server since client's timestamp)
        if (operation === 'update' && clientTimestamp) {
          const existing = await db.query(
            `SELECT synced_at FROM sync_queue
             WHERE user_id = $1 AND entity_type = $2 AND client_id = $3 AND status = 'synced'
             ORDER BY synced_at DESC LIMIT 1`,
            [userId, type, clientId]
          );

          if (existing.rows.length > 0) {
            const serverTime = new Date(existing.rows[0].synced_at).getTime();
            const clientTime = new Date(clientTimestamp).getTime();
            if (serverTime > clientTime) {
              // Conflict detected
              const conflictId = uuidv4();
              await db.query(
                `INSERT INTO sync_queue (id, user_id, entity_type, operation, data, client_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'conflict')`,
                [conflictId, userId, type, operation, JSON.stringify(data), clientId]
              );
              results.push({ clientId, status: 'conflict', serverId: conflictId });
              continue;
            }
          }
        }

        // Apply the change based on type
        const syncId = uuidv4();
        let applySuccess = false;

        if (type === 'profile' && operation === 'update') {
          const profileRes = await db.query(
            `UPDATE farmer_profiles SET
               name = COALESCE($2, name),
               state = COALESCE($3, state),
               district = COALESCE($4, district),
               village = COALESCE($5, village),
               land_type = COALESCE($6, land_type),
               acreage = COALESCE($7, acreage),
               main_crops = COALESCE($8, main_crops),
               family_count = COALESCE($9, family_count),
               annual_income = COALESCE($10, annual_income),
               farmer_type = COALESCE($11, farmer_type),
               updated_at = NOW()
             WHERE user_id = $1
             RETURNING profile_id`,
            [
              userId,
              data.name, data.state, data.district, data.village,
              data.land_type, data.acreage, data.main_crops,
              data.family_count, data.annual_income, data.farmer_type
            ]
          );
          applySuccess = (profileRes.rowCount ?? 0) > 0;
        } else if (type === 'application' && operation === 'create') {
          // Queue the application (will be processed by the application route)
          applySuccess = true;
        } else {
          applySuccess = true; // Generic — just record the sync entry
        }

        // Record in sync_queue
        await db.query(
          `INSERT INTO sync_queue (id, user_id, entity_type, operation, data, client_id, status, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [syncId, userId, type, operation, JSON.stringify(data), clientId,
            applySuccess ? 'synced' : 'pending', applySuccess ? new Date().toISOString() : null]
        );

        results.push({
          clientId,
          status: applySuccess ? 'synced' : 'pending',
          serverId: syncId
        });

      } catch (itemErr: any) {
        results.push({ clientId, status: 'error', error: itemErr.message });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const pending = results.filter(r => r.status === 'pending').length;
    const conflicts = results.filter(r => r.status === 'conflict').length;
    const errors = results.filter(r => r.status === 'error').length;

    res.json({
      processed: results.length,
      synced,
      pending,
      conflicts,
      errors,
      results
    });
  } catch (err) {
    next(err);
  }
});

/* ───── GET conflicts for a user ───── */
router.get('/conflicts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const result = await db.query(
      `SELECT id, entity_type, operation, data, client_id, created_at
       FROM sync_queue
       WHERE user_id = $1 AND status = 'conflict'
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ conflicts: result.rows });
  } catch (err) {
    next(err);
  }
});

/* ───── POST resolve a conflict ───── */
router.post('/resolve', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { conflictId, resolution } = req.body;

    if (!conflictId || !['accept_server', 'accept_client'].includes(resolution)) {
      return res.status(400).json({ error: 'conflictId and resolution (accept_server | accept_client) required' });
    }

    if (resolution === 'accept_server') {
      // Discard client changes
      await db.query(
        `UPDATE sync_queue SET status = 'resolved_server' WHERE id = $1 AND user_id = $2`,
        [conflictId, userId]
      );
    } else {
      // Apply client data
      const conflict = await db.query(
        `SELECT entity_type, operation, data FROM sync_queue WHERE id = $1 AND user_id = $2`,
        [conflictId, userId]
      );
      if (conflict.rows.length > 0) {
        const { entity_type, data } = conflict.rows[0];
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;

        if (entity_type === 'profile') {
          await db.query(
            `UPDATE farmer_profiles SET
               name = COALESCE($2, name), state = COALESCE($3, state),
               district = COALESCE($4, district), updated_at = NOW()
             WHERE user_id = $1`,
            [userId, parsed.name, parsed.state, parsed.district]
          );
        }
        await db.query(
          `UPDATE sync_queue SET status = 'resolved_client', synced_at = NOW() WHERE id = $1 AND user_id = $2`,
          [conflictId, userId]
        );
      }
    }

    res.json({ resolved: true, conflictId, resolution });
  } catch (err) {
    next(err);
  }
});

export default router;
