
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (err: any) {
        logger.error('Database query error', { text, error: err.message });
        throw err;
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
