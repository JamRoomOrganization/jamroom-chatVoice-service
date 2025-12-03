/**
 * @module voiceSession.routes
 * @description Express routes for VoiceSession management.
 *
 * Base path: /api/v1/voice
 *
 * Routes:
 * - POST   /sessions                - Create/upsert voice session
 * - GET    /sessions/:sessionId     - Get voice session by ID
 * - DELETE /sessions/:sessionId     - Delete voice session
 * - GET    /rooms/:roomId/sessions  - List sessions in room
 */

import { Router } from 'express';
import { validateRequest } from '../middleware/validation';
import {
  createVoiceSession,
  deleteVoiceSession,
  listVoiceSessionsByRoom,
  getVoiceSession,
} from '../controllers/voiceSession.controller';
import {
  CreateVoiceSessionSchema,
  DeleteVoiceSessionParamsSchema,
  ListVoiceSessionsParamsSchema,
} from '../controllers/voiceSession.schemas';

/**
 * Creates and configures the voice session routes router.
 *
 * All routes follow the standard response wrapper pattern:
 * { data, error, meta }
 *
 * Except DELETE which returns 204 No Content.
 *
 * @returns Configured Express Router with voice session routes
 */
export function createVoiceRouter(): Router {
  const router = Router();

  /**
   * POST /sessions
   * Creates a new voice session or updates existing one (upsert).
   *
   * Request body:
   * - roomId: string (required) - The room to join
   * - userId: string (required) - The user joining
   * - username: string (optional) - Display name
   * - canPublishAudio: boolean (default: true) - Can publish audio
   * - canSubscribe: boolean (default: true) - Can subscribe to others
   *
   * Response: 201 Created (new) or 200 OK (update)
   */
  router.post(
    '/sessions',
    validateRequest({ body: CreateVoiceSessionSchema }),
    createVoiceSession
  );

  /**
   * GET /sessions/:sessionId
   * Retrieves a voice session by its ID.
   *
   * Response: 200 OK or 404 Not Found
   */
  router.get(
    '/sessions/:sessionId',
    validateRequest({ params: DeleteVoiceSessionParamsSchema }),
    getVoiceSession
  );

  /**
   * DELETE /sessions/:sessionId
   * Deletes a voice session.
   *
   * Response: 204 No Content or 404 Not Found
   */
  router.delete(
    '/sessions/:sessionId',
    validateRequest({ params: DeleteVoiceSessionParamsSchema }),
    deleteVoiceSession
  );

  /**
   * GET /rooms/:roomId/sessions
   * Lists all voice sessions in a room.
   *
   * Response: 200 OK with { sessions: [], count: number }
   */
  router.get(
    '/rooms/:roomId/sessions',
    validateRequest({ params: ListVoiceSessionsParamsSchema }),
    listVoiceSessionsByRoom
  );

  return router;
}

/**
 * Registers voice session routes on an Express application.
 *
 * @param app - Express application or router to register routes on
 */
export function registerVoiceRoutes(app: Router): void {
  const voiceRouter = createVoiceRouter();
  app.use('/api/v1/voice', voiceRouter);
}

// Export schemas for testing
export {
  CreateVoiceSessionSchema,
  DeleteVoiceSessionParamsSchema,
  ListVoiceSessionsParamsSchema,
} from '../controllers/voiceSession.schemas';
