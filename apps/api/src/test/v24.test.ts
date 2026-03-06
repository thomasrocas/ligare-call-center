import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { app, httpServer } from '../server';
import { prisma } from '../db';
import { createWsServer } from '../ws/wsServer';

let port: number;
const JWT_SECRET = 'ligare-dev-secret-change-in-production';

let ownerToken: string;
let supervisorToken: string;
let agentToken: string;
let ownerId: string;
let supervisorId: string;
let agentId: string;
let categoryId: string;

function makeToken(user: { id: string; email: string; name: string; role: string; team: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

async function req(method: string, path: string, token?: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

/**
 * Connect to WS and buffer ALL messages from the start.
 * This avoids the race condition where messages arrive before the listener is set up.
 */
interface WsConnection {
  ws: WebSocket;
  messages: any[];
  waitFor(type: string, timeoutMs?: number): Promise<any>;
  close(): void;
}

function connectWs(token?: string): Promise<WsConnection> {
  return new Promise((resolve, reject) => {
    const url = token
      ? `ws://127.0.0.1:${port}/ws?token=${token}`
      : `ws://127.0.0.1:${port}/ws`;
    const ws = new WebSocket(url);
    const messages: any[] = [];
    const waiters: Array<{ type: string; resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }> = [];

    ws.on('message', (data: Buffer) => {
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      messages.push(msg);
      // Notify any waiters
      const idx = waiters.findIndex(w => w.type === msg.type);
      if (idx !== -1) {
        const waiter = waiters.splice(idx, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(msg);
      }
    });

    const conn: WsConnection = {
      ws,
      messages,
      waitFor(type: string, timeoutMs = 3000): Promise<any> {
        // Check buffer first
        const existing = messages.find(m => m.type === type);
        if (existing) return Promise.resolve(existing);
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            const idx = waiters.findIndex(w => w.type === type);
            if (idx !== -1) waiters.splice(idx, 1);
            rej(new Error(`Timeout waiting for WS message type: ${type}`));
          }, timeoutMs);
          waiters.push({ type, resolve: res, reject: rej, timer });
        });
      },
      close() { ws.close(); },
    };

    ws.on('open', () => resolve(conn));
    ws.on('error', (err) => reject(err));
    setTimeout(() => reject(new Error('WS connection timeout')), 5000);
  });
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "FileAttachment"');
  await prisma.$executeRawUnsafe('DELETE FROM "AuditLog"');
  await prisma.$executeRawUnsafe('DELETE FROM "Call"');
  await prisma.$executeRawUnsafe('DELETE FROM "Patient"');
  await prisma.$executeRawUnsafe('DELETE FROM "User"');
  await prisma.$executeRawUnsafe('DELETE FROM "Category"');
  await prisma.$executeRawUnsafe('DELETE FROM "DispositionTemplate"');
  await prisma.$executeRawUnsafe('DELETE FROM "CallScript"');

  const password = await bcrypt.hash('testpass', 10);

  const owner = await prisma.user.create({
    data: { email: 'owner-v24@test.com', password, name: 'Owner V24', role: 'OWNER', team: 'HH' },
  });
  const supervisor = await prisma.user.create({
    data: { email: 'supervisor-v24@test.com', password, name: 'Supervisor V24', role: 'SUPERVISOR', team: 'HH' },
  });
  const agent = await prisma.user.create({
    data: { email: 'agent-v24@test.com', password, name: 'Agent V24', role: 'AGENT', team: 'HH' },
  });

  const category = await prisma.category.create({
    data: { name: 'V24 Test Category' },
  });

  ownerId = owner.id;
  supervisorId = supervisor.id;
  agentId = agent.id;
  categoryId = category.id;

  ownerToken = makeToken({ id: owner.id, email: owner.email, name: owner.name, role: owner.role, team: owner.team });
  supervisorToken = makeToken({ id: supervisor.id, email: supervisor.email, name: supervisor.name, role: supervisor.role, team: supervisor.team });
  agentToken = makeToken({ id: agent.id, email: agent.email, name: agent.name, role: agent.role, team: agent.team });

  // Start HTTP+WS server
  createWsServer(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as any).port;
      resolve();
    });
  });
});

afterAll(async () => {
  httpServer.close();
  await prisma.$disconnect();
});

// ── WebSocket Server ──
describe('WebSocket Server', () => {
  it('rejects connection without token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const closed = await new Promise<{ code: number }>((resolve) => {
      ws.on('close', (code) => resolve({ code }));
      ws.on('error', () => {}); // suppress errors
    });
    expect(closed.code).toBe(4001);
  });

  it('accepts connection with valid token and sends connected event', async () => {
    const conn = await connectWs(ownerToken);
    const msg = await conn.waitFor('connected');
    expect(msg.type).toBe('connected');
    expect(msg.data.role).toBe('OWNER');
    conn.close();
  });

  it('accepts supervisor connection', async () => {
    const conn = await connectWs(supervisorToken);
    const msg = await conn.waitFor('connected');
    expect(msg.data.role).toBe('SUPERVISOR');
    conn.close();
  });

  it('ping/pong works', async () => {
    const conn = await connectWs(agentToken);
    await conn.waitFor('connected');
    conn.ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await conn.waitFor('pong');
    expect(pong.type).toBe('pong');
    conn.close();
  });

  it('subscribe to room works', async () => {
    const conn = await connectWs(supervisorToken);
    await conn.waitFor('connected');
    conn.ws.send(JSON.stringify({ type: 'subscribe', room: 'supervisor' }));
    const subscribed = await conn.waitFor('subscribed');
    expect(subscribed.data.room).toBe('supervisor');
    conn.close();
  });

  it('broadcasts call:created event when call is created', async () => {
    const conn = await connectWs(supervisorToken);
    await conn.waitFor('connected');

    // Create call via REST → should broadcast
    await req('POST', '/api/calls', agentToken, {
      callerName: 'WS Test Caller',
      callerPhone: '555-8888',
      categoryId,
      priority: 'HIGH',
      team: 'HH',
    });

    const event = await conn.waitFor('call:created', 4000);
    expect(event.type).toBe('call:created');
    expect(event.data.callerName).toBe('WS Test Caller');
    conn.close();
  });

  it('broadcasts call:started event', async () => {
    const { data: call } = await req('POST', '/api/calls', agentToken, {
      callerName: 'WS Start Test',
      callerPhone: '555-7777',
      categoryId,
      priority: 'MEDIUM',
      team: 'HH',
    });

    const conn = await connectWs(supervisorToken);
    await conn.waitFor('connected');

    await req('POST', `/api/calls/${call.id}/start`, agentToken);

    const event = await conn.waitFor('call:started', 4000);
    expect(event.type).toBe('call:started');
    expect(event.data.status).toBe('IN_PROGRESS');
    conn.close();
  });
});

// ── Supervisor Board ──
describe('Supervisor Board', () => {
  it('GET /api/supervisor/board returns live board (supervisor)', async () => {
    const { status, data } = await req('GET', '/api/supervisor/board', supervisorToken);
    expect(status).toBe(200);
    expect(data.summary).toBeDefined();
    expect(data.queued).toBeDefined();
    expect(data.inProgress).toBeDefined();
    expect(data.transferred).toBeDefined();
    expect(data.agentWorkload).toBeDefined();
    expect(data.wsSnapshot).toBeDefined();
  });

  it('GET /api/supervisor/board returns live board (owner)', async () => {
    const { status } = await req('GET', '/api/supervisor/board', ownerToken);
    expect(status).toBe(200);
  });

  it('agent cannot access supervisor board', async () => {
    const { status } = await req('GET', '/api/supervisor/board', agentToken);
    expect(status).toBe(403);
  });

  it('supervisor board summary has correct fields', async () => {
    const { data } = await req('GET', '/api/supervisor/board', supervisorToken);
    expect(typeof data.summary.totalActive).toBe('number');
    expect(typeof data.summary.queued).toBe('number');
    expect(typeof data.summary.inProgress).toBe('number');
    expect(typeof data.summary.connectedAgents).toBe('number');
  });

  it('GET /api/supervisor/metrics returns queue metrics', async () => {
    const { status, data } = await req('GET', '/api/supervisor/metrics', supervisorToken);
    expect(status).toBe(200);
    expect(typeof data.totalToday).toBe('number');
    expect(typeof data.pendingQueue).toBe('number');
    expect(Array.isArray(data.callsPerHour)).toBe(true);
    expect(data.callsPerHour).toHaveLength(24);
  });

  it('GET /api/supervisor/agents returns agent status list', async () => {
    const { status, data } = await req('GET', '/api/supervisor/agents', supervisorToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((a: any) => a.id === agentId)).toBe(true);
  });

  it('agent status includes online and activeCalls fields', async () => {
    const { data } = await req('GET', '/api/supervisor/agents', supervisorToken);
    const agent = data.find((a: any) => a.id === agentId);
    expect(agent).toBeDefined();
    expect(typeof agent.online).toBe('boolean');
    expect(typeof agent.activeCalls).toBe('number');
  });

  it('can filter board by team', async () => {
    const { status, data } = await req('GET', '/api/supervisor/board?team=HH', supervisorToken);
    expect(status).toBe(200);
    expect(data.summary).toBeDefined();
  });

  it('metrics escalations count urgent calls', async () => {
    const { data } = await req('GET', '/api/supervisor/metrics', supervisorToken);
    expect(typeof data.escalations).toBe('number');
  });
});
