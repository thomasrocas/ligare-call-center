import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

export const followupsRouter = Router();

followupsRouter.use(authenticate);

// GET /api/followups — list all calls with pending follow-ups
followupsRouter.get('/', requirePermission('followups:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.query['agentId'] as string | undefined;
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;

    const where: any = {
      followUpDate: { not: null },
      status: { notIn: ['COMPLETED', 'MISSED'] },
    };

    if (agentId) where.followUpAssignedTo = agentId;
    else if (req.user!.role === 'AGENT') where.followUpAssignedTo = req.user!.id;

    if (from || to) {
      where.followUpDate = {};
      if (from) where.followUpDate.gte = new Date(from);
      if (to) where.followUpDate.lte = new Date(to);
    }

    const followUps = await prisma.call.findMany({
      where,
      include: {
        category: true,
        agent: { select: { id: true, name: true } },
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        followUpAgent: { select: { id: true, name: true } },
      },
      orderBy: { followUpDate: 'asc' },
    });

    res.json(followUps.map((c: any) => ({
      ...c,
      categoryName: c.category.name,
      agentName: c.agent.name,
      followUpAgentName: c.followUpAgent?.name,
    })));
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch follow-ups', statusCode: 500 });
  }
});

// GET /api/followups/overdue — follow-ups past due date
followupsRouter.get('/overdue', requirePermission('followups:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const where: any = {
      followUpDate: { not: null, lt: new Date() },
      status: { notIn: ['COMPLETED', 'MISSED'] },
    };

    if (req.user!.role === 'AGENT') where.followUpAssignedTo = req.user!.id;

    const overdue = await prisma.call.findMany({
      where,
      include: {
        category: true,
        agent: { select: { id: true, name: true } },
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        followUpAgent: { select: { id: true, name: true } },
      },
      orderBy: { followUpDate: 'asc' },
    });

    res.json(overdue.map((c: any) => ({
      ...c,
      categoryName: c.category.name,
      agentName: c.agent.name,
      followUpAgentName: c.followUpAgent?.name,
    })));
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch overdue follow-ups', statusCode: 500 });
  }
});

// POST /api/followups/:callId — schedule or update a follow-up for a call
followupsRouter.post('/:callId', requirePermission('followups:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const callId = req.params['callId'] as string;
    const { followUpDate, followUpAssignedTo } = req.body;

    if (!followUpDate) {
      res.status(400).json({ error: 'Bad Request', message: 'followUpDate is required', statusCode: 400 });
      return;
    }

    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }

    const updated = await prisma.call.update({
      where: { id: callId },
      data: {
        followUpDate: new Date(followUpDate),
        followUpAssignedTo: (followUpAssignedTo as string | undefined) || req.user!.id,
      },
      include: {
        category: true,
        agent: { select: { id: true, name: true } },
        followUpAgent: { select: { id: true, name: true } },
      },
    }) as any;

    await logAudit('FOLLOWUP_SCHEDULED', req.user!.id, callId, `Follow-up scheduled for ${followUpDate}`);

    res.json({
      ...updated,
      categoryName: updated.category.name,
      agentName: updated.agent.name,
      followUpAgentName: updated.followUpAgent?.name,
    });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to schedule follow-up', statusCode: 500 });
  }
});

// DELETE /api/followups/:callId — remove follow-up from call
followupsRouter.delete('/:callId', requirePermission('followups:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const callId = req.params['callId'] as string;
    await prisma.call.update({
      where: { id: callId },
      data: { followUpDate: null, followUpAssignedTo: null },
    });
    await logAudit('FOLLOWUP_REMOVED', req.user!.id, callId, 'Follow-up removed');
    res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove follow-up', statusCode: 500 });
  }
});
