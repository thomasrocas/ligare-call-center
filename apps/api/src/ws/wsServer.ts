/**
 * WebSocket server for real-time supervisor board and agent notifications.
 * Uses the `ws` library over the existing HTTP server.
 * 
 * Event types emitted:
 *   - call:created       — new call logged
 *   - call:started       — call picked up
 *   - call:completed     — call finished
 *   - call:transferred   — call transferred
 *   - call:missed        — call missed
 *   - agent:status       — agent status update
 *   - queue:update       — queue metrics snapshot
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ligare-dev-secret';

export interface WsClient {
  ws: WebSocket;
  userId: string;
  role: string;
  team: string;
  subscribedRooms: Set<string>;
}

const clients = new Map<WebSocket, WsClient>();

let wss: WebSocketServer | null = null;

export function createWsServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract JWT from query param or Authorization header
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user: any;
    try {
      user = jwt.verify(token, JWT_SECRET) as any;
    } catch {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const client: WsClient = {
      ws,
      userId: user.id,
      role: user.role,
      team: user.team,
      subscribedRooms: new Set(['global']),
    };
    clients.set(ws, client);

    // Send welcome + current role
    sendToClient(ws, 'connected', {
      userId: user.id,
      role: user.role,
      team: user.team,
      timestamp: new Date().toISOString(),
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(ws, client, msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

function handleClientMessage(ws: WebSocket, client: WsClient, msg: any): void {
  switch (msg.type) {
    case 'subscribe':
      if (msg.room) {
        client.subscribedRooms.add(msg.room);
        sendToClient(ws, 'subscribed', { room: msg.room });
      }
      break;
    case 'unsubscribe':
      if (msg.room) {
        client.subscribedRooms.delete(msg.room);
      }
      break;
    case 'ping':
      sendToClient(ws, 'pong', { timestamp: new Date().toISOString() });
      break;
    default:
      break;
  }
}

function sendToClient(ws: WebSocket, type: string, data: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
  }
}

/**
 * Broadcast an event to all connected clients with appropriate roles.
 */
export function broadcast(eventType: string, data: any, options?: {
  roles?: string[];
  teams?: string[];
  room?: string;
}): void {
  const message = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });

  clients.forEach((client) => {
    if (client.ws.readyState !== WebSocket.OPEN) return;

    // Role filter
    if (options?.roles && !options.roles.includes(client.role)) return;
    // Team filter
    if (options?.teams && !options.teams.includes(client.team) && !['OWNER', 'ADMIN'].includes(client.role)) return;
    // Room filter
    if (options?.room && !client.subscribedRooms.has(options.room) && !client.subscribedRooms.has('global')) return;

    client.ws.send(message);
  });
}

/**
 * Broadcast a call event to all relevant clients.
 */
export function broadcastCallEvent(eventType: string, call: any): void {
  broadcast(eventType, call);
}

/**
 * Get current connected client count.
 */
export function getConnectedCount(): number {
  return clients.size;
}

/**
 * Get supervisor board snapshot data.
 */
export function getSupervisorSnapshot() {
  const connectedAgents = Array.from(clients.values())
    .filter(c => ['AGENT', 'SUPERVISOR'].includes(c.role))
    .map(c => ({ userId: c.userId, role: c.role, team: c.team }));

  return {
    connectedAgents,
    connectedCount: clients.size,
    timestamp: new Date().toISOString(),
  };
}

export { wss };
