import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'file:./test.db';
});
