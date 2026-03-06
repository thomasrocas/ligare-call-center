import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const auditRouter = Router();

auditRouter.use(authenticate);

// GET /api/audit — search audit logs with filters
auditRouter.get('/', requirePermission('audit:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const callId = req.query.callId as string | undefined;
    const patientId = req.query.patientId as string | undefined;
    const resource = req.query.resource as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = { contains: action };
    if (userId) where.userId = userId;
    if (callId) where.callId = callId;
    if (patientId) where.patientId = patientId;
    if (resource) where.resource = resource;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          call: { select: { id: true, callerName: true, status: true } },
          patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data: logs, total, page, limit });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch audit logs', statusCode: 500 });
  }
});

// GET /api/audit/phi — PHI access logs specifically
auditRouter.get('/phi', requirePermission('audit:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const skip = (page - 1) * limit;

    const phiActions = ['PHI_ACCESS', 'PHI_READ_PATIENT', 'PHI_READ_SSN', 'PHI_READ_INSURANCE'];

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { action: { in: phiActions } },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: { action: { in: phiActions } } }),
    ]);

    res.json({ data: logs, total, page, limit });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch PHI logs', statusCode: 500 });
  }
});

// GET /api/audit/stats — summary statistics
auditRouter.get('/stats', requirePermission('audit:read'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const last24h = new Date(Date.now() - 86400000);
    const last7d = new Date(Date.now() - 7 * 86400000);

    const [totalLogs, last24hCount, last7dCount, byAction] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.auditLog.groupBy({ by: ['action'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    ]);

    res.json({
      totalLogs,
      last24hCount,
      last7dCount,
      byAction: byAction.map(a => ({ action: a.action, count: a._count.id })),
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch audit stats', statusCode: 500 });
  }
});
