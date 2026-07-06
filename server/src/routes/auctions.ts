import { Router } from 'express';
import { pool } from '../db';
import { CreateAuctionBody, UpdateAuctionBody, AuctionRow } from '../types/auctions';
import { AuctionListItem } from '../types/auctions';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const {
    item_name,
    item_description,
    item_image,
    starting_price,
    reserve_price,
    start_time,
    end_time,
  } = req.body as CreateAuctionBody;

  const { user_id } = (req as AuthRequest).user;

  if (!item_name || !starting_price || !start_time || !end_time) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  if (new Date(start_time) < new Date()) {
    return res.status(400).json({ error: 'start time cannot be in the past' });
  }

  if (new Date(end_time) <= new Date(start_time)) {
    return res.status(400).json({ error: 'invalid auction start/end time' });
  }

  try {
    const result = await pool.query<AuctionRow>(
      `INSERT INTO auctions
     (seller_id, item_name, item_description, item_image, starting_price, reserve_price, start_time, end_time)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   RETURNING *`,
      [
        user_id,
        item_name,
        item_description,
        item_image,
        starting_price,
        reserve_price,
        start_time,
        end_time,
      ],
    );

    return res.status(201).json({ auction: result.rows[0] });
  } catch (err: any) {
    if (err?.code === '23514') {
      return res.status(400).json({ error: 'invalid field value' });
    }
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/:id/publish', requireAuth, async (req, res) => {
  const auction_id = req.params.id;
  const id = Number(auction_id);

  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid auction id' });
  }

  const { user_id } = (req as AuthRequest).user;

  try {
    const result = await pool.query(
      `SELECT seller_id, status, start_time, end_time FROM auctions WHERE auction_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'auction not found' });
    }

    const { seller_id, status, end_time } = result.rows[0];
    if (seller_id !== user_id) {
      return res.status(403).json({ error: 'you do not own this auction' });
    }
    if (status === 'active') {
      return res.status(409).json({ error: 'auction already published' });
    }
    if (status === 'closed') {
      return res
        .status(409)
        .json({ error: 'auction has been closed, you cannot re-publish this auction' });
    }
    if (status === 'cancelled') {
      return res.status(409).json({ error: 'auction has been cancelled, you cannot publish' });
    }
    if (new Date(end_time) <= new Date()) {
      return res.status(400).json({ error: 'auction end time has passed' });
    }

    const updated = await pool.query(
      `UPDATE auctions SET status = 'active' WHERE auction_id = $1 RETURNING *`,
      [id],
    );
    return res.status(200).json({ auction: updated.rows[0] });
  } catch (err: any) {
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/', async (req, res) => {
  const { after_end_time, after_id, limit } = req.query;

  const pageSize = Number(limit ?? 20);
  if (Number.isNaN(pageSize) || pageSize <= 0) {
    return res.status(400).json({ error: 'invalid limit' });
  }

  const missingEndTime = after_end_time === undefined;
  const missingId = after_id === undefined;
  if (missingEndTime !== missingId) {
    return res.status(400).json({ error: 'after_id and after_end_time must be provided together' });
  }

  let parsedAfterId: number | undefined;
  const hasCursor = !missingEndTime;
  if (hasCursor) {
    parsedAfterId = Number(after_id);
    if (Number.isNaN(parsedAfterId) || parsedAfterId <= 0) {
      return res.status(400).json({ error: 'invalid after id' });
    }

    const parsedTime = new Date(after_end_time as string).getTime();
    if (Number.isNaN(parsedTime)) {
      return res.status(400).json({ error: 'invalid after end time' });
    }
  }

  try {
    let result;

    if (hasCursor) {
      result = await pool.query<AuctionListItem>(
        `SELECT a.auction_id, a.item_name, a.item_image, a.end_time,
            COALESCE(MAX(b.amount), a.starting_price) AS highest_bid
     FROM auctions a
     LEFT JOIN bids b ON b.auction_id = a.auction_id
     WHERE a.status = 'active'
       AND (a.end_time, a.auction_id) > ($1, $2)
     GROUP BY a.auction_id
     ORDER BY a.end_time ASC, a.auction_id ASC
     LIMIT $3`,
        [after_end_time, parsedAfterId, pageSize + 1],
      );
    } else {
      result = await pool.query<AuctionListItem>(
        `SELECT a.auction_id, a.item_name, a.item_image, a.end_time,
            COALESCE(MAX(b.amount), a.starting_price) AS highest_bid
     FROM auctions a
     LEFT JOIN bids b ON b.auction_id = a.auction_id
     WHERE a.status = 'active'
     GROUP BY a.auction_id
     ORDER BY a.end_time ASC, a.auction_id ASC
     LIMIT $1`,
        [pageSize + 1],
      );
    }

    const hasMore = result.rows.length > pageSize;
    const auctions = hasMore ? result.rows.slice(0, pageSize) : result.rows;
    const lastRow = auctions[auctions.length - 1];
    const next_cursor = hasMore
      ? {
          end_time: lastRow.end_time,
          auction_id: lastRow.auction_id,
        }
      : null;

    return res.status(200).json({ auctions, next_cursor });
  } catch (err: any) {
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const requested_auction_id = req.params.id;
  const id = Number(requested_auction_id);

  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid auction id' });
  }

  try {
    const result = await pool.query<AuctionRow & { highest_bid: string }>(
      `SELECT a.*,
            COALESCE(MAX(b.amount), a.starting_price) AS highest_bid
     FROM auctions a
     LEFT JOIN bids b ON b.auction_id = a.auction_id
     WHERE a.auction_id = $1
       AND (a.status <> 'draft')
     GROUP BY a.auction_id`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'auction not found' });
    }

    return res.status(200).json({ auction: result.rows[0] });
  } catch (err: any) {
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const update_auction_id = req.params.id;
  const id = Number(update_auction_id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid auction id' });
  }

  const body = req.body as UpdateAuctionBody;
  const { start_time, end_time } = body;

  const { user_id } = (req as AuthRequest).user;
  if (start_time && new Date(start_time) < new Date()) {
    return res.status(400).json({ error: 'invalid auction start time' });
  }
  if (start_time && end_time && new Date(end_time) <= new Date(start_time)) {
    return res.status(400).json({ error: 'invalid auction end time' });
  }

  try {
    const result = await pool.query<AuctionRow>(
      `SELECT seller_id, status FROM auctions WHERE auction_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'auction not found' });
    }

    const { seller_id, status } = result.rows[0];
    if (seller_id !== user_id) {
      return res.status(403).json({ error: 'you do not own this auction' });
    }
    if (status !== 'draft') {
      return res.status(409).json({ error: 'this auction is live and cannot be edited' });
    }

    const editable_fields = [
      'item_name',
      'item_description',
      'item_image',
      'starting_price',
      'reserve_price',
      'start_time',
      'end_time',
    ] as const;

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const col of editable_fields) {
      if (body[col] !== undefined) {
        values.push(body[col]);
        fields.push(`${col} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }

    values.push(id);
    const updated = await pool.query<AuctionRow>(
      `UPDATE auctions SET ${fields.join(', ')} WHERE auction_id = $${values.length} RETURNING *`,
      values,
    );

    return res.status(200).json({ auction: updated.rows[0] });
  } catch (err: any) {
    if (err?.code === '23514') {
      return res.status(400).json({ error: 'invalid field value' });
    }
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const update_auction_id = req.params.id;
  const id = Number(update_auction_id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid auction id' });
  }

  const { user_id } = (req as AuthRequest).user;

  try {
    const result = await pool.query<AuctionRow>(
      `SELECT seller_id, status FROM auctions WHERE auction_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'auction not found' });
    }

    const { seller_id, status } = result.rows[0];
    if (seller_id !== user_id) {
      return res.status(403).json({ error: 'you do not own this auction' });
    }
    if (status !== 'draft') {
      return res.status(409).json({ error: 'this auction is live and cannot be deleted' });
    }

    const updated = await pool.query<AuctionRow>(
      `UPDATE auctions SET status = 'cancelled' WHERE auction_id = $1 RETURNING *`,
      [id],
    );

    return res.status(200).json({ auction: updated.rows[0] });
  } catch (err: any) {
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
