import { Request } from 'express';
import { prisma } from '../db';

export async function logAudit(
  action: string,
  userId: string,
  callId?: string,
  details?: string,
  patientId?: string,
  resource?: string
): Promise<void> {
  await prisma.auditLog.create({
    data: { action, userId, callId, details, patientId, resource },
  });
}

/**
 * Log PHI access for HIPAA compliance
 */
export async function logPhiAccess(
  action: 'PHI_ACCESS' | 'PHI_READ_PATIENT' | 'PHI_READ_SSN' | 'PHI_READ_INSURANCE',
  userId: string,
  patientId: string,
  details: string,
  req?: Request
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      patientId,
      details,
      resource: 'patient',
      ipAddress: req ? (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || null : null,
      userAgent: req ? req.headers['user-agent'] || null : null,
    },
  });
}
