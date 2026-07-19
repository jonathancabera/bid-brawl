import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getAuction } from '../api/auctions';
import type { AuctionDetail as AuctionDetailData } from '../types/auctions';
import { ApiError } from '../api/client';
import AuctionTimeCountdown from '../components/AuctionTimeCountdown';

const placeholder = '/placeholder.png';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();

  const [auction, setAuction] = useState<AuctionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
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
    </div>
  );
}
