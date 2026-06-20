import express, { type Application } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // Static media (intro video, etc.) — served from services/public with CORS,
  // so the hosted Prototype can load + canvas-key the video from anywhere.
  // dist/app.js → ../public when built; src/app.ts → ../public in dev.
  const publicDir = path.resolve(__dirname, '../public');
  app.use('/media', express.static(publicDir, { maxAge: '7d' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Webbina Travel AI — services', version: '0.1.0' });
  });

  app.use('/api', apiRouter);

  // 404 + centralized error handling (must be last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
