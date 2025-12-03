import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ErrorCodes,
  ErrorCodeToHttpStatus,
  type ErrorCode,
} from '../types/http';
import { buildErrorResponse, createMetaFromRequestId } from '../utils/response';
import { logger } from './logger';

/**
 * Global error handler middleware.
 *
 * Catches all unhandled errors and normalizes them to a consistent JSON response format.
 *
 * Response format:
 * ```json
 * {
 *   "data": null,
 *   "error": {
 *     "code": "INTERNAL_ERROR",
 *     "message": "Unexpected error",
 *     "details": {}
 *   },
 *   "meta": {
 *     "requestId": "<uuid>",
 *     "timestamp": "<ISO8601>"
 *   }
 * }
 * ```
 *
 * Features:
 * - Handles AppError instances with custom codes and status
 * - Handles unknown errors safely (no sensitive data leak)
 * - Includes requestId for distributed tracing
 * - Logs errors with full context for debugging
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';
  const meta = createMetaFromRequestId(requestId);

  // Log the error with full context
  logger.error(
    {
      err,
      requestId,
      method: req.method,
      path: req.path,
      stack: err.stack,
    },
    `Error handling request: ${err.message}`
  );

  // Handle known application errors
  if (err instanceof AppError) {
    const response = buildErrorResponse(
      {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta
    );

    res.status(err.httpStatus).json(response);
    return;
  }

  // Handle unknown errors - don't expose internal details
  const response = buildErrorResponse(
    {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Unexpected error',
      details: {},
    },
    meta
  );

  res.status(500).json(response);
}

/**
 * Middleware to handle 404 Not Found errors.
 * Should be registered after all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.requestId || 'unknown';
  const meta = createMetaFromRequestId(requestId);

  const response = buildErrorResponse(
    {
      code: ErrorCodes.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
      details: { method: req.method, path: req.path },
    },
    meta
  );

  res.status(404).json(response);
}

// Export for potential future use
export { ErrorCodeToHttpStatus };
