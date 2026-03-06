import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../server';
import { prisma } from '../db';
import { encrypt, decrypt, maskSensitive } from '../lib/crypto';

let server: any;
let port: number;

const JWT_SECRET = 'ligare-dev-secret-change-in-production';

let ownerToken: string;
let agentToken: string;
let auditorToken: string;
let ownerId: string;
let agentId: string;
let auditorId: string;
let categoryId: string;
let patientId: string;

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
    data: { email: 'owner-v23@test.com', password, name: 'Owner V23', role: 'OWNER', team: 'HH' },
  });
  const agent = await prisma.user.create({
    data: { email: 'agent-v23@test.com', password, name: 'Agent V23', role: 'AGENT', team: 'HH' },
  });
  const auditor = await prisma.user.create({
    data: { email: 'auditor-v23@test.com', password, name: 'Auditor V23', role: 'AUDITOR', team: 'HH' },
  });

  const category = await prisma.category.create({
    data: { name: 'V23 Test Category', description: 'For v2.3 testing' },
  });

  ownerId = owner.id;
  agentId = agent.id;
  auditorId = auditor.id;
  categoryId = category.id;

  ownerToken = makeToken({ id: owner.id, email: owner.email, name: owner.name, role: owner.role, team: owner.team });
  agentToken = makeToken({ id: agent.id, email: agent.email, name: agent.name, role: agent.role, team: agent.team });
  auditorToken = makeToken({ id: auditor.id, email: auditor.email, name: auditor.name, role: auditor.role, team: auditor.team });

  server = app.listen(0);
  port = (server.address() as any).port;
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

// ── Field-Level Encryption ──
describe('Field-Level Encryption (SSN)', () => {
  it('encrypt/decrypt round-trip works correctly', () => {
    const plaintext = '123-45-6789';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('each encryption produces different ciphertext (random IV)', () => {
    const ssn = '987-65-4321';
    const enc1 = encrypt(ssn);
    const enc2 = encrypt(ssn);
    expect(enc1).not.toBe(enc2); // different IV/salt each time
    expect(decrypt(enc1)).toBe(ssn);
    expect(decrypt(enc2)).toBe(ssn);
  });

  it('maskSensitive masks all but last 4 chars', () => {
    expect(maskSensitive('123-45-6789')).toBe('*******6789');
    expect(maskSensitive('1234')).toBe('1234');
    expect(maskSensitive('123')).toBe('****');
    expect(maskSensitive(null)).toBeNull();
  });

  it('POST /api/patients creates patient with encrypted SSN', async () => {
    const { status, data } = await req('POST', '/api/patients', agentToken, {
      mrn: 'SSN-TEST-001',
      firstName: 'Alice',
      lastName: 'Smith',
      phone: '555-111-2222',
      ssn: '111-22-3333',
    });
    expect(status).toBe(201);
    expect(data.mrn).toBe('SSN-TEST-001');
    expect(data.hasSsn).toBe(true);
    expect(data.ssnEncrypted).toBeUndefined(); // never exposed
    patientId = data.id;
  });

  it('GET /api/patients/:id does not expose raw SSN', async () => {
    const { status, data } = await req('GET', `/api/patients/${patientId}`, agentToken);
    expect(status).toBe(200);
    expect(data.ssnEncrypted).toBeUndefined();
    expect(data.hasSsn).toBe(true);
  });

  it('owner can request PHI details with masked SSN', async () => {
    const { status, data } = await req('GET', `/api/patients/${patientId}?phi=true`, ownerToken);
    expect(status).toBe(200);
    expect(data.ssnMasked).toBe('*******3333');
  });

  it('agent cannot get PHI details even with phi=true', async () => {
    const { data } = await req('GET', `/api/patients/${patientId}?phi=true`, agentToken);
    expect(data.ssnMasked).toBeUndefined();
    expect(data.hasSsn).toBe(true);
  });

  it('SSN in database is actually encrypted (not plaintext)', async () => {
    const rawPatient = await prisma.patient.findUnique({ where: { id: patientId } });
    expect(rawPatient!.ssnEncrypted).not.toBe('111-22-3333'); // not plaintext
    expect(rawPatient!.ssnEncrypted).toBeTruthy();
    const decrypted = decrypt(rawPatient!.ssnEncrypted!);
    expect(decrypted).toBe('111-22-3333');
  });

  it('PATCH patient can update SSN (re-encrypts)', async () => {
    const { status, data } = await req('PATCH', `/api/patients/${patientId}`, ownerToken, {
      ssn: '444-55-6666',
    });
    expect(status).toBe(200);
    expect(data.hasSsn).toBe(true);
    const rawPatient = await prisma.patient.findUnique({ where: { id: patientId } });
    expect(decrypt(rawPatient!.ssnEncrypted!)).toBe('444-55-6666');
  });
});

// ── HIPAA Audit Trail ──
describe('HIPAA Audit Trail', () => {
  it('GET /api/audit returns audit logs (owner)', async () => {
    const { status, data } = await req('GET', '/api/audit', ownerToken);
    expect(status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.total).toBeGreaterThan(0);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('auditor can read audit logs', async () => {
    const { status, data } = await req('GET', '/api/audit', auditorToken);
    expect(status).toBe(200);
    expect(data.data).toBeDefined();
  });

  it('agent cannot read audit logs', async () => {
    const { status } = await req('GET', '/api/audit', agentToken);
    expect(status).toBe(403);
  });

  it('audit logs include PHI_READ_PATIENT actions', async () => {
    // Access patient to generate PHI log
    await req('GET', `/api/patients/${patientId}`, agentToken);
    await req('GET', `/api/patients/${patientId}?phi=true`, ownerToken);

    const { data } = await req('GET', '/api/audit?action=PHI_READ', ownerToken);
    expect(data.data.some((log: any) => log.action.startsWith('PHI_READ'))).toBe(true);
  });

  it('GET /api/audit/phi returns PHI-specific logs', async () => {
    const { status, data } = await req('GET', '/api/audit/phi', ownerToken);
    expect(status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.every((log: any) => log.action.startsWith('PHI_'))).toBe(true);
  });

  it('GET /api/audit/stats returns summary statistics', async () => {
    const { status, data } = await req('GET', '/api/audit/stats', ownerToken);
    expect(status).toBe(200);
    expect(data.totalLogs).toBeDefined();
    expect(data.last24hCount).toBeDefined();
    expect(data.last7dCount).toBeDefined();
    expect(Array.isArray(data.byAction)).toBe(true);
  });

  it('can filter audit logs by resource', async () => {
    const { status, data } = await req('GET', '/api/audit?resource=patient', ownerToken);
    expect(status).toBe(200);
    expect(data.data.every((log: any) => log.resource === 'patient')).toBe(true);
  });

  it('can filter audit logs by userId', async () => {
    const { status, data } = await req('GET', `/api/audit?userId=${ownerId}`, ownerToken);
    expect(status).toBe(200);
    expect(data.data.every((log: any) => log.userId === ownerId)).toBe(true);
  });

  it('audit log search supports pagination', async () => {
    const { status, data } = await req('GET', '/api/audit?page=1&limit=5', ownerToken);
    expect(status).toBe(200);
    expect(data.data.length).toBeLessThanOrEqual(5);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(5);
  });
});

// ── PostgreSQL compatibility notes ──
describe('Database Provider Support', () => {
  it('schema.postgresql.prisma exists as Postgres reference', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(__dirname, '../../prisma/schema.postgresql.prisma');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('encryption works with various field types', () => {
    const testCases = ['123-45-6789', 'INS-GROUP-ABC-123', 'A1B2C3D4', 'test@example.com'];
    for (const value of testCases) {
      const encrypted = encrypt(value);
      expect(decrypt(encrypted)).toBe(value);
    }
  });
});
