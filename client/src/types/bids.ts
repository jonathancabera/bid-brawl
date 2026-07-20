export interface CreateBidBody {
  amount: number;
}

export interface Bid {
  bid_id: number;
  auction_id: number;
  bidder_id: number;
  amount: string;
  created_at: string;
}

export interface BidResponse {
  bid: Bid;
}

export interface BidsResponse {
  bids: Bid[];
}
