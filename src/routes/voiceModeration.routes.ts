/**
 * @module voiceModeration.routes
 * @description Express routes for voice moderation operations.
 *
 * Base path: /api/v1/voice/moderation
 *
 * Routes:
 * - POST /server-mute           - Server mute a participant
 * - POST /server-unmute         - Server unmute a participant
 * - POST /kick                  - Kick a participant from the room
 * - POST /policy                - Update room policy
 * - GET  /rooms/:roomId/actions - List moderation actions for a room
 *
 * All routes require x-internal-api-key header authentication.
 * These endpoints are designed for internal use by sync-service.
 */

import { Router } from 'express';
import { requireInternalApiKey } from '../middleware/internalAuth';
import { validateRequest } from '../middleware/validation';
import {
  serverMute,
  serverUnmute,
  kick,
  updatePolicy,
  listModerationActions,
} from '../controllers/voiceModeration.controller';
import {
  ServerMuteBodySchema,
  ServerUnmuteBodySchema,
  KickBodySchema,
  UpdatePolicyBodySchema,
  ListModerationActionsParamsSchema,
} from '../controllers/voiceModeration.schemas';

/**
 * Creates and configures the voice moderation routes router.
 *
 * All routes are protected by internal API key authentication.
 *
 * @returns Configured Express Router with voice moderation routes
 */
export function createVoiceModerationRouter(): Router {
  const router = Router();

  // Apply internal API key authentication to all routes
  router.use(requireInternalApiKey);

  /**
   * POST /server-mute
   * Server mute a participant's audio.
   *
   * Body:
   * - roomId: string - The room ID
   * - targetUserId: string - The user to mute
   * - moderatorUserId: string - The moderator performing the action
   * - reason?: string - Optional reason
   */
  router.post(
    '/server-mute',
    validateRequest({ body: ServerMuteBodySchema }),
    serverMute
  );

  /**
   * POST /server-unmute
   * Server unmute a participant's audio.
   *
   * Body:
   * - roomId: string - The room ID
   * - targetUserId: string - The user to unmute
   * - moderatorUserId: string - The moderator performing the action
   * - reason?: string - Optional reason
   */
  router.post(
    '/server-unmute',
    validateRequest({ body: ServerUnmuteBodySchema }),
    serverUnmute
  );

  /**
   * POST /kick
   * Kick a participant from the room.
   *
   * Body:
   * - roomId: string - The room ID
   * - targetUserId: string - The user to kick
   * - moderatorUserId: string - The moderator performing the action
   * - reason?: string - Optional reason
   */
  router.post(
    '/kick',
    validateRequest({ body: KickBodySchema }),
    kick
  );

  /**
   * POST /policy
   * Update room policy.
   *
   * Body:
   * - roomId: string - The room ID
   * - maxSpeakers?: number | null - Maximum speakers (null = unlimited)
   * - hostOnlyMode?: boolean - Whether only host/cohost can speak
   */
  router.post(
    '/policy',
    validateRequest({ body: UpdatePolicyBodySchema }),
    updatePolicy
  );

  /**
   * GET /rooms/:roomId/actions
   * List moderation actions for a room.
   *
   * Params:
   * - roomId: string - The room ID
   *
   * Returns empty array if no actions exist.
   */
  router.get(
    '/rooms/:roomId/actions',
    validateRequest({ params: ListModerationActionsParamsSchema }),
    listModerationActions
  );

  return router;
}

/**
 * Registers voice moderation routes on an Express application.
 *
 * @param app - Express application or router to register routes on
 */
export function registerVoiceModerationRoutes(app: Router): void {
  const moderationRouter = createVoiceModerationRouter();
  app.use('/api/v1/voice/moderation', moderationRouter);
}

// Export schemas for testing
export {
  ServerMuteBodySchema,
  ServerUnmuteBodySchema,
  KickBodySchema,
  UpdatePolicyBodySchema,
  ListModerationActionsParamsSchema,
} from '../controllers/voiceModeration.schemas';
