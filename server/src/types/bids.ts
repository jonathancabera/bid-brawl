export interface CreateBidBody {
  amount: number;
}

export interface BidRow {
  bid_id: number;
  auction_id: number;
  bidder_id: number;
  amount: string;
  created_at: string;
}
