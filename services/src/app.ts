import express, { type Application } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp(): Application {
  const app = express();

  // CORS — permissive by default (testing phase). If CORS_ORIGINS is set,
  // restrict to that allow-list; otherwise reflect ANY origin so the hosted
  // Console / Prototype can connect from anywhere.
  const allowList = env.corsOrigins;
  app.use(
    cors(
      allowList.length
        ? { origin: allowList, credentials: true }
        : { origin: true }, // reflect any origin, no credentials → works everywhere
    ),
  );
  app.options('*', cors()); // answer all preflight requests
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
