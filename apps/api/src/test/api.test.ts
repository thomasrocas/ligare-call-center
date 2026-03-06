import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../server';
import { prisma } from '../db';

let server: any;
let port: number;

const JWT_SECRET = 'ligare-dev-secret-change-in-production';

// Test users
let ownerToken: string;
let agentToken: string;
let auditorToken: string;
let ownerId: string;
let agentId: string;
let auditorId: string;
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

beforeAll(async () => {
  // Reset DB (children before parents)
  await prisma.$executeRawUnsafe('DELETE FROM "AuditLog"');
  await prisma.$executeRawUnsafe('DELETE FROM "Call"');
  await prisma.$executeRawUnsafe('DELETE FROM "Patient"');
  await prisma.$executeRawUnsafe('DELETE FROM "User"');
  await prisma.$executeRawUnsafe('DELETE FROM "Category"');

  // Seed test data
  const password = await bcrypt.hash('testpass', 10);

  const owner = await prisma.user.create({
    data: { email: 'owner@test.com', password, name: 'Test Owner', role: 'OWNER', team: 'HH' },
  });
  const agent = await prisma.user.create({
    data: { email: 'agent@test.com', password, name: 'Test Agent', role: 'AGENT', team: 'HH' },
  });
  const auditor = await prisma.user.create({
    data: { email: 'auditor@test.com', password, name: 'Test Auditor', role: 'AUDITOR', team: 'HH' },
  });

  const category = await prisma.category.create({
    data: { name: 'Test Category', description: 'For testing' },
  });

  ownerId = owner.id;
  agentId = agent.id;
  auditorId = auditor.id;
  categoryId = category.id;

  ownerToken = makeToken({ id: owner.id, email: owner.email, name: owner.name, role: owner.role, team: owner.team });
  agentToken = makeToken({ id: agent.id, email: agent.email, name: agent.name, role: agent.role, team: agent.team });
  auditorToken = makeToken({ id: auditor.id, email: auditor.email, name: auditor.name, role: auditor.role, team: auditor.team });

  // Start server
  server = app.listen(0);
  port = (server.address() as any).port;
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

// ── Health ──
describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const { status, data } = await req('GET', '/api/health');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
  });
});

// ── Auth ──
describe('Auth', () => {
  it('rejects unauthenticated requests', async () => {
    const { status } = await req('GET', '/api/calls');
    expect(status).toBe(401);
  });

  it('POST /api/auth/login with valid creds', async () => {
    const { status, data } = await req('POST', '/api/auth/login', undefined, {
      email: 'owner@test.com',
      password: 'testpass',
    });
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
    expect(data.user.email).toBe('owner@test.com');
  });

  it('POST /api/auth/login rejects bad password', async () => {
    const { status } = await req('POST', '/api/auth/login', undefined, {
      email: 'owner@test.com',
      password: 'wrong',
    });
    expect(status).toBe(401);
  });

  it('GET /api/auth/me returns current user', async () => {
    const { status, data } = await req('GET', '/api/auth/me', ownerToken);
    expect(status).toBe(200);
    expect(data.email).toBe('owner@test.com');
  });
});

// ── Call Lifecycle ──
describe('Call Lifecycle', () => {
  let callId: string;

  it('POST /api/calls creates a call', async () => {
    const { status, data } = await req('POST', '/api/calls', agentToken, {
      callerName: 'John Doe',
      callerPhone: '555-1234',
      categoryId,
      priority: 'HIGH',
      team: 'HH',
      notes: 'Test call',
    });
    expect(status).toBe(201);
    expect(data.callerName).toBe('John Doe');
    expect(data.status).toBe('QUEUED');
    expect(data.agentId).toBe(agentId);
    callId = data.id;
  });

  it('GET /api/calls lists calls', async () => {
    const { status, data } = await req('GET', '/api/calls', agentToken);
    expect(status).toBe(200);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);
  });

  it('GET /api/calls/:id returns call detail', async () => {
    const { status, data } = await req('GET', `/api/calls/${callId}`, agentToken);
    expect(status).toBe(200);
    expect(data.id).toBe(callId);
    expect(data.callerName).toBe('John Doe');
  });

  it('POST /api/calls/:id/start starts the call', async () => {
    const { status, data } = await req('POST', `/api/calls/${callId}/start`, agentToken);
    expect(status).toBe(200);
    expect(data.status).toBe('IN_PROGRESS');
    expect(data.startedAt).toBeTruthy();
  });

  it('rejects starting an already started call', async () => {
    const { status } = await req('POST', `/api/calls/${callId}/start`, agentToken);
    expect(status).toBe(400);
  });

  it('POST /api/calls/:id/complete completes the call', async () => {
    const { status, data } = await req('POST', `/api/calls/${callId}/complete`, agentToken, {
      notes: 'Call resolved',
    });
    expect(status).toBe(200);
    expect(data.status).toBe('COMPLETED');
    expect(data.completedAt).toBeTruthy();
    expect(data.duration).toBeGreaterThanOrEqual(0);
  });

  it('rejects completing a completed call', async () => {
    const { status } = await req('POST', `/api/calls/${callId}/complete`, agentToken);
    expect(status).toBe(400);
  });
});

// ── Transfer ──
describe('Call Transfer', () => {
  let callId: string;

  it('create and start a call for transfer', async () => {
    const { data } = await req('POST', '/api/calls', agentToken, {
      callerName: 'Transfer Test',
      callerPhone: '555-9999',
      categoryId,
      priority: 'MEDIUM',
      team: 'HH',
    });
    callId = data.id;
    await req('POST', `/api/calls/${callId}/start`, agentToken);
  });

  it('POST /api/calls/:id/transfer transfers the call', async () => {
    const { status, data } = await req('POST', `/api/calls/${callId}/transfer`, agentToken, {
      transferredTo: ownerId,
      transferNotes: 'Escalating to owner',
    });
    expect(status).toBe(200);
    expect(data.status).toBe('TRANSFERRED');
  });
});

// ── RBAC ──
describe('RBAC', () => {
  it('auditor cannot create calls', async () => {
    const { status } = await req('POST', '/api/calls', auditorToken, {
      callerName: 'Blocked',
      callerPhone: '555-0000',
      categoryId,
      priority: 'LOW',
      team: 'HH',
    });
    expect(status).toBe(403);
  });

  it('auditor can read calls', async () => {
    const { status } = await req('GET', '/api/calls', auditorToken);
    expect(status).toBe(200);
  });

  it('agent cannot manage users', async () => {
    const { status } = await req('GET', '/api/users', agentToken);
    expect(status).toBe(403);
  });

  it('owner can manage users', async () => {
    const { status, data } = await req('GET', '/api/users', ownerToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('auditor can view dashboard', async () => {
    const { status } = await req('GET', '/api/dashboard', auditorToken);
    expect(status).toBe(200);
  });

  it('agent cannot view dashboard', async () => {
    const { status } = await req('GET', '/api/dashboard', agentToken);
    expect(status).toBe(403);
  });
});

// ── Dashboard ──
describe('Dashboard', () => {
  it('returns KPI data', async () => {
    const { status, data } = await req('GET', '/api/dashboard', ownerToken);
    expect(status).toBe(200);
    expect(data.totalCalls).toBeGreaterThan(0);
    expect(data.callsByStatus).toBeDefined();
    expect(data.callsByTeam).toBeDefined();
    expect(data.callsByHour).toHaveLength(24);
    expect(data.topAgents).toBeDefined();
  });
});

// ── Categories ──
describe('Categories', () => {
  it('lists categories', async () => {
    const { status, data } = await req('GET', '/api/categories', agentToken);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
  });

  it('owner can create category', async () => {
    const { status, data } = await req('POST', '/api/categories', ownerToken, {
      name: 'New Category',
      description: 'Created in test',
    });
    expect(status).toBe(201);
    expect(data.name).toBe('New Category');
  });

  it('agent cannot create category', async () => {
    const { status } = await req('POST', '/api/categories', agentToken, {
      name: 'Blocked Category',
    });
    expect(status).toBe(403);
  });
});

// ── Exports ──
describe('Exports', () => {
  it('owner can export CSV', async () => {
    const { status, data } = await req('GET', '/api/exports/calls.csv', ownerToken);
    expect(status).toBe(200);
    expect(typeof data).toBe('string');
    expect(data).toContain('Caller Name');
  });

  it('agent cannot export CSV', async () => {
    const { status } = await req('GET', '/api/exports/calls.csv', agentToken);
    expect(status).toBe(403);
  });
});
