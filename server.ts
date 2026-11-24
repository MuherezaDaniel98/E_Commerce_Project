import 'dotenv/config';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ensureSeeded } from './src/db/seed.ts';
import { adminRouter } from './src/server/admin.ts';
import { authRouter } from './src/server/auth.ts';
import { catalogRouter } from './src/server/catalog.ts';
import { ordersRouter } from './src/server/orders.ts';

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please wait a few minutes.' },
});

const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'MarketSphere — Active Supermarket Kabale' });
});

// Lazy idempotent database seeding on first API call (no eager startup DB probes)
app.use('/api', async (_req, _res, next) => {
  await ensureSeeded();
  next();
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api', catalogRouter);
app.use('/api', ordersRouter);
app.use('/api/admin', adminRouter);

// API 404 handler
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Centralized error middleware
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) {
    console.error('Server error:', err);
  }
  res.status(status).json({
    error: status >= 500 ? 'An internal server error occurred. Please try again.' : err.message,
  });
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`MarketSphere server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
