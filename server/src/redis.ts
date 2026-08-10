type ErrorEmitter = { on(event: 'error', listener: (err: Error) => void): unknown };

export function isRedisEnabled(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function redisUrl(): string | undefined {
  return process.env.REDIS_URL;
}

export function attachErrorLogging<T extends ErrorEmitter>(client: T, label: string): T {
  client.on('error', (err) => console.error(`redis error (${label}):`, err));
  return client;
}
