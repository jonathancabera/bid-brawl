import { useState } from 'react';
import { Link } from 'react-router-dom';
import { placeBid } from '../api/bids';
import { getToken } from '../api/auth';
import { ApiError } from '../api/client';
import type { AuctionDetail } from '../types/auctions';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface BidFormProps {
  auction: AuctionDetail;
  onBidPlaced: () => void;
}

export default function BidForm({ auction, onBidPlaced }: BidFormProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthed = getToken() !== null;
  const hasBids = auction.current_price !== null;
  const minBid = hasBids ? Number(auction.current_price) : Number(auction.starting_price);
  const ended = new Date(auction.end_time) <= new Date();
  const closed = auction.status !== 'active' || ended;

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setError('bid amount must be a number greater than 0');
      return;
    }
    if (hasBids ? amountNum <= minBid : amountNum < minBid) {
      setError(
        hasBids
          ? `bid must be higher than ${priceFormatter.format(minBid)}`
          : `bid must be at least ${priceFormatter.format(minBid)}`,
      );
      return;
    }

    setLoading(true);
    try {
      await placeBid(auction.auction_id, amountNum);
      setAmount('');
      onBidPlaced();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  if (closed) {
    return <p>Bidding is closed for this auction.</p>;
  }

  if (!isAuthed) {
    return (
      <p>
        <Link to="/login">Log in</Link> to place a bid.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span>Your bid</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
          className="border border-gray-400 rounded px-2 py-1"
        />
      </label>
      <p>
        {hasBids
          ? `Must beat ${priceFormatter.format(minBid)}`
          : `Minimum bid ${priceFormatter.format(minBid)}`}
      </p>
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Placing bid...' : 'Place bid'}
      </button>
    </form>
  );
}
