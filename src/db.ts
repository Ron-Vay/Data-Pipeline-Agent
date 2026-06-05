import { Pool } from 'pg';

const pool = new Pool({
    host: '127.0.0.1',
    port: 5434,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: false,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    idleTimeoutMillis: 30000,
});

export async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS pipeline_results (
            id SERIAL PRIMARY KEY,
            job_id TEXT NOT NULL,
            data JSONB NOT NULL
        )
    `);
}

export async function query(text: string, values?: unknown[]) {
    return pool.query(text, values);
}

export default pool;
