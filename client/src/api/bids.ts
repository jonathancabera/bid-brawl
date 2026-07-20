import { request } from './client';
import type { BidResponse, BidsResponse, CreateBidBody } from '../types/bids';

export function placeBid(auctionId: number, amount: number): Promise<BidResponse> {
  const body: CreateBidBody = { amount };
  return request<BidResponse>(`/api/auctions/${auctionId}/bids`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getBids(auctionId: number): Promise<BidsResponse> {
  return request<BidsResponse>(`/api/auctions/${auctionId}/bids`);
}
