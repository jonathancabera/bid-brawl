export interface BidPlacedEvent {
  auction_id: number;
  bid_id: number;
  bidder_id: number;
  amount: string;
  highest_bid: string;
}

export interface AuctionClosedEvent {
  auction_id: number;
  winner_id: number | null;
  final_price: string | null;
  reserve_met: boolean;
}
