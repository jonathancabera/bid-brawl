import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { attachErrorLogging, isRedisEnabled, redisUrl } from './redis';

type Quittable = { quit(): Promise<unknown> };

let io: Server | null = null;
let pub: Quittable | null = null;
let sub: Quittable | null = null;

export function auctionRoom(auctionId: number): string {
  return `auction:${auctionId}`;
}

export async function initIo(httpServer: HttpServer): Promise<Server> {
  const server = new Server(httpServer, { cors: { origin: '*' } });

  if (isRedisEnabled()) {
    const pubClient = attachErrorLogging(createClient({ url: redisUrl() }), 'socket-pub');
    const subClient = attachErrorLogging(pubClient.duplicate(), 'socket-sub');
    await Promise.all([pubClient.connect(), subClient.connect()]);
    server.adapter(createAdapter(pubClient, subClient));
    pub = pubClient;
    sub = subClient;
  }

  server.on('connection', (socket) => {
    socket.on('auction:join', (rawId: unknown) => {
      const id = Number(rawId);
      if (!Number.isInteger(id) || id <= 0) return;
      socket.join(auctionRoom(id));
    });

    socket.on('auction:leave', (rawId: unknown) => {
      const id = Number(rawId);
      if (!Number.isInteger(id) || id <= 0) return;
      socket.leave(auctionRoom(id));
    });
  });

  io = server;
  return server;
}

export function getIo(): Server | null {
  return io;
}

export async function closeIo(): Promise<void> {
  const current = io;
  const clients = [pub, sub].filter((c): c is Quittable => c !== null);
  io = null;
  pub = null;
  sub = null;

  if (current) await current.close();
  await Promise.all(clients.map((c) => c.quit()));
}
