import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { closeExpiredAuctions } from '../src/closer';

async function register(email: string, display_name: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', display_name });
  return res.body.token as string;
}

async function publishedAuction(overrides: Record<string, unknown> = {}) {
  const sellerToken = await register('seller@example.com', 'Seller');
  const create = await request(app)
    .post('/api/auctions')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      item_name: 'Vintage clock',
      starting_price: 100,
      start_time: new Date(Date.now() + 5_000).toISOString(),
      end_time: new Date(Date.now() + 3_600_000).toISOString(),
      ...overrides,
    });
  const id = create.body.auction.auction_id as number;
  await request(app)
    .post(`/api/auctions/${id}/publish`)
    .set('Authorization', `Bearer ${sellerToken}`);
  return { sellerToken, id };
}

async function bid(id: number, token: string, amount: number) {
  return request(app)
    .post(`/api/auctions/${id}/bids`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount });
}

async function expire(id: number) {
  await pool.query(
    `UPDATE auctions SET end_time = now() - interval '1 minute' WHERE auction_id = $1`,
    [id],
  );
}

async function statusOf(id: number) {
  const { rows } = await pool.query(
    `SELECT status, winner_id FROM auctions WHERE auction_id = $1`,
    [id],
  );
  return rows[0];
}

describe('auction closer', () => {
  it('closes an expired auction and awards it to the highest bidder', async () => {
    const { id } = await publishedAuction();
    const alice = await register('alice@example.com', 'Alice');
    const bob = await register('bob@example.com', 'Bob');

    await bid(id, alice, 150);
    const winning = await bid(id, bob, 200);
    expect(winning.status).toBe(201);

    await expire(id);
    const events = await closeExpiredAuctions();

    expect(events).toHaveLength(1);
    expect(events[0].auction_id).toBe(id);
    expect(Number(events[0].final_price)).toBe(200);
    expect(events[0].reserve_met).toBe(true);

    const row = await statusOf(id);
    expect(row.status).toBe('closed');
    expect(row.winner_id).toBe(events[0].winner_id);
  });

  it('leaves an auction that has not expired alone', async () => {
    const { id } = await publishedAuction();
    const bidder = await register('bidder@example.com', 'Bidder');
    await bid(id, bidder, 150);

    const events = await closeExpiredAuctions();

    expect(events).toHaveLength(0);
    expect((await statusOf(id)).status).toBe('active');
  });

  it('closes unsold when every bid is below the reserve', async () => {
    const { id } = await publishedAuction({ reserve_price: 500 });
    const bidder = await register('bidder@example.com', 'Bidder');

    const placed = await bid(id, bidder, 150);
    expect(placed.status).toBe(201);

    await expire(id);
    const events = await closeExpiredAuctions();

    expect(events).toHaveLength(1);
    expect(events[0].winner_id).toBeNull();
    expect(events[0].reserve_met).toBe(false);
    expect(Number(events[0].final_price)).toBe(150);
    expect((await statusOf(id)).status).toBe('closed');
  });

  it('awards the auction once a bid meets the reserve', async () => {
    const { id } = await publishedAuction({ reserve_price: 500 });
    const bidder = await register('bidder@example.com', 'Bidder');

    await bid(id, bidder, 150);
    await bid(id, bidder, 600);

    await expire(id);
    const events = await closeExpiredAuctions();

    expect(events[0].reserve_met).toBe(true);
    expect(events[0].winner_id).not.toBeNull();
    expect(Number(events[0].final_price)).toBe(600);
  });

  it('closes with no winner when there were no bids', async () => {
    const { id } = await publishedAuction();
    await expire(id);

    const events = await closeExpiredAuctions();

    expect(events).toHaveLength(1);
    expect(events[0].winner_id).toBeNull();
    expect(events[0].final_price).toBeNull();
    expect((await statusOf(id)).status).toBe('closed');
  });

  it('does not close the same auction twice', async () => {
    const { id } = await publishedAuction();
    const bidder = await register('bidder@example.com', 'Bidder');
    await bid(id, bidder, 150);
    await expire(id);

    const first = await closeExpiredAuctions();
    const second = await closeExpiredAuctions();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('drops closed auctions out of the browse feed', async () => {
    const { id } = await publishedAuction();
    await expire(id);

    const before = await request(app).get('/api/auctions');
    expect(before.body.auctions.some((a: { auction_id: number }) => a.auction_id === id)).toBe(
      true,
    );

    await closeExpiredAuctions();

    const after = await request(app).get('/api/auctions');
    expect(after.body.auctions.some((a: { auction_id: number }) => a.auction_id === id)).toBe(
      false,
    );
  });
});
