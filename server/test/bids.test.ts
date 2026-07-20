import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

async function register(email: string, display_name: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', display_name });
  return res.body.token as string;
}

function auctionBody(overrides: Record<string, unknown> = {}) {
  return {
    item_name: 'Vintage clock',
    starting_price: 100,
    start_time: new Date(Date.now() + 5_000).toISOString(),
    end_time: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

async function publishedAuction(overrides: Record<string, unknown> = {}) {
  const sellerToken = await register('seller@example.com', 'Seller');
  const create = await request(app)
    .post('/api/auctions')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send(auctionBody(overrides));
  const id = create.body.auction.auction_id as number;
  await request(app)
    .post(`/api/auctions/${id}/publish`)
    .set('Authorization', `Bearer ${sellerToken}`);
  return { sellerToken, id };
}

describe('bids', () => {
  it('records a valid bid and advances the current price', async () => {
    const { id } = await publishedAuction();
    const bidder = await register('bidder@example.com', 'Bidder');

    const res = await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${bidder}`)
      .send({ amount: 150 });

    expect(res.status).toBe(201);
    expect(Number(res.body.bid.amount)).toBe(150);

    const detail = await request(app).get(`/api/auctions/${id}`);
    expect(Number(detail.body.auction.highest_bid)).toBe(150);
  });

  it('requires auth to bid', async () => {
    const { id } = await publishedAuction();
    const res = await request(app).post(`/api/auctions/${id}/bids`).send({ amount: 150 });
    expect(res.status).toBe(401);
  });

  it('rejects a bid below the starting price', async () => {
    const { id } = await publishedAuction();
    const bidder = await register('bidder@example.com', 'Bidder');
    const res = await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${bidder}`)
      .send({ amount: 50 });
    expect(res.status).toBe(409);
  });

  it('rejects a bid that does not beat the current price', async () => {
    const { id } = await publishedAuction();
    const bidder = await register('bidder@example.com', 'Bidder');
    await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${bidder}`)
      .send({ amount: 150 });

    const tie = await register('bidder2@example.com', 'Bidder Two');
    const res = await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${tie}`)
      .send({ amount: 150 });
    expect(res.status).toBe(409);
  });

  it('rejects a seller bidding on their own auction', async () => {
    const { sellerToken, id } = await publishedAuction();
    const res = await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ amount: 150 });
    expect(res.status).toBe(403);
  });

  it('returns bid history newest-highest first', async () => {
    const { id } = await publishedAuction();
    const a = await register('a@example.com', 'A');
    const b = await register('b@example.com', 'B');
    await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${a}`)
      .send({ amount: 150 });
    await request(app)
      .post(`/api/auctions/${id}/bids`)
      .set('Authorization', `Bearer ${b}`)
      .send({ amount: 200 });

    const res = await request(app).get(`/api/auctions/${id}/bids`);
    expect(res.status).toBe(200);
    expect(res.body.bids.map((x: { amount: string }) => Number(x.amount))).toEqual([200, 150]);
  });

  it('allows exactly one winner when N equal bids race', async () => {
    const { id } = await publishedAuction();

    const N = 20;
    const tokens = await Promise.all(
      Array.from({ length: N }, (_, i) => register(`racer${i}@example.com`, `Racer ${i}`)),
    );

    const responses = await Promise.all(
      tokens.map((t) =>
        request(app)
          .post(`/api/auctions/${id}/bids`)
          .set('Authorization', `Bearer ${t}`)
          .send({ amount: 150 }),
      ),
    );

    const winners = responses.filter((r) => r.status === 201);
    const losers = responses.filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(N - 1);

    const history = await request(app).get(`/api/auctions/${id}/bids`);
    expect(history.body.bids).toHaveLength(1);

    const detail = await request(app).get(`/api/auctions/${id}`);
    expect(Number(detail.body.auction.highest_bid)).toBe(150);
  });
});
