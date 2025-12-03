/**
 * @module internalAuth
 * @description Middleware for internal service-to-service authentication.
 *
 * This middleware validates requests from internal services (e.g., sync-service)
 * using a shared API key passed in the x-internal-api-key header.
 *
 * Used for protecting moderation endpoints that should only be called by
 * other trusted services, not directly by clients.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from '../types/http';
import { logger } from './logger';

/**
 * Header name for internal API key.
 */
export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Middleware that validates the internal API key.
 *
 * Checks the x-internal-api-key header against the configured INTERNAL_API_KEY.
 * If the key is missing or invalid, throws an UNAUTHORIZED error.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @throws AppError.unauthorized if API key is missing or invalid
 *
 * @example
 * ```typescript
 * // Protect a route with internal API key authentication
 * router.post('/internal/moderation/mute',
 *   requireInternalApiKey,
 *   muteController
 * );
 * ```
 */
export function requireInternalApiKey(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Check if internal API key is configured
  if (!config.internalApiKey) {
    logger.warn(
      { requestId: req.requestId },
      'Internal API key not configured - rejecting request'
    );
    throw AppError.unauthorized('INTERNAL_API_KEY_NOT_CONFIGURED', {
      message: 'Internal API authentication is not configured',
    });
  }

  // Get the API key from the header
  const providedKey = req.headers[INTERNAL_API_KEY_HEADER];

  // Validate header is present
  if (!providedKey) {
    logger.warn(
      { requestId: req.requestId, path: req.path },
      'Missing internal API key header'
    );
    throw AppError.unauthorized('MISSING_INTERNAL_API_KEY', {
      message: `Missing required header: ${INTERNAL_API_KEY_HEADER}`,
    });
  }

  // Validate header is a string
  if (typeof providedKey !== 'string') {
    logger.warn(
      { requestId: req.requestId, path: req.path },
      'Invalid internal API key header type'
    );
    throw AppError.unauthorized('INVALID_INTERNAL_API_KEY', {
      message: 'Invalid API key format',
    });
  }

  // Validate the key matches
  if (providedKey !== config.internalApiKey) {
    logger.warn(
      { requestId: req.requestId, path: req.path },
      'Invalid internal API key provided'
    );
    throw AppError.unauthorized('INVALID_INTERNAL_API_KEY', {
      message: 'Invalid internal API key',
    });
  }

  // Key is valid - proceed
  logger.debug(
    { requestId: req.requestId, path: req.path },
    'Internal API key validated successfully'
  );

  next();
}
