import { beforeEach, afterAll } from 'vitest';
import { pool } from '../src/db';

beforeEach(async () => {
  await pool.query('TRUNCATE users, auctions, bids, payments RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
