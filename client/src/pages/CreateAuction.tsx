import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAuction, publishAuction } from '../api/auctions';
import { ApiError } from '../api/client';
import type { CreateAuctionBody } from '../types/auctions';

const START_TIME_BUFFER_MS = 5_000;

export default function CreateAuction() {
  const navigate = useNavigate();

  const [itemName, setItemName] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemImage, setItemImage] = useState<string>('');
  const [startingPrice, setStartingPrice] = useState<string>('');
  const [reservePrice, setReservePrice] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const locked = createdId !== null;

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const startingPriceNum = Number(startingPrice);
    const hasReserve = reservePrice.trim() !== '';
    const reservePriceNum = Number(reservePrice);

    if (!locked) {
      if (!itemName.trim() || !startingPrice.trim() || !endTime.trim()) {
        setError('item name, starting price, and end time are required');
        return;
      }
      if (Number.isNaN(startingPriceNum) || startingPriceNum <= 0) {
        setError('starting price must be a number greater than 0');
        return;
      }
      if (hasReserve && (Number.isNaN(reservePriceNum) || reservePriceNum <= 0)) {
        setError('reserve price must be a number greater than 0');
        return;
      }
    }

    setLoading(true);
    try {
      let auctionId = createdId;

      if (auctionId === null) {
        const body: CreateAuctionBody = {
          item_name: itemName,
          starting_price: startingPriceNum,
          start_time: new Date(Date.now() + START_TIME_BUFFER_MS).toISOString(),
          end_time: new Date(endTime).toISOString(),
          ...(itemDescription && { item_description: itemDescription }),
          ...(itemImage && { item_image: itemImage }),
          ...(hasReserve && { reserve_price: reservePriceNum }),
        };
        const created = await createAuction(body);
        auctionId = created.auction.auction_id;
        setCreatedId(auctionId);
      }

      await publishAuction(auctionId);
      navigate(`/auctions/${auctionId}`);
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

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span>Item name</span>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            disabled={loading || locked}
            className="border border-gray-400 rounded px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Description (optional)</span>
          <textarea
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            disabled={loading || locked}
            className="border border-gray-400 rounded px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Image URL (optional)</span>
          <input
            type="text"
            value={itemImage}
            onChange={(e) => setItemImage(e.target.value)}
            disabled={loading || locked}
            className="border border-gray-400 rounded px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Starting price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            disabled={loading || locked}
            className="border border-gray-400 rounded px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Reserve price (optional)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={reservePrice}
            onChange={(e) => setReservePrice(e.target.value)}
            disabled={loading || locked}
            className="border border-gray-400 rounded px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>End time</span>
          <input
            type="datetime-local"
            min={nowLocal}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={loading || locked}
            className="border border-gray-400 rounded px-2 py-1"
          />
        </label>

        {locked && <p>Auction created but not published yet. Retry publishing.</p>}
        {error && <p>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : locked ? 'Retry publish' : 'Create auction'}
        </button>
      </form>
    </div>
  );
}
