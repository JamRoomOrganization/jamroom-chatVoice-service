import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Header name for request ID propagation.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Extends Express Request to include requestId.
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Middleware that ensures every request has a unique identifier.
 *
 * - If the `x-request-id` header is present, it will be reused.
 * - If not present, a new UUID v4 will be generated.
 *
 * The requestId is attached to:
 * - `req.requestId` for access in controllers and other middleware
 * - Response will include it in the `meta` object
 *
 * This enables distributed tracing across microservices.
 */
export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const existingId = req.headers[REQUEST_ID_HEADER];

  // Use existing ID if valid string, otherwise generate new one
  const requestId =
    typeof existingId === 'string' && existingId.trim().length > 0
      ? existingId.trim()
      : uuidv4();

  req.requestId = requestId;

  next();
}
