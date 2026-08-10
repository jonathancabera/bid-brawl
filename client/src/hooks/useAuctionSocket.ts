import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { BidPlacedEvent, AuctionClosedEvent } from '../types/events';

const SOCKET_URL = import.meta.env.VITE_API_URL;

interface AuctionSocketHandlers {
  onBidPlaced?: (event: BidPlacedEvent) => void;
  onClosed?: (event: AuctionClosedEvent) => void;
  onResync?: () => void;
}

export function useAuctionSocket(auctionId: number | null, handlers: AuctionSocketHandlers) {
  const [connected, setConnected] = useState(false);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (auctionId === null || !Number.isInteger(auctionId) || auctionId <= 0) return;

    const socket = io(SOCKET_URL);
    let hasConnectedBefore = false;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('auction:join', auctionId);
      if (hasConnectedBefore) handlersRef.current.onResync?.();
      hasConnectedBefore = true;
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('bid:placed', (event: BidPlacedEvent) => {
      handlersRef.current.onBidPlaced?.(event);
    });

    socket.on('auction:closed', (event: AuctionClosedEvent) => {
      handlersRef.current.onClosed?.(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [auctionId]);

  return { connected };
}
