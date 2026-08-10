import 'dotenv/config';
import http from 'node:http';
import { app } from './app';
import { initIo } from './io';
import { startCloser } from './closer';

const PORT = process.env.PORT ?? 3000;

async function main() {
  const server = http.createServer(app);
  await initIo(server);
  startCloser();
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main().catch((err) => {
  console.error('failed to start server:', err);
  process.exit(1);
});
