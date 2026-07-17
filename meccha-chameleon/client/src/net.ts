import { io, Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@shared/protocol';

// In dev the client is served by Vite (:5173) but the game server is on :3000.
// In production the server serves the client, so same-origin io() is correct.
const url = import.meta.env.DEV ? `http://${location.hostname}:3000` : undefined;

export const socket: Socket<ServerToClient, ClientToServer> = url ? io(url) : io();
