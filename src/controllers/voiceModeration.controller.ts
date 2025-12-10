/**
 * @module voiceModerationController
 * @description Controller handlers for voice moderation REST endpoints.
 *
 * Endpoints:
 * - POST /api/v1/voice/moderation/server-mute   - Mute a participant
 * - POST /api/v1/voice/moderation/server-unmute - Unmute a participant
 * - POST /api/v1/voice/moderation/kick          - Kick a participant
 * - POST /api/v1/voice/moderation/policy        - Update room policy
 * - GET  /api/v1/voice/moderation/rooms/:roomId/actions - List moderation actions
 *
 * These endpoints are for internal use by sync-service, not for direct client access.
 * All endpoints require x-internal-api-key header authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { buildSuccessResponse, createMeta } from '../utils/response';
import { voicePolicyStore } from '../services/voicePolicyStore';
import {
  muteParticipantAudio,
  unmuteParticipantAudio,
  disconnectParticipant,
  toRoomName,
} from '../services/livekitModerationService';
import type {
  ServerMuteBody,
  ServerUnmuteBody,
  KickBody,
  UpdatePolicyBody,
  ListModerationActionsParams,
} from './voiceModeration.schemas';

// ============================================================================
// MUTE HANDLERS
// ============================================================================

/**
 * Server mute a participant.
 *
 * POST /api/v1/voice/moderation/server-mute
 *
 * Request body (validated by Zod):
 * - roomId: string - The room ID
 * - targetUserId: string - The user to mute
 * - moderatorUserId: string - The moderator performing the action
 * - reason?: string - Optional reason
 *
 * Response (200 OK):
 * ```json
 * {
 *   "data": {
 *     "action": {
 *       "id": "<uuid>",
 *       "roomId": "<roomId>",
 *       "targetUserId": "<userId>",
 *       "moderatorUserId": "<moderatorId>",
 *       "type": "SERVER_MUTE",
 *       "reason": "<reason>",
 *       "createdAt": "<ISO8601>"
 *     }
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export async function serverMute(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId, targetUserId, moderatorUserId, reason } = req.body as ServerMuteBody;

    // Convert roomId to LiveKit room name
    const roomName = toRoomName(roomId);

    // Call LiveKit to mute the participant
    await muteParticipantAudio(roomName, targetUserId);

    // Record the moderation action
    const action = voicePolicyStore.recordModerationAction({
      roomId,
      targetUserId,
      moderatorUserId,
      type: 'SERVER_MUTE',
      reason,
    });

    const response = buildSuccessResponse({ action }, createMeta(req));
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Server unmute a participant.
 *
 * POST /api/v1/voice/moderation/server-unmute
 *
 * Request body (validated by Zod):
 * - roomId: string - The room ID
 * - targetUserId: string - The user to unmute
 * - moderatorUserId: string - The moderator performing the action
 * - reason?: string - Optional reason
 *
 * Response (200 OK): Same structure as serverMute with type "SERVER_UNMUTE"
 */
export async function serverUnmute(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId, targetUserId, moderatorUserId, reason } = req.body as ServerUnmuteBody;

    // Convert roomId to LiveKit room name
    const roomName = toRoomName(roomId);

    // Call LiveKit to unmute the participant
    await unmuteParticipantAudio(roomName, targetUserId);

    // Record the moderation action
    const action = voicePolicyStore.recordModerationAction({
      roomId,
      targetUserId,
      moderatorUserId,
      type: 'SERVER_UNMUTE',
      reason,
    });

    const response = buildSuccessResponse({ action }, createMeta(req));
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// KICK HANDLER
// ============================================================================

/**
 * Kick a participant from the room.
 *
 * POST /api/v1/voice/moderation/kick
 *
 * Request body (validated by Zod):
 * - roomId: string - The room ID
 * - targetUserId: string - The user to kick
 * - moderatorUserId: string - The moderator performing the action
 * - reason?: string - Optional reason
 *
 * Response (200 OK): Same structure as serverMute with type "KICK"
 */
export async function kick(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId, targetUserId, moderatorUserId, reason } = req.body as KickBody;

    // Convert roomId to LiveKit room name
    const roomName = toRoomName(roomId);

    // Call LiveKit to disconnect the participant
    await disconnectParticipant(roomName, targetUserId, reason);

    // Record the moderation action
    const action = voicePolicyStore.recordModerationAction({
      roomId,
      targetUserId,
      moderatorUserId,
      type: 'KICK',
      reason,
    });

    const response = buildSuccessResponse({ action }, createMeta(req));
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// POLICY HANDLER
// ============================================================================

/**
 * Update room policy.
 *
 * POST /api/v1/voice/moderation/policy
 *
 * Request body (validated by Zod):
 * - roomId: string - The room ID
 * - maxSpeakers?: number | null - Maximum speakers (null = unlimited)
 * - hostOnlyMode?: boolean - Whether only host/cohost can speak
 *
 * Response (200 OK):
 * ```json
 * {
 *   "data": {
 *     "policy": {
 *       "roomId": "<roomId>",
 *       "maxSpeakers": <number|null>,
 *       "hostOnlyMode": <boolean>,
 *       "createdAt": "<ISO8601>",
 *       "updatedAt": "<ISO8601>"
 *     }
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export function updatePolicy(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const { roomId, maxSpeakers, hostOnlyMode } = req.body as UpdatePolicyBody;

  // Upsert the policy
  const policy = voicePolicyStore.upsertPolicy({
    roomId,
    maxSpeakers,
    hostOnlyMode,
  });

  const response = buildSuccessResponse({ policy }, createMeta(req));
  res.status(200).json(response);
}

// ============================================================================
// LIST ACTIONS HANDLER
// ============================================================================

/**
 * List moderation actions for a room.
 *
 * GET /api/v1/voice/moderation/rooms/:roomId/actions
 *
 * Params:
 * - roomId: string - The room ID to list actions for
 *
 * Response (200 OK):
 * ```json
 * {
 *   "data": {
 *     "actions": [
 *       {
 *         "id": "<uuid>",
 *         "roomId": "<roomId>",
 *         "targetUserId": "<userId>",
 *         "moderatorUserId": "<moderatorId>",
 *         "type": "SERVER_MUTE",
 *         "reason": "<reason>",
 *         "createdAt": "<ISO8601>"
 *       }
 *     ]
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export function listModerationActions(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const { roomId } = req.params as ListModerationActionsParams;

  // Get actions for the room (always returns array, empty if none)
  const actions = voicePolicyStore.listModerationActions(roomId);

  const response = buildSuccessResponse({ actions }, createMeta(req));
  res.status(200).json(response);
}
