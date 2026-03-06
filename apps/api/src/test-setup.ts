// Set env vars at module scope BEFORE any app imports resolve
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ligare-dev-secret-change-in-production';
process.env.DATABASE_URL = 'file:./test.db';
