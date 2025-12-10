/**
 * @module voiceModeration.schemas
 * @description Zod schemas for voice moderation endpoint validation.
 *
 * Provides validation schemas for:
 * - Server mute/unmute operations
 * - Kick operations
 * - Policy updates
 * - Listing moderation actions
 */

import { z } from 'zod';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

/**
 * Schema for room ID validation.
 */
const roomIdSchema = z
  .string()
  .min(1, 'roomId is required')
  .max(100, 'roomId cannot exceed 100 characters')
  .describe('The room ID for the moderation action');

/**
 * Schema for user ID validation.
 */
const userIdSchema = z
  .string()
  .min(1, 'userId is required')
  .max(100, 'userId cannot exceed 100 characters');

/**
 * Schema for optional reason field.
 */
const reasonSchema = z
  .string()
  .max(500, 'reason cannot exceed 500 characters')
  .optional()
  .describe('Optional reason for the moderation action');

// ============================================================================
// MUTE/UNMUTE SCHEMAS
// ============================================================================

/**
 * Schema for server mute request body.
 *
 * Used by POST /api/v1/voice/moderation/server-mute
 */
export const ServerMuteBodySchema = z.object({
  /**
   * The room where the action is taken
   */
  roomId: roomIdSchema,

  /**
   * The user to mute
   */
  targetUserId: userIdSchema.describe('The user ID to mute'),

  /**
   * The moderator performing the action
   */
  moderatorUserId: userIdSchema.describe('The moderator user ID'),

  /**
   * Optional reason for muting
   */
  reason: reasonSchema,
});

/**
 * Type for server mute request body.
 */
export type ServerMuteBody = z.infer<typeof ServerMuteBodySchema>;

/**
 * Schema for server unmute request body.
 *
 * Used by POST /api/v1/voice/moderation/server-unmute
 */
export const ServerUnmuteBodySchema = z.object({
  /**
   * The room where the action is taken
   */
  roomId: roomIdSchema,

  /**
   * The user to unmute
   */
  targetUserId: userIdSchema.describe('The user ID to unmute'),

  /**
   * The moderator performing the action
   */
  moderatorUserId: userIdSchema.describe('The moderator user ID'),

  /**
   * Optional reason for unmuting
   */
  reason: reasonSchema,
});

/**
 * Type for server unmute request body.
 */
export type ServerUnmuteBody = z.infer<typeof ServerUnmuteBodySchema>;

// ============================================================================
// KICK SCHEMA
// ============================================================================

/**
 * Schema for kick request body.
 *
 * Used by POST /api/v1/voice/moderation/kick
 */
export const KickBodySchema = z.object({
  /**
   * The room where the action is taken
   */
  roomId: roomIdSchema,

  /**
   * The user to kick
   */
  targetUserId: userIdSchema.describe('The user ID to kick'),

  /**
   * The moderator performing the action
   */
  moderatorUserId: userIdSchema.describe('The moderator user ID'),

  /**
   * Optional reason for kicking
   */
  reason: reasonSchema,
});

/**
 * Type for kick request body.
 */
export type KickBody = z.infer<typeof KickBodySchema>;

// ============================================================================
// POLICY SCHEMA
// ============================================================================

/**
 * Schema for update policy request body.
 *
 * Used by POST /api/v1/voice/moderation/policy
 */
export const UpdatePolicyBodySchema = z.object({
  /**
   * The room to update policy for
   */
  roomId: roomIdSchema,

  /**
   * Maximum number of speakers allowed (null = unlimited).
   * Must be >= 1 when not null.
   */
  maxSpeakers: z
    .number()
    .int('maxSpeakers must be an integer')
    .min(1, 'maxSpeakers must be at least 1')
    .nullable()
    .optional()
    .describe('Maximum speakers allowed (null = unlimited)'),

  /**
   * Whether only host/cohost can publish audio
   */
  hostOnlyMode: z
    .boolean()
    .optional()
    .describe('Whether only host/cohost can publish audio'),
});

/**
 * Type for update policy request body.
 */
export type UpdatePolicyBody = z.infer<typeof UpdatePolicyBodySchema>;

// ============================================================================
// LIST ACTIONS SCHEMA
// ============================================================================

/**
 * Schema for list moderation actions params.
 *
 * Used by GET /api/v1/voice/moderation/rooms/:roomId/actions
 */
export const ListModerationActionsParamsSchema = z.object({
  /**
   * The room ID to list actions for
   */
  roomId: roomIdSchema,
});

/**
 * Type for list moderation actions params.
 */
export type ListModerationActionsParams = z.infer<typeof ListModerationActionsParamsSchema>;
