/**
 * @module voiceSessionController
 * @description Controller handlers for VoiceSession REST endpoints.
 *
 * Endpoints:
 * - POST   /api/v1/voice/sessions         - Create/upsert voice session
 * - DELETE /api/v1/voice/sessions/:sessionId - Delete voice session
 * - GET    /api/v1/voice/rooms/:roomId/sessions - List sessions in room
 */

import { Request, Response, NextFunction } from 'express';
import { buildSuccessResponse, createMeta } from '../utils/response';
import { issueTokenForUser } from '../services/livekitAdapter';
import * as voiceSessionStore from '../services/voiceSessionStore';
import { AppError } from '../types/http';
import { metrics, startTimer } from '../services/metrics';
import type { CreateVoiceSessionInput } from './voiceSession.schemas';

/**
 * Creates or updates a VoiceSession for a user in a room.
 *
 * POST /api/v1/voice/sessions
 *
 * If a session already exists for the same (roomId, userId), it will be
 * updated with fresh LiveKit credentials (upsert semantics).
 *
 * Request body (validated by Zod):
 * ```json
 * {
 *   "roomId": "room-123",
 *   "userId": "user-456",
 *   "username": "JohnDoe",
 *   "canPublishAudio": true,
 *   "canSubscribe": true
 * }
 * ```
 *
 * Response (201 Created):
 * ```json
 * {
 *   "data": {
 *     "sessionId": "vs_abc123_xyz789",
 *     "roomId": "room-123",
 *     "userId": "user-456",
 *     "username": "JohnDoe",
 *     "canPublishAudio": true,
 *     "canSubscribe": true,
 *     "livekit": {
 *       "roomName": "jamroom:room-123",
 *       "identity": "user-456",
 *       "token": "<jwt>",
 *       "url": "wss://livekit.example.com",
 *       "expiresAt": "2024-01-01T12:00:00.000Z"
 *     },
 *     "createdAt": "2024-01-01T11:00:00.000Z",
 *     "updatedAt": "2024-01-01T11:00:00.000Z"
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export async function createVoiceSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Start timer for latency measurement
  const timer = startTimer();

  try {
    const body = req.body as CreateVoiceSessionInput;
    const { roomId, userId, username, canPublishAudio, canSubscribe } = body;

    // Check if session already exists (for determining HTTP status)
    const existingSession = voiceSessionStore.findByRoomAndUser(roomId, userId);
    const isUpdate = existingSession !== null;

    // Generate LiveKit token
    const livekitInfo = await issueTokenForUser({
      roomId,
      userId,
      username,
      canPublishAudio,
      canSubscribe,
    });

    // Create or update the session
    const session = voiceSessionStore.createOrUpdateSession(
      { roomId, userId, username, canPublishAudio, canSubscribe },
      livekitInfo
    );

    // Record metrics
    metrics.voiceSessionsCreated.inc();
    metrics.createSessionLatency.observe(timer.end());

    const response = buildSuccessResponse(session, createMeta(req));

    // 201 Created for new sessions, 200 OK for updates
    res.status(isUpdate ? 200 : 201).json(response);
  } catch (error) {
    // Record latency even on failure
    metrics.createSessionLatency.observe(timer.end());
    next(error);
  }
}

/**
 * Deletes a VoiceSession by sessionId.
 *
 * DELETE /api/v1/voice/sessions/:sessionId
 *
 * Response (204 No Content) - on success, no body returned
 *
 * Response (404 Not Found):
 * ```json
 * {
 *   "data": null,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Voice session not found"
 *   },
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export function deleteVoiceSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { sessionId } = req.params;

    const deleted = voiceSessionStore.deleteSession(sessionId);

    if (!deleted) {
      throw AppError.notFound('Voice session not found', {
        sessionId,
      });
    }

    // Record deletion metric
    metrics.voiceSessionsDeleted.inc();

    // 204 No Content - no response body per REST conventions
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Lists all VoiceSessions for a given room.
 *
 * GET /api/v1/voice/rooms/:roomId/sessions
 *
 * Response (200 OK):
 * ```json
 * {
 *   "data": {
 *     "sessions": [
 *       {
 *         "sessionId": "vs_abc123_xyz789",
 *         "roomId": "room-123",
 *         "userId": "user-456",
 *         ...
 *       }
 *     ],
 *     "count": 1
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export function listVoiceSessionsByRoom(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const { roomId } = req.params;

  const sessions = voiceSessionStore.listSessionsByRoom(roomId);

  const responseData = {
    sessions,
    count: sessions.length,
  };

  const response = buildSuccessResponse(responseData, createMeta(req));

  res.status(200).json(response);
}

/**
 * Gets a single VoiceSession by sessionId.
 *
 * GET /api/v1/voice/sessions/:sessionId
 *
 * Response (200 OK):
 * ```json
 * {
 *   "data": {
 *     "sessionId": "vs_abc123_xyz789",
 *     "roomId": "room-123",
 *     "userId": "user-456",
 *     ...
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 *
 * Response (404 Not Found):
 * ```json
 * {
 *   "data": null,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Voice session not found"
 *   },
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export function getVoiceSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { sessionId } = req.params;

    const session = voiceSessionStore.getSession(sessionId);

    if (!session) {
      throw AppError.notFound('Voice session not found', {
        sessionId,
      });
    }

    const response = buildSuccessResponse(session, createMeta(req));

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
