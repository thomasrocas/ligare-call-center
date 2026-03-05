import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import type { CallStatus } from '@ligare/shared';

export const callsRouter = Router();

// All call routes require authentication
callsRouter.use(authenticate);

// GET /api/calls — list calls (with filters)
callsRouter.get('/', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const team = req.query.team as string | undefined;
    const priority = req.query.priority as string | undefined;
    const agentId = req.query.agentId as string | undefined;
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '50';
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (team) where.team = team;
    if (priority) where.priority = priority;
    if (agentId) where.agentId = agentId;

    // Agents can only see their own calls unless they're supervisors+
    if (req.user!.role === 'AGENT') {
      where.agentId = req.user!.id;
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: { category: true, agent: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.call.count({ where }),
    ]);

    const mapped = calls.map((c) => ({
      ...c,
      categoryName: c.category.name,
      agentName: c.agent.name,
    }));

    res.json({ data: mapped, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch calls', statusCode: 500 });
  }
});

// GET /api/calls/:id
callsRouter.get('/:id', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        category: true,
        agent: { select: { id: true, name: true } },
        auditLogs: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
      },
    });
    if (!call) {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }
    res.json({ ...call, categoryName: call.category.name, agentName: call.agent.name });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch call', statusCode: 500 });
  }
});

// POST /api/calls — create a new call
callsRouter.post('/', requirePermission('calls:create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { callerName, callerPhone, categoryId, priority, team, notes } = req.body;
    if (!callerName || !callerPhone || !categoryId || !priority || !team) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing required fields', statusCode: 400 });
      return;
    }

    const call = await prisma.call.create({
      data: {
        callerName,
        callerPhone,
        categoryId,
        priority,
        status: 'QUEUED',
        team,
        agentId: req.user!.id,
        notes,
      },
      include: { category: true, agent: { select: { id: true, name: true } } },
    });

    await logAudit('CALL_CREATED', req.user!.id, call.id, `Call created for ${callerName}`);
    res.status(201).json({ ...call, categoryName: call.category.name, agentName: call.agent.name });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create call', statusCode: 500 });
  }
});

// POST /api/calls/:id/start
callsRouter.post('/:id/start', requirePermission('calls:start'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }
    if (call.status !== 'QUEUED') {
      res.status(400).json({ error: 'Bad Request', message: `Cannot start call in status: ${call.status}`, statusCode: 400 });
      return;
    }

    const updated = await prisma.call.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: { category: true, agent: { select: { id: true, name: true } } },
    });

    await logAudit('CALL_STARTED', req.user!.id, call.id, 'Call started');
    res.json({ ...updated, categoryName: updated.category.name, agentName: updated.agent.name });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start call', statusCode: 500 });
  }
});

// POST /api/calls/:id/complete
callsRouter.post('/:id/complete', requirePermission('calls:complete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }
    if (call.status !== 'IN_PROGRESS') {
      res.status(400).json({ error: 'Bad Request', message: `Cannot complete call in status: ${call.status}`, statusCode: 400 });
      return;
    }

    const completedAt = new Date();
    const duration = call.startedAt ? Math.round((completedAt.getTime() - call.startedAt.getTime()) / 1000) : 0;

    const updated = await prisma.call.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt, duration, notes: req.body.notes || call.notes },
      include: { category: true, agent: { select: { id: true, name: true } } },
    });

    await logAudit('CALL_COMPLETED', req.user!.id, call.id, `Duration: ${duration}s`);
    res.json({ ...updated, categoryName: updated.category.name, agentName: updated.agent.name });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to complete call', statusCode: 500 });
  }
});

// POST /api/calls/:id/transfer
callsRouter.post('/:id/transfer', requirePermission('calls:transfer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { transferredTo, transferNotes } = req.body;
    if (!transferredTo) {
      res.status(400).json({ error: 'Bad Request', message: 'transferredTo is required', statusCode: 400 });
      return;
    }

    const id = req.params.id as string;
    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }
    if (call.status === 'COMPLETED' || call.status === 'MISSED') {
      res.status(400).json({ error: 'Bad Request', message: `Cannot transfer call in status: ${call.status}`, statusCode: 400 });
      return;
    }

    const updated = await prisma.call.update({
      where: { id },
      data: { status: 'TRANSFERRED', transferredToId: transferredTo, transferNotes },
      include: { category: true, agent: { select: { id: true, name: true } } },
    });

    await logAudit('CALL_TRANSFERRED', req.user!.id, call.id, `Transferred to ${transferredTo}`);
    res.json({ ...updated, categoryName: updated.category.name, agentName: updated.agent.name });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to transfer call', statusCode: 500 });
  }
});
