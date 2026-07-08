import { Link } from 'react-router-dom';
import type { AuctionListItem } from '../types/auctions';
import AuctionTimeCountdown from './AuctionTimeCountdown';

const placeholder = '/placeholder.png';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function AuctionCard({ auction }: { auction: AuctionListItem }) {
  return (
    <Link to={`/auctions/${auction.auction_id}`}>
      <div>
        {auction.item_name}
        <img src={auction.item_image ?? placeholder} alt={auction.item_name} />
        {priceFormatter.format(Number(auction.highest_bid))}
        <AuctionTimeCountdown endTime={auction.end_time} />
      </div>
    </Link>
  );
}
