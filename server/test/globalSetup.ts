import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

export default async function setup() {
  const schema = readFileSync(resolve(__dirname, '../src/db/schema.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await waitForDb(pool);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(schema);
  await pool.end();
}

async function waitForDb(pool: Pool, attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
