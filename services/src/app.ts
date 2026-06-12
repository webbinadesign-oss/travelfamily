import express, { type Application } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Webbina Travel AI — services', version: '0.1.0' });
  });

  app.use('/api', apiRouter);

  // 404 + centralized error handling (must be last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
