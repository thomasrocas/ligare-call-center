import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';
import { ROLES, TEAMS } from '@ligare/shared';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(requirePermission('users:manage'));

// GET /api/users
usersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = req.query.role as string | undefined;
    const team = req.query.team as string | undefined;
    const active = req.query.active as string | undefined;
    const where: any = {};
    if (role) where.role = role;
    if (team) where.team = team;
    if (active !== undefined) where.active = active === 'true';

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, team: true, active: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch users', statusCode: 500 });
  }
});

// POST /api/users
usersRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, team } = req.body;
    if (!email || !password || !name || !role || !team) {
      res.status(400).json({ error: 'Bad Request', message: 'All fields required', statusCode: 400 });
      return;
    }
    if (!ROLES.includes(role)) {
      res.status(400).json({ error: 'Bad Request', message: `Invalid role. Must be one of: ${ROLES.join(', ')}`, statusCode: 400 });
      return;
    }
    if (!TEAMS.includes(team)) {
      res.status(400).json({ error: 'Bad Request', message: `Invalid team. Must be one of: ${TEAMS.join(', ')}`, statusCode: 400 });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'User with this email already exists', statusCode: 409 });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role, team },
      select: { id: true, email: true, name: true, role: true, team: true, active: true, createdAt: true, updatedAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create user', statusCode: 500 });
  }
});

// PATCH /api/users/:id
usersRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, role, team, active } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        res.status(400).json({ error: 'Bad Request', message: `Invalid role`, statusCode: 400 });
        return;
      }
      data.role = role;
    }
    if (team !== undefined) {
      if (!TEAMS.includes(team)) {
        res.status(400).json({ error: 'Bad Request', message: `Invalid team`, statusCode: 400 });
        return;
      }
      data.team = team;
    }
    if (active !== undefined) data.active = active;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, team: true, active: true, createdAt: true, updatedAt: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user', statusCode: 500 });
  }
});

// DELETE /api/users/:id (soft delete — sets active=false)
usersRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Bad Request', message: 'Cannot deactivate yourself', statusCode: 400 });
      return;
    }
    await prisma.user.update({ where: { id }, data: { active: false } });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to deactivate user', statusCode: 500 });
  }
});
