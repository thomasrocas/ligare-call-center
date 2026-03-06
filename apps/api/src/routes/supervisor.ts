import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';
import { getConnectedCount, getSupervisorSnapshot } from '../ws/wsServer';

export const supervisorRouter = Router();

supervisorRouter.use(authenticate);

// GET /api/supervisor/board — live call board
supervisorRouter.get('/board', requirePermission('supervisor:board'), async (req: Request, res: Response): Promise<void> => {
  try {
    const team = req.query.team as string | undefined;
    const where: any = { status: { in: ['QUEUED', 'IN_PROGRESS', 'TRANSFERRED'] } };
    if (team) where.team = team;

    const activeCalls = await prisma.call.findMany({
      where,
      include: {
        category: { select: { name: true } },
        agent: { select: { id: true, name: true, team: true } },
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    // Group by status
    const queued = activeCalls.filter(c => c.status === 'QUEUED');
    const inProgress = activeCalls.filter(c => c.status === 'IN_PROGRESS');
    const transferred = activeCalls.filter(c => c.status === 'TRANSFERRED');

    // Agent workload
    const agentWorkload = new Map<string, { agentName: string; team: string; activeCalls: number; longestWait: number }>();
    for (const call of activeCalls) {
      const key = call.agentId;
      const existing = agentWorkload.get(key) || {
        agentName: call.agent.name,
        team: call.agent.team,
        activeCalls: 0,
        longestWait: 0,
      };
      existing.activeCalls++;
      const waitSeconds = Math.round((Date.now() - call.createdAt.getTime()) / 1000);
      if (waitSeconds > existing.longestWait) existing.longestWait = waitSeconds;
      agentWorkload.set(key, existing);
    }

    res.json({
      summary: {
        totalActive: activeCalls.length,
        queued: queued.length,
        inProgress: inProgress.length,
        transferred: transferred.length,
        connectedAgents: getConnectedCount(),
      },
      queued: queued.map(c => ({
        ...c,
        categoryName: c.category.name,
        agentName: c.agent.name,
        waitSeconds: Math.round((Date.now() - c.createdAt.getTime()) / 1000),
      })),
      inProgress: inProgress.map(c => ({
        ...c,
        categoryName: c.category.name,
        agentName: c.agent.name,
        durationSeconds: c.startedAt ? Math.round((Date.now() - c.startedAt.getTime()) / 1000) : 0,
      })),
      transferred: transferred.map(c => ({
        ...c,
        categoryName: c.category.name,
        agentName: c.agent.name,
      })),
      agentWorkload: Array.from(agentWorkload.entries()).map(([agentId, data]) => ({ agentId, ...data })),
      wsSnapshot: getSupervisorSnapshot(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch supervisor board', statusCode: 500 });
  }
});

// GET /api/supervisor/metrics — queue metrics
supervisorRouter.get('/metrics', requirePermission('supervisor:board'), async (req: Request, res: Response): Promise<void> => {
  try {
    const team = req.query.team as string | undefined;
    const last1h = new Date(Date.now() - 3600000);
    const last24h = new Date(Date.now() - 86400000);

    const where: any = {};
    if (team) where.team = team;

    const [
      totalToday,
      completedToday,
      avgDurationToday,
      pendingQueue,
      escalations,
    ] = await Promise.all([
      prisma.call.count({ where: { ...where, createdAt: { gte: last24h } } }),
      prisma.call.count({ where: { ...where, status: 'COMPLETED', completedAt: { gte: last24h } } }),
      prisma.call.aggregate({
        where: { ...where, status: 'COMPLETED', completedAt: { gte: last24h }, duration: { not: null } },
        _avg: { duration: true },
      }),
      prisma.call.count({ where: { ...where, status: 'QUEUED' } }),
      prisma.call.count({ where: { ...where, priority: 'URGENT', status: { in: ['QUEUED', 'IN_PROGRESS'] } } }),
    ]);

    // Calls per hour for last 24h
    const recentCalls = await prisma.call.findMany({
      where: { ...where, createdAt: { gte: last24h } },
      select: { createdAt: true, status: true },
    });

    const hourMap: Record<number, number> = {};
    recentCalls.forEach(c => {
      const hour = new Date(c.createdAt).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });
    const callsPerHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap[i] || 0 }));

    res.json({
      totalToday,
      completedToday,
      pendingQueue,
      escalations,
      avgDurationSeconds: Math.round(avgDurationToday._avg.duration || 0),
      callsPerHour,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch queue metrics', statusCode: 500 });
  }
});

// GET /api/supervisor/agents — agent status list
supervisorRouter.get('/agents', requirePermission('supervisor:board'), async (req: Request, res: Response): Promise<void> => {
  try {
    const team = req.query.team as string | undefined;
    const where: any = { active: true, role: { in: ['AGENT', 'SUPERVISOR'] } };
    if (team) where.team = team;

    const agents = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        role: true,
        team: true,
        calls: {
          where: { status: { in: ['QUEUED', 'IN_PROGRESS'] } },
          select: { id: true, status: true, priority: true, createdAt: true },
        },
      },
    });

    const wsSnapshot = getSupervisorSnapshot();
    const onlineIds = new Set(wsSnapshot.connectedAgents.map(a => a.userId));

    res.json(agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      team: a.team,
      online: onlineIds.has(a.id),
      activeCalls: a.calls.length,
      callDetails: a.calls,
    })));
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch agent statuses', statusCode: 500 });
  }
});
