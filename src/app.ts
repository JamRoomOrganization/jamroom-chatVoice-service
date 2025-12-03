import express, { Express } from 'express';
import {
  requestIdMiddleware,
  httpLoggerMiddleware,
  errorHandler,
  notFoundHandler,
} from './middleware';
import { registerRoutes } from './routes';

/**
 * Creates and configures the Express application.
 *
 * This factory function builds the app with all middleware and routes
 * registered in the correct order. It does NOT start the server,
 * making it ideal for testing.
 *
 * Middleware order:
 * 1. requestId - Assigns/propagates request trace ID
 * 2. httpLogger - Logs incoming requests
 * 3. JSON parser - Parses JSON request bodies
 * 4. Routes - Application endpoints
 * 5. notFoundHandler - Handles 404 for unmatched routes
 * 6. errorHandler - Global error handling (must be last)
 *
 * @returns Configured Express application instance
 *
 * @example
 * ```typescript
 * // For testing
 * import { createApp } from './app';
 * import request from 'supertest';
 *
 * const app = createApp();
 * const response = await request(app).get('/healthz');
 * ```
 */
export function createApp(): Express {
  const app = express();

  // =========================================================================
  // PRE-ROUTE MIDDLEWARE
  // Order matters! These run before route handlers
  // =========================================================================

  // 1. Request ID middleware - must be first to ensure requestId is available
  app.use(requestIdMiddleware);

  // 2. HTTP request logging - logs all incoming requests with requestId
  app.use(httpLoggerMiddleware);

  // 3. Body parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // =========================================================================
  // ROUTES
  // =========================================================================

  // Register all application routes
  registerRoutes(app);

  // =========================================================================
  // POST-ROUTE MIDDLEWARE
  // These run after route handlers (error handling)
  // =========================================================================

  // 4. 404 handler - catches requests that didn't match any route
  app.use(notFoundHandler);

  // 5. Global error handler - must be LAST middleware
  app.use(errorHandler);

  return app;
}
