import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../lib/ApiError.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and replaces req[source] with the parsed, typed value.
 * Usage: router.post('/', validate(MySchema), handler)
 */
export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(ApiError.badRequest('Validation failed', result.error.flatten()));
      return;
    }
    // Store parsed value for the handler to read in a typed way.
    (req as Request & { valid?: unknown }).valid = result.data;
    next();
  };
}

/** Reads the validated payload set by `validate`. */
export function valid<T>(req: Request): T {
  return (req as Request & { valid: T }).valid;
}
