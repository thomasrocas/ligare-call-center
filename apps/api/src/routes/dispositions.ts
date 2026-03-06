import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const dispositionsRouter = Router();

dispositionsRouter.use(authenticate);

// GET /api/dispositions — list all active disposition templates
dispositionsRouter.get('/', requirePermission('dispositions:read'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await prisma.dispositionTemplate.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(templates);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch disposition templates', statusCode: 500 });
  }
});

// GET /api/dispositions/all — includes inactive (admin only)
dispositionsRouter.get('/all', requirePermission('dispositions:manage'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await prisma.dispositionTemplate.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(templates);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch disposition templates', statusCode: 500 });
  }
});

// GET /api/dispositions/:id
dispositionsRouter.get('/:id', requirePermission('dispositions:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await prisma.dispositionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) {
      res.status(404).json({ error: 'Not Found', message: 'Disposition template not found', statusCode: 404 });
      return;
    }
    res.json(template);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch disposition template', statusCode: 500 });
  }
});

// POST /api/dispositions — create
dispositionsRouter.post('/', requirePermission('dispositions:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, category } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Bad Request', message: 'name is required', statusCode: 400 });
      return;
    }
    const template = await prisma.dispositionTemplate.create({
      data: { name, description, category },
    });
    res.status(201).json(template);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'Conflict', message: 'Disposition template name already exists', statusCode: 409 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create disposition template', statusCode: 500 });
  }
});

// PATCH /api/dispositions/:id — update
dispositionsRouter.patch('/:id', requirePermission('dispositions:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, category, active } = req.body;
    const template = await prisma.dispositionTemplate.update({
      where: { id: req.params.id },
      data: { name, description, category, active },
    });
    res.json(template);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'Disposition template not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update disposition template', statusCode: 500 });
  }
});

// DELETE /api/dispositions/:id — soft delete (set active=false)
dispositionsRouter.delete('/:id', requirePermission('dispositions:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.dispositionTemplate.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'Disposition template not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete disposition template', statusCode: 500 });
  }
});
