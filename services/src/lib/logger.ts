/** Tiny structured logger (swap for pino/winston in production). */
type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta && Object.keys(meta).length) fn(line, meta);
  else fn(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) =>
    process.env['NODE_ENV'] !== 'production' && emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
