/**
 * @module voiceSession.schemas
 * @description Zod validation schemas for VoiceSession endpoints.
 *
 * Defines request body and parameter validation for:
 * - POST /api/v1/voice/sessions - Create voice session
 * - DELETE /api/v1/voice/sessions/:sessionId - Delete voice session
 * - GET /api/v1/voice/rooms/:roomId/sessions - List sessions in room
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared Field Schemas
// ---------------------------------------------------------------------------

/**
 * Room ID validation.
 * Must be a non-empty string, typically a UUID or alphanumeric identifier.
 */
const roomIdSchema = z
  .string()
  .min(1, 'roomId is required')
  .max(128, 'roomId must be at most 128 characters');

/**
 * User ID validation.
 * Must be a non-empty string, typically a UUID or alphanumeric identifier.
 */
const userIdSchema = z
  .string()
  .min(1, 'userId is required')
  .max(128, 'userId must be at most 128 characters');

/**
 * Session ID validation.
 * Expected format: vs_<timestamp>_<random>
 */
const sessionIdSchema = z
  .string()
  .min(1, 'sessionId is required')
  .max(64, 'sessionId must be at most 64 characters');

/**
 * Username validation (optional display name).
 */
const usernameSchema = z
  .string()
  .max(64, 'username must be at most 64 characters')
  .optional();

// ---------------------------------------------------------------------------
// Request Body Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /api/v1/voice/sessions request body.
 *
 * Creates a new voice session for a user in a room, generating
 * LiveKit credentials.
 *
 * @example
 * ```json
 * {
 *   "roomId": "abc123",
 *   "userId": "user-456",
 *   "username": "JohnDoe",
 *   "canPublishAudio": true,
 *   "canSubscribe": true
 * }
 * ```
 */
export const CreateVoiceSessionSchema = z.object({
  roomId: roomIdSchema,
  userId: userIdSchema,
  username: usernameSchema,
  canPublishAudio: z
    .boolean()
    .default(true)
    .describe('Whether the user can publish audio'),
  canSubscribe: z
    .boolean()
    .default(true)
    .describe('Whether the user can subscribe to other tracks'),
});

/**
 * Type inferred from CreateVoiceSessionSchema.
 */
export type CreateVoiceSessionInput = z.infer<typeof CreateVoiceSessionSchema>;

// ---------------------------------------------------------------------------
// URL Parameter Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for DELETE /api/v1/voice/sessions/:sessionId URL params.
 *
 * @example
 * DELETE /api/v1/voice/sessions/vs_abc123_xyz789
 */
export const DeleteVoiceSessionParamsSchema = z.object({
  sessionId: sessionIdSchema,
});

/**
 * Type inferred from DeleteVoiceSessionParamsSchema.
 */
export type DeleteVoiceSessionParams = z.infer<
  typeof DeleteVoiceSessionParamsSchema
>;

/**
 * Schema for GET /api/v1/voice/rooms/:roomId/sessions URL params.
 *
 * @example
 * GET /api/v1/voice/rooms/abc123/sessions
 */
export const ListVoiceSessionsParamsSchema = z.object({
  roomId: roomIdSchema,
});

/**
 * Type inferred from ListVoiceSessionsParamsSchema.
 */
export type ListVoiceSessionsParams = z.infer<
  typeof ListVoiceSessionsParamsSchema
>;

// ---------------------------------------------------------------------------
// Response Schemas (for documentation/testing)
// ---------------------------------------------------------------------------

/**
 * LiveKit token info schema for response validation.
 */
export const LivekitTokenInfoSchema = z.object({
  roomName: z.string(),
  identity: z.string(),
  token: z.string(),
  url: z.string(),
  expiresAt: z.string().datetime(),
});

/**
 * VoiceSession schema for response validation.
 */
export const VoiceSessionSchema = z.object({
  sessionId: z.string(),
  roomId: z.string(),
  userId: z.string(),
  username: z.string().optional(),
  canPublishAudio: z.boolean(),
  canSubscribe: z.boolean(),
  livekit: LivekitTokenInfoSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Type inferred from VoiceSessionSchema.
 */
export type VoiceSessionResponse = z.infer<typeof VoiceSessionSchema>;
