import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getAuction } from '../api/auctions';
import type { AuctionDetail as AuctionDetailData } from '../types/auctions';
import { ApiError } from '../api/client';
import AuctionTimeCountdown from '../components/AuctionTimeCountdown';
import BidForm from '../components/BidForm';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import type { BidPlacedEvent, AuctionClosedEvent } from '../types/events';

const placeholder = '/placeholder.png';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function AuctionDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <AuctionDetail key={id} id={id} />;
}

function AuctionDetail({ id }: { id: string | undefined }) {
  const [auction, setAuction] = useState<AuctionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closure, setClosure] = useState<AuctionClosedEvent | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await getAuction(Number(id));
      setAuction(res.auction);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('something went wrong');
      }
    }
  }, [id]);

  const handleBidPlaced = useCallback((event: BidPlacedEvent) => {
    setAuction((prev) => {
      if (!prev || prev.auction_id !== event.auction_id) return prev;
      if (Number(event.highest_bid) <= Number(prev.highest_bid)) return prev;
      return { ...prev, highest_bid: event.highest_bid, current_price: event.highest_bid };
    });
  }, []);

  const handleClosed = useCallback((event: AuctionClosedEvent) => {
    setClosure(event);
    setAuction((prev) =>
      prev && prev.auction_id === event.auction_id
        ? { ...prev, status: 'closed', winner_id: event.winner_id }
        : prev,
    );
  }, []);

  const { connected } = useAuctionSocket(id ? Number(id) : null, {
    onBidPlaced: handleBidPlaced,
    onClosed: handleClosed,
    onResync: reload,
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getAuction(Number(id));
        if (!ignore) setAuction(res.auction);
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('something went wrong');
          }
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return <div>loading...</div>;
  }
  if (error) {
    return <div>{error}</div>;
  }
  if (!auction) {
    return <div>auction not found</div>;
  }

  return (
    <div>
      <h1>{auction.item_name}</h1>
      <img src={auction.item_image ?? placeholder} alt={auction.item_name} />
      {auction.item_description && <p>{auction.item_description}</p>}
      <p>Current bid: {priceFormatter.format(Number(auction.highest_bid))}</p>
      <p>Starting price: {priceFormatter.format(Number(auction.starting_price))}</p>
      <p>Status: {auction.status}</p>
      <p>
        Ends in: <AuctionTimeCountdown endTime={auction.end_time} />
      </p>
      {!connected && <p>Reconnecting — prices may be out of date.</p>}
      {closure && (
        <p>
          {closure.winner_id !== null
            ? `Sold for ${priceFormatter.format(Number(closure.final_price))}`
            : closure.final_price !== null && !closure.reserve_met
              ? 'Unsold — reserve not met.'
              : 'Unsold — no bids.'}
        </p>
      )}
      <BidForm auction={auction} onBidPlaced={reload} />
    </div>
  );
}
