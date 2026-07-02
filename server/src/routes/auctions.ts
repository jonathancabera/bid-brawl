import { Router } from 'express';
import { pool } from '../db';
import { CreateAuctionBody, UpdateAuctionBody, AuctionRow } from '../types/auctions';
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
      return res.status(400).json({ error: 'bad input' });
    }
    console.error('auction error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/', async (req, res) => {});

router.get('/:id', async (req, res) => {});

router.put('/:id', requireAuth, async (req, res) => {});

router.delete('/:id', requireAuth, async (req, res) => {});

export default router;
