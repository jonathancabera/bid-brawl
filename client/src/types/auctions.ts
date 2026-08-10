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

export interface CreateAuctionBody {
  item_name: string;
  item_description?: string;
  item_image?: string;
  starting_price: number;
  reserve_price?: number;
  start_time: string;
  end_time: string;
}

export interface Auction {
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
}

export interface AuctionResponse {
  auction: Auction;
}

export interface AuctionDetail extends Omit<Auction, 'reserve_price'> {
  highest_bid: string;
}

export interface AuctionDetailResponse {
  auction: AuctionDetail;
}
