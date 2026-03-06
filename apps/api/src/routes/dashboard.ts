import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

// GET /api/dashboard
dashboardRouter.get('/', requirePermission('dashboard:view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const team = req.query.team as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const where: any = {};
    if (team) where.team = team;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const calls = await prisma.call.findMany({
      where,
      include: { category: true, agent: { select: { id: true, name: true } } },
    });

    const totalCalls = calls.length;
    const activeCalls = calls.filter((c) => c.status === 'IN_PROGRESS').length;
    const completedCalls = calls.filter((c) => c.status === 'COMPLETED').length;
    const missedCalls = calls.filter((c) => c.status === 'MISSED').length;

    const completedWithDuration = calls.filter((c) => c.status === 'COMPLETED' && c.duration);
    const avgDuration = completedWithDuration.length
      ? Math.round(completedWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / completedWithDuration.length)
      : 0;

    // Calls by team
    const callsByTeam: Record<string, number> = {};
    calls.forEach((c) => { callsByTeam[c.team] = (callsByTeam[c.team] || 0) + 1; });

    // Calls by priority
    const callsByPriority: Record<string, number> = {};
    calls.forEach((c) => { callsByPriority[c.priority] = (callsByPriority[c.priority] || 0) + 1; });

    // Calls by category
    const callsByCategory: Record<string, number> = {};
    calls.forEach((c) => { callsByCategory[c.category.name] = (callsByCategory[c.category.name] || 0) + 1; });

    // Calls by status
    const callsByStatus: Record<string, number> = {};
    calls.forEach((c) => { callsByStatus[c.status] = (callsByStatus[c.status] || 0) + 1; });

    // Calls by hour
    const hourMap: Record<number, number> = {};
    calls.forEach((c) => {
      const hour = new Date(c.createdAt).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });
    const callsByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap[i] || 0 }));

    // Top agents
    const agentMap = new Map<string, { agentName: string; count: number; totalDuration: number }>();
    calls.forEach((c) => {
      const existing = agentMap.get(c.agentId) || { agentName: c.agent.name, count: 0, totalDuration: 0 };
      existing.count++;
      if (c.duration) existing.totalDuration += c.duration;
      agentMap.set(c.agentId, existing);
    });
    const topAgents = Array.from(agentMap.entries())
      .map(([agentId, data]) => ({
        agentId,
        agentName: data.agentName,
        count: data.count,
        avgDuration: data.count ? Math.round(data.totalDuration / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calls by disposition
    const callsByDisposition: Record<string, number> = {};
    calls.forEach((c) => {
      if (c.disposition) {
        callsByDisposition[c.disposition] = (callsByDisposition[c.disposition] || 0) + 1;
      }
    });

    // Follow-ups pending
    const pendingFollowUps = await prisma.call.count({
      where: { followUpDate: { not: null }, status: { notIn: ['COMPLETED', 'MISSED'] } },
    });
    const overdueFollowUps = await prisma.call.count({
      where: { followUpDate: { not: null, lt: new Date() }, status: { notIn: ['COMPLETED', 'MISSED'] } },
    });

    res.json({
      totalCalls,
      activeCalls,
      completedCalls,
      missedCalls,
      avgDuration,
      callsByTeam,
      callsByPriority,
      callsByCategory,
      callsByStatus,
      callsByHour,
      topAgents,
      callsByDisposition,
      pendingFollowUps,
      overdueFollowUps,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch dashboard', statusCode: 500 });
  }
});
