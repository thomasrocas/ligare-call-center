import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const scriptsRouter = Router();

scriptsRouter.use(authenticate);

// GET /api/scripts — list active scripts
scriptsRouter.get('/', requirePermission('scripts:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.query['category'] as string | undefined;
    const where: any = { active: true };
    if (category) where.category = category;

    const scripts = await prisma.callScript.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(scripts);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch call scripts', statusCode: 500 });
  }
});

// GET /api/scripts/all — includes inactive
scriptsRouter.get('/all', requirePermission('scripts:manage'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const scripts = await prisma.callScript.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(scripts);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch call scripts', statusCode: 500 });
  }
});

// GET /api/scripts/:id
scriptsRouter.get('/:id', requirePermission('scripts:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const script = await prisma.callScript.findUnique({ where: { id } });
    if (!script) {
      res.status(404).json({ error: 'Not Found', message: 'Call script not found', statusCode: 404 });
      return;
    }
    res.json(script);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch call script', statusCode: 500 });
  }
});

// POST /api/scripts — create
scriptsRouter.post('/', requirePermission('scripts:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category, content } = req.body;
    if (!name || !category || !content) {
      res.status(400).json({ error: 'Bad Request', message: 'name, category, and content are required', statusCode: 400 });
      return;
    }
    const script = await prisma.callScript.create({
      data: { name, category, content },
    });
    res.status(201).json(script);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create call script', statusCode: 500 });
  }
});

// PATCH /api/scripts/:id — update
scriptsRouter.patch('/:id', requirePermission('scripts:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { name, category, content, active } = req.body;
    const script = await prisma.callScript.update({
      where: { id },
      data: { name, category, content, active },
    });
    res.json(script);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'Call script not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update call script', statusCode: 500 });
  }
});

// DELETE /api/scripts/:id — soft delete
scriptsRouter.delete('/:id', requirePermission('scripts:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    await prisma.callScript.update({
      where: { id },
      data: { active: false },
    });
    res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'Call script not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete call script', statusCode: 500 });
  }
});
