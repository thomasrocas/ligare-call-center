import { prisma } from '../db';

export async function logAudit(action: string, userId: string, callId?: string, details?: string): Promise<void> {
  await prisma.auditLog.create({
    data: { action, userId, callId, details },
  });
}
