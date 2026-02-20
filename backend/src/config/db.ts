
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000 // Short timeout for fallback detection
});

// In-memory fallback for prototype demonstration
const fallbackStorage: Record<string, any[]> = {
    users: [],
    otp_tokens: [],
    farmer_profiles: [],
    applications: [],
    documents: []
};

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params: any[] = []) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (err: any) {
        logger.warn('Database error, using in-memory fallbacks', { error: err.message });

        // Very basic mock parser for common queries in this prototype
        const lowerText = text.toLowerCase();
        let tableName = '';
        if (lowerText.includes('into otp_tokens')) tableName = 'otp_tokens';
        else if (lowerText.includes('into users')) tableName = 'users';
        else if (lowerText.includes('into farmer_profiles')) tableName = 'farmer_profiles';
        else if (lowerText.includes('into applications')) tableName = 'applications';

        if (lowerText.includes('insert into') && tableName) {
            const mockRow: any = { created_at: new Date(), updated_at: new Date() };
            // Simple mapping of parameters to common fields for demonstration
            if (tableName === 'otp_tokens') {
                mockRow.mobile = params[0];
                mockRow.otp = params[1];
                mockRow.expires_at = params[2];
                mockRow.token_id = require('uuid').v4();
                mockRow.used = false;
            } else if (tableName === 'users') {
                mockRow.mobile = params[0];
                mockRow.user_id = require('uuid').v4();
            } else if (tableName === 'farmer_profiles') {
                mockRow.profile_id = require('uuid').v4();
                mockRow.user_id = params[0];
                mockRow.name = params[1];
            }
            fallbackStorage[tableName].push(mockRow);
            return { rows: [mockRow], rowCount: 1 };
        }

        if (lowerText.includes('select') && lowerText.includes('from otp_tokens')) {
            const mobile = params[0];
            const rows = fallbackStorage.otp_tokens
                .filter(t => t.mobile === mobile && !t.used)
                .sort((a, b) => b.created_at - a.created_at);
            return { rows, rowCount: rows.length };
        }

        if (lowerText.includes('select') && lowerText.includes('from users')) {
            const mobile = params[0];
            const rows = fallbackStorage.users.filter(u => u.mobile === mobile);
            return { rows, rowCount: rows.length };
        }

        if (lowerText.includes('select') && lowerText.includes('from farmer_profiles')) {
            const userId = params[0];
            const rows = fallbackStorage.farmer_profiles.filter(p => p.user_id === userId);
            return { rows, rowCount: rows.length };
        }

        // Default empty result for other SELECTs to prevent crash
        return { rows: [], rowCount: 0 };
    }
};

export const getClient = async () => {
    const client = await pool.connect();
    return client;
};

export default {
    query,
    getClient,
    pool
};
