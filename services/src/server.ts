import { createApp } from './app.js';
import { env, validateEnv } from './config/env.js';
import { logger } from './lib/logger.js';

validateEnv(logger.warn);

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Webbina services listening on http://localhost:${env.port}`);
  logger.info(`Environment: ${env.nodeEnv} · Amadeus: ${env.amadeusEnv}`);
});

// Graceful shutdown.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    logger.info(`${sig} received — shutting down.`);
    server.close(() => process.exit(0));
  });
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
