import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

async function registerSeller() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'seller@example.com', password: 'password123', display_name: 'Seller' });
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

describe('auctions', () => {
  it('creates a draft, publishes it, and lists it', async () => {
    const token = await registerSeller();

    const create = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${token}`)
      .send(auctionBody());
    expect(create.status).toBe(201);
    expect(create.body.auction.status).toBe('draft');

    const id = create.body.auction.auction_id;

    const publish = await request(app)
      .post(`/api/auctions/${id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(publish.status).toBe(200);
    expect(publish.body.auction.status).toBe('active');

    const list = await request(app).get('/api/auctions');
    expect(list.status).toBe(200);
    expect(list.body.auctions.some((a: { auction_id: number }) => a.auction_id === id)).toBe(true);
  });

  it('hides drafts from the public list until published', async () => {
    const token = await registerSeller();
    await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${token}`)
      .send(auctionBody());

    const list = await request(app).get('/api/auctions');
    expect(list.body.auctions).toHaveLength(0);
  });

  it('rejects a start_time in the past with 400', async () => {
    const token = await registerSeller();
    const res = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${token}`)
      .send(auctionBody({ start_time: new Date(Date.now() - 60_000).toISOString() }));
    expect(res.status).toBe(400);
  });

  it('requires auth to create', async () => {
    const res = await request(app).post('/api/auctions').send(auctionBody());
    expect(res.status).toBe(401);
  });
});
