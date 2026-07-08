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
