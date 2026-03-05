process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'ligare-dev-secret-change-in-production';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../server';

const prisma = new PrismaClient();
const JWT_SECRET = 'ligare-dev-secret-change-in-production';

let server: any;
let port: number;
let ownerToken: string;
let agentToken: string;

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
  // Clean tables
  await prisma.patient.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.call.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // Seed test users
  const hash = await bcrypt.hash('password123', 10);
  const owner = await prisma.user.create({ data: { email: 'owner-pt@test.com', password: hash, name: 'Test Owner', role: 'OWNER', team: 'HH' } });
  const agent = await prisma.user.create({ data: { email: 'agent-pt@test.com', password: hash, name: 'Test Agent', role: 'AGENT', team: 'HH' } });

  ownerToken = jwt.sign(
    { id: owner.id, email: owner.email, name: owner.name, role: owner.role, team: owner.team },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
  agentToken = jwt.sign(
    { id: agent.id, email: agent.email, name: agent.name, role: agent.role, team: agent.team },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  server = app.listen(0);
  port = (server.address() as any).port;
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

describe('Patient CRUD', () => {
  let patientId: string;

  it('POST /api/patients creates a patient', async () => {
    const { status, data } = await req('POST', '/api/patients', ownerToken, {
      mrn: 'MRN-001',
      firstName: 'John',
      lastName: 'Doe',
      dob: '1985-06-15',
      phone: '555-123-4567',
      email: 'john.doe@example.com',
      insuranceProvider: 'Blue Cross',
      insuranceId: 'BC-12345',
      tags: ['VIP', 'Spanish'],
    });
    expect(status).toBe(201);
    expect(data.mrn).toBe('MRN-001');
    expect(data.firstName).toBe('John');
    expect(data.phone).toBe('5551234567');
    expect(data.tags).toEqual(['VIP', 'Spanish']);
    patientId = data.id;
  });

  it('rejects duplicate MRN', async () => {
    const { status } = await req('POST', '/api/patients', ownerToken, {
      mrn: 'MRN-001',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-999-9999',
    });
    expect(status).toBe(409);
  });

  it('GET /api/patients lists patients', async () => {
    const { status, data } = await req('GET', '/api/patients', ownerToken);
    expect(status).toBe(200);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);
  });

  it('GET /api/patients?q=search works', async () => {
    const { status, data } = await req('GET', '/api/patients?q=MRN-001', ownerToken);
    expect(status).toBe(200);
    expect(data.data.length).toBe(1);
    expect(data.data[0].mrn).toBe('MRN-001');
  });

  it('GET /api/patients/:id returns patient detail', async () => {
    const { status, data } = await req('GET', `/api/patients/${patientId}`, ownerToken);
    expect(status).toBe(200);
    expect(data.mrn).toBe('MRN-001');
    expect(data.calls).toBeDefined();
    expect(Array.isArray(data.calls)).toBe(true);
  });

  it('PATCH /api/patients/:id updates patient', async () => {
    const { status, data } = await req('PATCH', `/api/patients/${patientId}`, ownerToken, {
      insuranceProvider: 'Aetna',
      tags: ['VIP', 'Spanish', 'Follow-up needed'],
    });
    expect(status).toBe(200);
    expect(data.insuranceProvider).toBe('Aetna');
    expect(data.tags).toHaveLength(3);
  });

  it('GET /api/patients/lookup/:phone finds patient', async () => {
    const { status, data } = await req('GET', '/api/patients/lookup/5551234567', ownerToken);
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].mrn).toBe('MRN-001');
  });
});

describe('Patient Batch Import', () => {
  it('POST /api/patients/import creates patients from array', async () => {
    const { status, data } = await req('POST', '/api/patients/import', ownerToken, {
      patients: [
        { mrn: 'MRN-100', firstName: 'Alice', lastName: 'Smith', phone: '555-100-0001', dob: '1990-01-15' },
        { mrn: 'MRN-101', firstName: 'Bob', lastName: 'Jones', phone: '555-100-0002', email: 'bob@example.com' },
        { mrn: 'MRN-102', firstName: 'Carol', lastName: 'Williams', phone: '555-100-0003', insuranceProvider: 'Cigna' },
      ],
    });
    expect(status).toBe(200);
    expect(data.total).toBe(3);
    expect(data.created).toBe(3);
    expect(data.errors).toHaveLength(0);
  });

  it('updates existing patients on re-import', async () => {
    const { status, data } = await req('POST', '/api/patients/import', ownerToken, {
      patients: [
        { mrn: 'MRN-100', firstName: 'Alice', lastName: 'Smith-Updated', phone: '555-100-0001' },
      ],
    });
    expect(status).toBe(200);
    expect(data.updated).toBe(1);
    expect(data.created).toBe(0);

    // Verify update applied
    const { data: patient } = await req('GET', '/api/patients?q=MRN-100', ownerToken);
    expect(patient.data[0].lastName).toBe('Smith-Updated');
  });

  it('reports errors for invalid rows', async () => {
    const { status, data } = await req('POST', '/api/patients/import', ownerToken, {
      patients: [
        { mrn: 'MRN-200', firstName: 'Valid', lastName: 'Patient', phone: '555-200-0001' },
        { mrn: '', firstName: 'Missing', lastName: 'MRN', phone: '555-200-0002' },
        { mrn: 'MRN-202', firstName: '', lastName: '', phone: '' },
      ],
    });
    expect(status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.skipped).toBe(2);
    expect(data.errors.length).toBe(2);
  });

  it('agent cannot batch import (admin only)', async () => {
    const { status } = await req('POST', '/api/patients/import', agentToken, {
      patients: [{ mrn: 'MRN-999', firstName: 'Blocked', lastName: 'Import', phone: '555-999-9999' }],
    });
    expect(status).toBe(403);
  });
});
