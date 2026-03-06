import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../server';
import { prisma } from '../db';

let server: any;
let port: number;

const JWT_SECRET = 'ligare-dev-secret-change-in-production';

let ownerToken: string;
let agentToken: string;
let ownerId: string;
let agentId: string;
let categoryId: string;
let callId: string;

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
    data: { email: 'owner-v22@test.com', password, name: 'Test Owner', role: 'OWNER', team: 'HH' },
  });
  const agent = await prisma.user.create({
    data: { email: 'agent-v22@test.com', password, name: 'Test Agent', role: 'AGENT', team: 'HH' },
  });

  const category = await prisma.category.create({
    data: { name: 'V22 Test Category', description: 'For v2.2 testing' },
  });

  ownerId = owner.id;
  agentId = agent.id;
  categoryId = category.id;

  ownerToken = makeToken({ id: owner.id, email: owner.email, name: owner.name, role: owner.role, team: owner.team });
  agentToken = makeToken({ id: agent.id, email: agent.email, name: agent.name, role: agent.role, team: agent.team });

  // Create a test call
  const call = await prisma.call.create({
    data: {
      callerName: 'Test Patient',
      callerPhone: '555-2222',
      categoryId,
      priority: 'MEDIUM',
      status: 'QUEUED',
      team: 'HH',
      agentId,
    },
  });
  callId = call.id;

  server = app.listen(0);
  port = (server.address() as any).port;
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

// ── Disposition Templates ──
describe('Disposition Templates', () => {
  let templateId: string;

  it('owner can create a disposition template', async () => {
    const { status, data } = await req('POST', '/api/dispositions', ownerToken, {
      name: 'Resolved',
      description: 'Issue was resolved',
      category: 'Resolution',
    });
    expect(status).toBe(201);
    expect(data.name).toBe('Resolved');
    templateId = data.id;
  });

  it('agent cannot create a disposition template', async () => {
    const { status } = await req('POST', '/api/dispositions', agentToken, {
      name: 'BlockedTemplate',
    });
    expect(status).toBe(403);
  });

  it('agent can read disposition templates', async () => {
    const { status, data } = await req('GET', '/api/dispositions', agentToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/dispositions/:id returns a single template', async () => {
    const { status, data } = await req('GET', `/api/dispositions/${templateId}`, agentToken);
    expect(status).toBe(200);
    expect(data.name).toBe('Resolved');
  });

  it('owner can update a disposition template', async () => {
    const { status, data } = await req('PATCH', `/api/dispositions/${templateId}`, ownerToken, {
      description: 'Updated description',
    });
    expect(status).toBe(200);
    expect(data.description).toBe('Updated description');
  });

  it('returns 409 on duplicate template name', async () => {
    const { status } = await req('POST', '/api/dispositions', ownerToken, {
      name: 'Resolved',
    });
    expect(status).toBe(409);
  });

  it('owner can create a second template', async () => {
    const { status } = await req('POST', '/api/dispositions', ownerToken, {
      name: 'Transferred to Specialist',
      category: 'Transfer',
    });
    expect(status).toBe(201);
  });

  it('owner can delete (soft) a disposition template', async () => {
    const { status } = await req('DELETE', `/api/dispositions/${templateId}`, ownerToken);
    expect(status).toBe(204);
  });

  it('deleted template not in active list', async () => {
    const { data } = await req('GET', '/api/dispositions', agentToken);
    const found = data.find((t: any) => t.id === templateId);
    expect(found).toBeUndefined();
  });

  it('owner can see all templates including inactive', async () => {
    const { status, data } = await req('GET', '/api/dispositions/all', ownerToken);
    expect(status).toBe(200);
    const found = data.find((t: any) => t.id === templateId);
    expect(found).toBeDefined();
    expect(found.active).toBe(false);
  });

  it('returns 404 for nonexistent template', async () => {
    const { status } = await req('GET', '/api/dispositions/nonexistent-id', agentToken);
    expect(status).toBe(404);
  });
});

// ── Call Scripts ──
describe('Call Scripts', () => {
  let scriptId: string;

  it('owner can create a call script', async () => {
    const { status, data } = await req('POST', '/api/scripts', ownerToken, {
      name: 'Greeting Script',
      category: 'General',
      content: 'Hello, thank you for calling Ligare Health...',
    });
    expect(status).toBe(201);
    expect(data.name).toBe('Greeting Script');
    scriptId = data.id;
  });

  it('missing required fields returns 400', async () => {
    const { status } = await req('POST', '/api/scripts', ownerToken, {
      name: 'Incomplete',
    });
    expect(status).toBe(400);
  });

  it('agent can read call scripts', async () => {
    const { status, data } = await req('GET', '/api/scripts', agentToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('can filter scripts by category', async () => {
    await req('POST', '/api/scripts', ownerToken, {
      name: 'Insurance Script',
      category: 'Insurance',
      content: 'For insurance inquiries...',
    });
    const { data } = await req('GET', '/api/scripts?category=General', agentToken);
    expect(data.every((s: any) => s.category === 'General')).toBe(true);
  });

  it('GET /api/scripts/:id returns a single script', async () => {
    const { status, data } = await req('GET', `/api/scripts/${scriptId}`, agentToken);
    expect(status).toBe(200);
    expect(data.name).toBe('Greeting Script');
  });

  it('owner can update a call script', async () => {
    const { status, data } = await req('PATCH', `/api/scripts/${scriptId}`, ownerToken, {
      content: 'Updated greeting content...',
    });
    expect(status).toBe(200);
    expect(data.content).toBe('Updated greeting content...');
  });

  it('agent cannot delete call scripts', async () => {
    const { status } = await req('DELETE', `/api/scripts/${scriptId}`, agentToken);
    expect(status).toBe(403);
  });

  it('owner can delete (soft) a call script', async () => {
    const { status } = await req('DELETE', `/api/scripts/${scriptId}`, ownerToken);
    expect(status).toBe(204);
  });

  it('deleted script not in active list', async () => {
    const { data } = await req('GET', '/api/scripts', agentToken);
    const found = data.find((s: any) => s.id === scriptId);
    expect(found).toBeUndefined();
  });
});

// ── Follow-ups ──
describe('Follow-up Scheduling', () => {
  it('agent can schedule a follow-up on a call', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const { status, data } = await req('POST', `/api/followups/${callId}`, agentToken, {
      followUpDate: tomorrow,
      followUpAssignedTo: agentId,
    });
    expect(status).toBe(200);
    expect(data.followUpDate).toBeTruthy();
  });

  it('GET /api/followups returns pending follow-ups', async () => {
    const { status, data } = await req('GET', '/api/followups', agentToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/followups/overdue returns empty for future follow-ups', async () => {
    const { status, data } = await req('GET', '/api/followups/overdue', agentToken);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('can schedule an overdue follow-up', async () => {
    // Create a second call with past follow-up
    const call2 = await prisma.call.create({
      data: {
        callerName: 'Overdue Test',
        callerPhone: '555-3333',
        categoryId,
        priority: 'HIGH',
        status: 'QUEUED',
        team: 'HH',
        agentId,
        followUpDate: new Date(Date.now() - 86400000), // yesterday
        followUpAssignedTo: agentId,
      },
    });
    const { data } = await req('GET', '/api/followups/overdue', ownerToken);
    expect(data.some((f: any) => f.id === call2.id)).toBe(true);
  });

  it('missing followUpDate returns 400', async () => {
    const { status } = await req('POST', `/api/followups/${callId}`, agentToken, {});
    expect(status).toBe(400);
  });

  it('scheduling on nonexistent call returns 404', async () => {
    const { status } = await req('POST', '/api/followups/nonexistent', agentToken, {
      followUpDate: new Date().toISOString(),
    });
    expect(status).toBe(404);
  });

  it('DELETE /api/followups/:callId removes follow-up', async () => {
    const { status } = await req('DELETE', `/api/followups/${callId}`, agentToken);
    expect(status).toBe(204);
  });

  it('follow-up removed from list after deletion', async () => {
    const { data } = await req('GET', '/api/followups', ownerToken);
    const found = data.find((f: any) => f.id === callId && f.followUpDate);
    expect(found).toBeUndefined();
  });
});

// ── Dashboard — Disposition Analytics ──
describe('Dashboard with Disposition Analytics', () => {
  it('dashboard includes disposition analytics', async () => {
    const { status, data } = await req('GET', '/api/dashboard', ownerToken);
    expect(status).toBe(200);
    expect(data.callsByDisposition).toBeDefined();
    expect(data.pendingFollowUps).toBeDefined();
    expect(data.overdueFollowUps).toBeDefined();
    expect(typeof data.pendingFollowUps).toBe('number');
    expect(typeof data.overdueFollowUps).toBe('number');
  });
});
