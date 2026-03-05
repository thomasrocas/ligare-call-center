import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

// GET /api/categories (all authenticated users can list)
categoriesRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch categories', statusCode: 500 });
  }
});

// POST /api/categories
categoriesRouter.post('/', requirePermission('categories:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Bad Request', message: 'Name is required', statusCode: 400 });
      return;
    }
    const category = await prisma.category.create({ data: { name, description } });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create category', statusCode: 500 });
  }
});

// PATCH /api/categories/:id
categoriesRouter.patch('/:id', requirePermission('categories:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, active } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (active !== undefined) data.active = active;

    const id = req.params.id as string;
    const category = await prisma.category.update({ where: { id }, data });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update category', statusCode: 500 });
  }
});

// DELETE /api/categories/:id (soft delete)
categoriesRouter.delete('/:id', requirePermission('categories:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.category.update({ where: { id }, data: { active: false } });
    res.json({ message: 'Category deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to deactivate category', statusCode: 500 });
  }
});
