import { request } from './client';
import type {
  AuctionCursor,
  AuctionListResponse,
  AuctionDetailResponse,
  CreateAuctionBody,
  AuctionResponse,
} from '../types/auctions';

export function getAuctions(cursor?: AuctionCursor): Promise<AuctionListResponse> {
  const path = '/api/auctions';
  if (!cursor) {
    return request<AuctionListResponse>(path);
  }
  const params = new URLSearchParams();
  const after_end_time = cursor.end_time;
  const after_id = String(cursor.auction_id);
  params.set('after_end_time', after_end_time);
  params.set('after_id', after_id);

  const finalPath = `${path}?${params.toString()}`;
  return request<AuctionListResponse>(finalPath);
}

export function getAuction(id: number): Promise<AuctionDetailResponse> {
  return request<AuctionDetailResponse>(`/api/auctions/${id}`);
}

export function createAuction(body: CreateAuctionBody): Promise<AuctionResponse> {
  return request<AuctionResponse>('/api/auctions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function publishAuction(id: number): Promise<AuctionResponse> {
  return request<AuctionResponse>(`/api/auctions/${id}/publish`, {
    method: 'POST',
  });
}
