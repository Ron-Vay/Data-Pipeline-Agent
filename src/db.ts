import postgres from 'postgres';

const sql = postgres({
    host: 'localhost',
    port: 5434,
    database: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
});

export async function initDb() {
    await sql`
          CREATE TABLE IF NOT EXISTS pipeline_results (
              id SERIAL PRIMARY KEY,
              job_id TEXT NOT NULL,
              data JSONB NOT NULL
          )
      `;
}

export default sql;