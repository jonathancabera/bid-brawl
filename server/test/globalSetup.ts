import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { createClient } from 'redis';

export default async function setup() {
  const schema = readFileSync(resolve(__dirname, '../src/db/schema.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await waitForDb(pool);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(schema);
  await pool.end();

  if (process.env.REDIS_URL) {
    await waitForRedis(process.env.REDIS_URL);
  }
}

async function waitForRedis(url: string, attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    const client = createClient({ url });
    client.on('error', () => {});
    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return;
    } catch (err) {
      await client.quit().catch(() => {});
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
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
