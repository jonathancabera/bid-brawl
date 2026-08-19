import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import { CreateBidBody, BidRow } from '../types/bids';
import { withAuctionLock, LockBusyError } from '../lock';
import { getIo, auctionRoom } from '../io';
import { BidPlacedEvent } from '../types/events';

const router = Router({ mergeParams: true });

interface RouteResult {
  status: number;
  body: unknown;
}

router.post('/', requireAuth, async (req, res) => {
  const id = Number((req.params as { auctionId: string }).auctionId);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid auction id' });
  }

  const { amount } = req.body as CreateBidBody;
  const bid = Number(amount);
  if (!Number.isFinite(bid) || bid <= 0) {
    return res.status(400).json({ error: 'bid amount must be a positive number' });
  }

  const { user_id } = (req as AuthRequest).user;

  try {
    const billing = await pool.query<{ default_payment_method_id: string | null }>(
      `SELECT default_payment_method_id FROM users WHERE user_id = $1`,
      [user_id],
    );
    if (!billing.rows[0]?.default_payment_method_id) {
      return res.status(402).json({ error: 'add a payment method before bidding' });
    }

    const result = await withAuctionLock(id, () => placeBid(id, user_id, bid));

    if (result.status === 201) {
      const { bid: created } = result.body as { bid: BidRow };
      const event: BidPlacedEvent = {
        auction_id: id,
        bid_id: created.bid_id,
        bidder_id: created.bidder_id,
        amount: created.amount,
        highest_bid: created.amount,
      };
      getIo()?.to(auctionRoom(id)).emit('bid:placed', event);
    }

    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err instanceof LockBusyError) {
      return res.status(409).json({ error: err.message });
    }
    console.error('bid error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

async function placeBid(auctionId: number, bidderId: number, amount: number): Promise<RouteResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT seller_id, status, end_time, starting_price, current_price
         FROM auctions WHERE auction_id = $1 FOR UPDATE`,
      [auctionId],
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { error: 'auction not found' } };
    }

    const { seller_id, status, end_time, starting_price, current_price } = found.rows[0];

    if (status !== 'active') {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: 'auction is not active' } };
    }
    if (new Date(end_time) <= new Date()) {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: 'auction has ended' } };
    }
    if (seller_id === bidderId) {
      await client.query('ROLLBACK');
      return { status: 403, body: { error: 'you cannot bid on your own auction' } };
    }

    const highest = current_price === null ? null : Number(current_price);
    if (highest === null) {
      if (amount < Number(starting_price)) {
        await client.query('ROLLBACK');
        return { status: 409, body: { error: 'bid must be at least the starting price' } };
      }
    } else if (amount <= highest) {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: 'bid must be higher than the current price' } };
    }

    const inserted = await client.query<BidRow>(
      `INSERT INTO bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3) RETURNING *`,
      [auctionId, bidderId, amount],
    );
    await client.query(`UPDATE auctions SET current_price = $1 WHERE auction_id = $2`, [
      amount,
      auctionId,
    ]);

    await client.query('COMMIT');
    return { status: 201, body: { bid: inserted.rows[0] } };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

router.get('/', async (req, res) => {
  const id = Number((req.params as { auctionId: string }).auctionId);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid auction id' });
  }

  try {
    const result = await pool.query<BidRow>(
      `SELECT b.* FROM bids b WHERE b.auction_id = $1 ORDER BY b.amount DESC, b.bid_id DESC`,
      [id],
    );
    return res.status(200).json({ bids: result.rows });
  } catch (err) {
    console.error('bid error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
