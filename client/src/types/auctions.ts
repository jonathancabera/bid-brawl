export interface AuctionListItem {
  auction_id: number;
  item_name: string;
  item_image: string | null;
  end_time: string;
  highest_bid: string;
}

export interface AuctionCursor {
  end_time: string;
  auction_id: number;
}

export interface AuctionListResponse {
  auctions: AuctionListItem[];
  next_cursor: AuctionCursor | null;
}

export interface AuctionDetail {
  auction_id: number;
  seller_id: number;
  item_name: string;
  item_description: string | null;
  item_image: string | null;
  starting_price: string;
  reserve_price: string | null;
  current_price: string | null;
  start_time: string | null;
  end_time: string;
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  winner_id: number | null;
  highest_bid: string;
}

export interface AuctionDetailResponse {
  auction: AuctionDetail;
}
