/**
 * Voice Session Types
 *
 * Domain types for voice session management in the chatVoice-service.
 * VoiceSessions represent active or pending voice connections for users
 * in JamRoom collaboration rooms.
 */

import { LivekitTokenInfo } from '../services/livekitAdapter';

// ============================================================================
// VOICE SESSION TYPES
// ============================================================================

/**
 * Represents an active voice session for a user in a room.
 *
 * A VoiceSession contains:
 * - Session metadata (id, timestamps)
 * - User/room association
 * - Permission flags
 * - LiveKit connection details
 */
export interface VoiceSession {
  /**
   * Unique session identifier (UUID v4)
   */
  sessionId: string;

  /**
   * The room this session belongs to
   */
  roomId: string;

  /**
   * The user who owns this session
   */
  userId: string;

  /**
   * Optional display name for the user
   */
  username?: string;

  /**
   * Whether the user can publish audio
   */
  canPublishAudio: boolean;

  /**
   * Whether the user can subscribe to other participants
   */
  canSubscribe: boolean;

  /**
   * LiveKit connection details and token
   */
  livekit: LivekitTokenInfo;

  /**
   * Session creation timestamp (ISO 8601)
   */
  createdAt: string;

  /**
   * Last update timestamp (ISO 8601)
   */
  updatedAt: string;
}

// ============================================================================
// OPERATION TYPES
// ============================================================================

/**
 * Parameters for creating or updating a voice session.
 *
 * Used by the VoiceSessionStore to create new sessions or
 * update existing ones for the same user/room pair.
 */
export interface CreateVoiceSessionParams {
  /**
   * The room ID for the session
   */
  roomId: string;

  /**
   * The user ID for the session
   */
  userId: string;

  /**
   * Optional display name for the user
   */
  username?: string;

  /**
   * Whether the user can publish audio
   */
  canPublishAudio: boolean;

  /**
   * Whether the user can subscribe to other participants
   */
  canSubscribe: boolean;
}

/**
 * Parameters for updating an existing voice session.
 */
export interface UpdateVoiceSessionParams {
  /**
   * Updated username (optional)
   */
  username?: string;

  /**
   * Updated publish audio permission (optional)
   */
  canPublishAudio?: boolean;

  /**
   * Updated subscribe permission (optional)
   */
  canSubscribe?: boolean;

  /**
   * Updated LiveKit token information (optional)
   */
  livekit?: LivekitTokenInfo;
}

/**
 * Parameters for creating a voice session via HTTP API.
 *
 * These are the user-facing parameters before LiveKit token generation.
 */
export interface CreateVoiceSessionRequest {
  /**
   * The room ID to join
   */
  roomId: string;

  /**
   * The user ID joining the room
   */
  userId: string;

  /**
   * Optional display name for the user
   */
  username?: string;

  /**
   * Whether the user can publish audio (defaults to true)
   */
  canPublishAudio?: boolean;

  /**
   * Whether the user can subscribe to other participants (defaults to true)
   */
  canSubscribe?: boolean;
}

// ============================================================================
// VOICE MODERATION TYPES
// ============================================================================

/**
 * Role for voice-specific permissions within a room.
 * This is a voice-layer role, separate from global JamRoom roles.
 * Derived from info provided by sync-service or queue-service.
 */
export type VoiceRole = 'host' | 'cohost' | 'speaker' | 'listener';

/**
 * Policy configuration for a voice room.
 * Controls speaking limits and host-only modes.
 */
export interface VoiceRoomPolicy {
  /**
   * The room this policy applies to
   */
  roomId: string;

  /**
   * Maximum number of speakers allowed (null = unlimited)
   */
  maxSpeakers: number | null;

  /**
   * When true, only host/cohost can publish audio
   */
  hostOnlyMode: boolean;

  /**
   * Policy creation timestamp (ISO 8601)
   */
  createdAt: string;

  /**
   * Last update timestamp (ISO 8601)
   */
  updatedAt: string;
}

/**
 * Types of moderation actions that can be taken.
 */
export type VoiceModerationActionType =
  | 'SERVER_MUTE'
  | 'SERVER_UNMUTE'
  | 'KICK'
  | 'BLOCK_SPEAKING';

/**
 * Record of a moderation action taken in a voice room.
 */
export interface VoiceModerationAction {
  /**
   * Unique identifier for this action (UUID v4)
   */
  id: string;

  /**
   * The room where the action was taken
   */
  roomId: string;

  /**
   * The user who was the target of the action
   */
  targetUserId: string;

  /**
   * The moderator who performed the action
   */
  moderatorUserId: string;

  /**
   * Type of moderation action
   */
  type: VoiceModerationActionType;

  /**
   * Optional reason for the action
   */
  reason?: string;

  /**
   * When the action was performed (ISO 8601)
   */
  createdAt: string;
}
