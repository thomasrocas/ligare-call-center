import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { type Role, type Permission, hasPermission } from '@ligare/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'ligare-dev-secret';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  team: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token', statusCode: 401 });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token', statusCode: 401 });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated', statusCode: 401 });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: 'Forbidden', message: `Requires permission: ${permission}`, statusCode: 403 });
      return;
    }
    next();
  };
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}
