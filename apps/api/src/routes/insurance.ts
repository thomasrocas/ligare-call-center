/**
 * Insurance verification mock API.
 * 
 * In production, this would integrate with real insurance verification services
 * (e.g., Availity, Change Healthcare, etc.).
 * 
 * For now, this provides a mock that simulates the verification flow.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';
import { logPhiAccess } from '../middleware/audit';

export const insuranceRouter = Router();

insuranceRouter.use(authenticate);

// Mock insurance database
const MOCK_INSURERS: Record<string, { name: string; plans: string[] }> = {
  'BCBS': { name: 'Blue Cross Blue Shield', plans: ['PPO', 'HMO', 'EPO'] },
  'AETNA': { name: 'Aetna', plans: ['Choice POS', 'Signature', 'HMO'] },
  'CIGNA': { name: 'Cigna', plans: ['Open Access', 'HMO', 'PPO'] },
  'UNITED': { name: 'UnitedHealthcare', plans: ['Choice', 'Core', 'Navigate'] },
  'HUMANA': { name: 'Humana', plans: ['HMO', 'PPO', 'Choice Care'] },
  'MEDICAID': { name: 'Medicaid', plans: ['Standard', 'Managed Care'] },
  'MEDICARE': { name: 'Medicare', plans: ['Part A', 'Part B', 'Part C', 'Part D'] },
};

function mockVerifyInsurance(memberId: string, provider: string): {
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'UNKNOWN';
  coverageType: string;
  groupNumber: string;
  effectiveDate: string;
  terminationDate: string | null;
  copay: number;
  deductible: number;
  deductibleMet: number;
} {
  // Deterministic mock based on memberId
  const hash = memberId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const insurer = MOCK_INSURERS[provider.toUpperCase()] || { name: provider, plans: ['Standard'] };
  const planIdx = hash % insurer.plans.length;
  const plan = insurer.plans[planIdx];

  // Mock status: most IDs are ACTIVE, some edge cases
  let status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'UNKNOWN' = 'ACTIVE';
  if (memberId.startsWith('INACTIVE')) status = 'INACTIVE';
  else if (memberId.startsWith('PENDING')) status = 'PENDING';
  else if (memberId.startsWith('UNKNOWN')) status = 'UNKNOWN';

  return {
    status,
    coverageType: plan,
    groupNumber: `GRP-${(hash % 9000) + 1000}`,
    effectiveDate: new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0],
    terminationDate: status === 'INACTIVE' ? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0] : null,
    copay: [20, 25, 30, 40, 50][hash % 5],
    deductible: [500, 1000, 1500, 2000, 3000][hash % 5],
    deductibleMet: Math.floor((hash % 100) / 100 * [500, 1000, 1500, 2000, 3000][hash % 5]),
  };
}

// POST /api/insurance/verify — verify patient insurance
insuranceRouter.post('/verify', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId, provider, memberId } = req.body;

    if (!provider || !memberId) {
      res.status(400).json({ error: 'Bad Request', message: 'provider and memberId are required', statusCode: 400 });
      return;
    }

    // If patientId provided, also update the patient record
    let patient = null;
    if (patientId) {
      patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        res.status(404).json({ error: 'Not Found', message: 'Patient not found', statusCode: 404 });
        return;
      }
    }

    // Simulate verification delay (mock)
    const verification = mockVerifyInsurance(memberId, provider);

    // Log PHI access
    if (patient) {
      await logPhiAccess('PHI_READ_INSURANCE', req.user!.id, patient.id, `Insurance verified: ${provider} / ${memberId}`, req);
    }

    res.json({
      patientId: patientId || null,
      provider,
      memberId,
      providerName: MOCK_INSURERS[provider.toUpperCase()]?.name || provider,
      verifiedAt: new Date().toISOString(),
      verifiedBy: req.user!.id,
      ...verification,
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Insurance verification failed', statusCode: 500 });
  }
});

// GET /api/insurance/providers — list supported providers
insuranceRouter.get('/providers', requirePermission('calls:read'), async (_req: Request, res: Response): Promise<void> => {
  res.json(
    Object.entries(MOCK_INSURERS).map(([code, info]) => ({
      code,
      name: info.name,
      plans: info.plans,
    }))
  );
});

// GET /api/insurance/patient/:patientId — get patient's insurance status
insuranceRouter.get('/patient/:patientId', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.params['patientId'] as string;
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        insuranceProvider: true,
        insuranceId: true,
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Not Found', message: 'Patient not found', statusCode: 404 });
      return;
    }

    // Log PHI access
    await logPhiAccess('PHI_READ_INSURANCE', req.user!.id, patient.id, 'Patient insurance status accessed', req);

    if (!patient.insuranceProvider || !patient.insuranceId) {
      res.json({
        patientId: patient.id,
        mrn: patient.mrn,
        hasInsurance: false,
        provider: null,
        memberId: null,
        status: 'UNKNOWN',
        lastVerified: null,
      });
      return;
    }

    const verification = mockVerifyInsurance(patient.insuranceId, patient.insuranceProvider);

    res.json({
      patientId: patient.id,
      mrn: patient.mrn,
      hasInsurance: true,
      provider: patient.insuranceProvider,
      providerName: MOCK_INSURERS[patient.insuranceProvider.toUpperCase()]?.name || patient.insuranceProvider,
      memberId: patient.insuranceId,
      lastVerified: new Date().toISOString(),
      ...verification,
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get insurance status', statusCode: 500 });
  }
});
