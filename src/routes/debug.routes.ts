import { Router } from 'express';
import { z } from 'zod';
import { echo } from '../controllers/debug.controller';
import { validateRequest } from '../middleware/validation';

/**
 * Zod schema for echo endpoint request body.
 */
const echoBodySchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

/**
 * Creates and configures the debug routes router.
 *
 * Routes:
 * - POST /debug/echo - Echoes back the received message (demonstrates validation)
 *
 * @returns Configured Express Router with debug routes
 */
export function createDebugRouter(): Router {
  const router = Router();

  /**
   * POST /debug/echo
   * Echoes back the received message.
   * Demonstrates Zod validation middleware pattern.
   */
  router.post(
    '/echo',
    validateRequest({ body: echoBodySchema }),
    echo
  );

  return router;
}

/**
 * Registers debug routes on an Express application.
 *
 * @param app - Express application or router to register routes on
 */
export function registerDebugRoutes(app: Router): void {
  const debugRouter = createDebugRouter();
  app.use('/debug', debugRouter);
}

// Export schemas for testing
export { echoBodySchema };
