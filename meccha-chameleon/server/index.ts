import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { ClientToServer, ServerToClient } from '../shared/protocol';
import { Room } from './room';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: '*' }, // LAN party — any local origin may connect
});

const room = new Room(io);
io.on('connection', (socket) => room.attach(socket));

// Serve the built client if present (production / `npm start`).
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.type('text').send('Client not built yet. Run `npm run dev` (hot reload) or `npm start` (build + serve).'),
  );
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const urls = lanUrls(PORT);
  console.log('\n  🦎  MECCHA CHAMELEON (LAN) is running!\n');
  console.log('  Share one of these URLs with everyone on your network:\n');
  for (const u of urls) console.log(`     ${u}`);
  console.log('\n  Press Ctrl+C to stop.\n');
});

/** Every non-internal IPv4 address, as http URLs. */
function lanUrls(port: number): string[] {
  const out = [`http://localhost:${port}`];
  const ifaces = networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`);
    }
  }
  return out;
}
