import { pool } from './db';
import { getIo, auctionRoom } from './io';
import { AuctionClosedEvent } from './types/events';

const SWEEP_INTERVAL_MS = 5_000;

interface ClosedRow {
  auction_id: number;
  winner_id: number | null;
  current_price: string | null;
}

export async function closeExpiredAuctions(): Promise<AuctionClosedEvent[]> {
  const { rows } = await pool.query<ClosedRow>(
    `UPDATE auctions AS a
        SET status = 'closed',
            winner_id = (
              SELECT b.bidder_id FROM bids b
               WHERE b.auction_id = a.auction_id
                 AND (a.reserve_price IS NULL OR b.amount >= a.reserve_price)
               ORDER BY b.amount DESC, b.bid_id ASC
               LIMIT 1
            )
      WHERE a.status = 'active'
        AND a.end_time <= now()
    RETURNING a.auction_id, a.winner_id, a.current_price`,
  );

  const events: AuctionClosedEvent[] = rows.map((row) => ({
    auction_id: row.auction_id,
    winner_id: row.winner_id,
    final_price: row.current_price,
    reserve_met: row.winner_id !== null,
  }));

  const io = getIo();
  for (const event of events) {
    io?.to(auctionRoom(event.auction_id)).emit('auction:closed', event);
  }

  return events;
}

let timer: NodeJS.Timeout | null = null;
let sweeping = false;

export function startCloser(intervalMs: number = SWEEP_INTERVAL_MS): void {
  if (timer) return;

  timer = setInterval(async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await closeExpiredAuctions();
    } catch (err) {
      console.error('close all expired auctions sweep failed:', err);
    } finally {
      sweeping = false;
    }
  }, intervalMs);

  timer.unref();
}

export function stopCloser(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
