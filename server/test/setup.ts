import { beforeAll, beforeEach, afterAll } from 'vitest';
import { createClient } from 'redis';
import { pool } from '../src/db';
import { closeLockClient } from '../src/lock';

const redis = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : null;

beforeAll(async () => {
  if (redis) await redis.connect();
});

beforeEach(async () => {
  await pool.query('TRUNCATE users, auctions, bids, payments RESTART IDENTITY CASCADE');
  if (redis) await redis.flushDb();
});

afterAll(async () => {
  await pool.end();
  await closeLockClient();
  if (redis) await redis.quit();
});
