import { randomUUID } from 'node:crypto';
import { createClient, defineScript, type CommandParser } from 'redis';
import { attachErrorLogging, isRedisEnabled, redisUrl } from './redis';

const LOCK_TTL_MS = 10_000;

export class LockBusyError extends Error {
  constructor(message = 'another bid is in progress, please retry') {
    super(message);
    this.name = 'LockBusyError';
  }
}

function createLockClient() {
  const client = createClient({
    url: redisUrl(),
    scripts: {
      releaseLock: defineScript({
        NUMBER_OF_KEYS: 1,
        SCRIPT: `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`,
        parseCommand(parser: CommandParser, key: string, token: string): void {
          parser.pushKey(key);
          parser.push(token);
        },
        transformReply(reply: number): number {
          return reply;
        },
      }),
    },
  });

  return attachErrorLogging(client, 'lock');
}

type LockClient = ReturnType<typeof createLockClient>;

let clientPromise: Promise<LockClient> | null = null;

function getClient(): Promise<LockClient> {
  if (!clientPromise) {
    const client = createLockClient();
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

export async function withAuctionLock<T>(auctionId: number, fn: () => Promise<T>): Promise<T> {
  if (!isRedisEnabled()) {
    return fn();
  }

  const client = await getClient();
  const key = `auction:lock:${auctionId}`;
  const token = randomUUID();

  const acquired = await client.set(key, token, { NX: true, PX: LOCK_TTL_MS });
  if (acquired !== 'OK') {
    throw new LockBusyError();
  }

  try {
    return await fn();
  } finally {
    await client.releaseLock(key, token).catch((err) => {
      console.error('lock release failed:', err);
    });
  }
}

export async function closeLockClient(): Promise<void> {
  if (!clientPromise) {
    return;
  }
  const client = await clientPromise;
  clientPromise = null;
  await client.quit();
}
