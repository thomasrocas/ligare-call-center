import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { callsRouter } from './routes/calls';
import { dashboardRouter } from './routes/dashboard';
import { exportsRouter } from './routes/exports';
import { usersRouter } from './routes/users';
import { categoriesRouter } from './routes/categories';
import { errorHandler } from './middleware/error';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/calls', callsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🔧 Ligare API running on http://localhost:${PORT}`);
  });
}

export { app };
