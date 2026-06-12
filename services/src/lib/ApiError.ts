/**
 * Normalized API error. Every failure in the app becomes one of these,
 * so the error handler can emit a consistent JSON shape.
 */
export interface ApiErrorBody {
  error: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        status: this.status,
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, 'unauthorized', message);
  }
  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, 'forbidden', message);
  }
  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, 'not_found', message);
  }
  static tooManyRequests(message = 'Rate limited'): ApiError {
    return new ApiError(429, 'rate_limited', message);
  }
  static serviceUnavailable(code: string, message: string): ApiError {
    return new ApiError(503, code, message);
  }
  /** An upstream provider (Amadeus/OpenAI/...) failed. */
  static upstream(provider: string, status: number, details?: unknown): ApiError {
    return new ApiError(
      status >= 500 ? 502 : status,
      `${provider}_error`,
      `Upstream provider "${provider}" returned an error.`,
      details,
    );
  }
}
