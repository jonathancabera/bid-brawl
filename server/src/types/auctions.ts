export interface CreateAuctionBody {
  item_name: string;
  item_description?: string;
  item_image?: string;
  starting_price: number;
  reserve_price?: number;
  start_time: string;
  end_time: string;
}

export type UpdateAuctionBody = Partial<CreateAuctionBody>;

export interface AuctionRow {
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
  status: 'draft' | 'active' | 'closed';
  winner_id: number | null;
}