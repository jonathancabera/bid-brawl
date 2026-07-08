import { useState, useEffect } from 'react';
import { getAuctions } from '../api/auctions';
import type { AuctionListItem, AuctionCursor } from '../types/auctions';
import { ApiError } from '../api/client';
import AuctionCard from '../components/AuctionCard';

export default function AuctionList() {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<AuctionCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAuctions();
        setAuctions(res.auctions);
        setNextCursor(res.next_cursor);
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
    load();
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await getAuctions(nextCursor);
      setAuctions((previous) => [...previous, ...res.auctions]);
      setNextCursor(res.next_cursor);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadMoreError(err.message);
      } else {
        setLoadMoreError('something went wrong');
      }
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return <div>loading...</div>;
  }
  if (error) {
    return <div>{error}</div>;
  }
  if (auctions.length === 0) {
    return <div>No active auctions yet.</div>;
  }
  return (
    <div>
      {auctions.map((listing) => (
        <AuctionCard key={listing.auction_id} auction={listing} />
      ))}
      {nextCursor && (
        <button onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
      {loadMoreError && (
        <div role="alert">
          {loadMoreError} <button onClick={loadMore}>Retry</button>
        </div>
      )}
    </div>
  );
}
