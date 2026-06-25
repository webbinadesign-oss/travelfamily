import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../lib/ApiError.js';
import { logger } from '../lib/logger.js';

/** 404 for unmatched routes. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}

/** Central error handler — always emits ApiErrorBody JSON. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const apiErr =
    err instanceof ApiError
      ? err
      : new ApiError(500, 'internal_error', 'Something went wrong.');

  if (apiErr.status >= 500) {
    logger.error(apiErr.message, { code: apiErr.code, details: apiErr.details });
  } else {
    logger.warn(apiErr.message, { code: apiErr.code });
  }

  res.status(apiErr.status).json(apiErr.toBody());
}
