import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticate, generateToken, type AuthUser } from '../middleware/auth';
import type { Role } from '@ligare/shared';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Bad Request', message: 'Email and password required', statusCode: 400 });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 });
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      team: user.team,
    };

    const token = generateToken(authUser);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, team: user.team, active: user.active },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Login failed', statusCode: 500 });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, (req: Request, res: Response) => {
  res.json(req.user);
});
