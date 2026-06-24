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

  // CORS — a shared demo is opened from downloaded files (origin "null"),
  // hosted pages, and phones. Reflect ANY origin so the Prototype/Console can
  // always reach the API. Secrets stay server-side; memory needs a Bearer token,
  // so allowing any origin is safe here. (We intentionally ignore CORS_ORIGINS
  // to avoid silently blocking the family demo.)
  app.use(cors({ origin: true }));
  app.options('*', cors({ origin: true })); // answer all preflight requests
  app.use(express.json({ limit: '1mb' }));

  // Static media (intro video, etc.) — served from services/public with CORS,
  // so the hosted Prototype can load + canvas-key the video from anywhere.
  // dist/app.js → ../public when built; src/app.ts → ../public in dev.
  const publicDir = path.resolve(__dirname, '../public');
  app.use('/media', express.static(publicDir, {
    maxAge: '7d',
    setHeaders: (res) => {
      // Force permissive CORS so the browser can canvas-key the video (transparency).
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Webbina Travel AI — services', version: '0.1.0' });
  });

  // Serve the bundled Prototype over HTTPS so the family demo runs in a SECURE
  // context — required for the microphone (getUserMedia) and to avoid the
  // content://-file errors. Drop the bundled single-file at public/app.html.
  app.get('/app', (_req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.sendFile(path.join(publicDir, 'app.html'));
  });

  app.use('/api', apiRouter);

  // 404 + centralized error handling (must be last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
