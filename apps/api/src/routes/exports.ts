import { Router, Request, Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const exportsRouter = Router();

exportsRouter.use(authenticate);

// GET /api/exports/calls.csv
exportsRouter.get('/calls.csv', requirePermission('exports:csv'), async (req: Request, res: Response): Promise<void> => {
  try {
    const team = req.query.team as string | undefined;
    const status = req.query.status as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const where: any = {};
    if (team) where.team = team;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const calls = await prisma.call.findMany({
      where,
      include: { category: true, agent: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const rows = calls.map((c) => ({
      ID: c.id,
      'Caller Name': c.callerName,
      'Caller Phone': c.callerPhone,
      Category: c.category.name,
      Priority: c.priority,
      Status: c.status,
      Team: c.team,
      Agent: c.agent.name,
      Notes: c.notes || '',
      'Started At': c.startedAt?.toISOString() || '',
      'Completed At': c.completedAt?.toISOString() || '',
      'Duration (s)': c.duration || '',
      'Created At': c.createdAt.toISOString(),
    }));

    const csv = stringify(rows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="calls-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to export calls', statusCode: 500 });
  }
});
