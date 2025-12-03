/**
 * LiveKit Adapter Service
 *
 * This module handles integration with LiveKit for voice/video functionality.
 *
 * LiveKit is a real-time communication platform that provides:
 * - WebRTC-based audio/video rooms
 * - Access token generation for secure room access
 * - Room management (create, list, delete)
 * - Participant management
 */

import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { config, LiveKitConfig } from '../config';
import { AppError } from '../types/http';
import { metrics, startTimer } from './metrics';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about a generated LiveKit token.
 */
export interface LivekitTokenInfo {
  /**
   * The LiveKit room name (format: jamroom:<roomId>)
   */
  roomName: string;

  /**
   * The participant identity (userId)
   */
  identity: string;

  /**
   * The JWT access token for connecting to LiveKit
   */
  token: string;

  /**
   * The WebSocket URL to connect to
   */
  url: string;

  /**
   * Token expiration time in ISO 8601 format
   */
  expiresAt: string;
}

/**
 * Parameters for issuing a LiveKit token.
 */
export interface IssueTokenParams {
  /**
   * The room ID (will be prefixed with "jamroom:")
   */
  roomId: string;

  /**
   * The user ID (used as participant identity)
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

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Validates that LiveKit configuration is available.
 * Throws AppError.dependencyUnavailable if configuration is missing.
 */
function validateLiveKitConfig(): Required<LiveKitConfig> {
  const { livekit } = config;
  const missingFields: string[] = [];

  if (!livekit.apiKey) missingFields.push('LIVEKIT_API_KEY');
  if (!livekit.apiSecret) missingFields.push('LIVEKIT_API_SECRET');
  if (!livekit.wsUrl) missingFields.push('LIVEKIT_URL'); // Changed from LIVEKIT_WS_URL

  if (missingFields.length > 0) {
    throw AppError.dependencyUnavailable(
      'LiveKit configuration error',
      {
        missingFields,
        message: `Missing required LiveKit configuration: ${missingFields.join(', ')}`,
      },
    );
  }

  return livekit as Required<LiveKitConfig>;
}

/**
 * Issues a LiveKit access token for a user to join a room.
 *
 * @param params - Token generation parameters
 * @returns LiveKit token information including the JWT and connection details
 *
 * @throws AppError with code DEPENDENCY_UNAVAILABLE if LiveKit config is missing
 *
 * @example
 * ```typescript
 * const tokenInfo = await issueTokenForUser({
 *   roomId: 'room-123',
 *   userId: 'user-456',
 *   username: 'John Doe',
 *   canPublishAudio: true,
 *   canSubscribe: true,
 * });
 *
 * // Client connects using:
 * // - tokenInfo.url (WebSocket URL)
 * // - tokenInfo.token (JWT)
 * ```
 */
export async function issueTokenForUser(
  params: IssueTokenParams
): Promise<LivekitTokenInfo> {
  // Start timer for latency measurement
  const timer = startTimer();

  // Validate configuration before proceeding
  validateLiveKitConfig();

  // After validation, we know these values exist
  const { apiKey, apiSecret, wsUrl, tokenTtlSeconds } = config.livekit;
  
  // Type guard - these are guaranteed to exist after validateLiveKitConfig()
  if (!apiKey || !apiSecret || !wsUrl) {
    // This should never happen after validation, but TypeScript needs this
    throw AppError.dependencyUnavailable('LiveKit configuration error', {
      message: 'LiveKit configuration is incomplete after validation',
    });
  }

  const { roomId, userId, username, canPublishAudio, canSubscribe } = params;

  // Create room name with jamroom prefix
  const roomName = `jamroom:${roomId}`;

  // Create access token
  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: username,
    ttl: tokenTtlSeconds,
  });

  // Add video grant with permissions
  accessToken.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: canPublishAudio,
    canSubscribe: canSubscribe,
    // Disable video publish by default for voice-only sessions
    canPublishSources: canPublishAudio ? [TrackSource.MICROPHONE] : [],
  });

  // Generate JWT
  const token = await accessToken.toJwt();

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + tokenTtlSeconds * 1000).toISOString();

  // Record latency metric
  metrics.tokenIssuanceLatency.observe(timer.end());

  return {
    roomName,
    identity: userId,
    token,
    url: wsUrl,
    expiresAt,
  };
}

// ============================================================================
// ROOM MANAGEMENT (Future Implementation)
// ============================================================================

/**
 * Creates a new LiveKit room.
 *
 * @param roomId - The room ID to create
 * @returns Room creation result
 *
 * @remarks
 * This function is a placeholder for future implementation.
 * LiveKit automatically creates rooms when the first participant joins,
 * so explicit room creation is optional.
 */
export async function createRoom(_roomId: string): Promise<{ created: boolean }> {
  // TODO: Implement using RoomServiceClient when needed
  // For now, rooms are created automatically when users join
  return { created: true };
}

/**
 * Deletes a LiveKit room and disconnects all participants.
 *
 * @param roomId - The room ID to delete
 * @returns Room deletion result
 *
 * @remarks
 * This function is a placeholder for future implementation.
 */
export async function deleteRoom(_roomId: string): Promise<{ deleted: boolean }> {
  // TODO: Implement using RoomServiceClient when needed
  return { deleted: true };
}

/**
 * Lists all participants in a LiveKit room.
 *
 * @param roomId - The room ID to query
 * @returns List of participants
 *
 * @remarks
 * This function is a placeholder for future implementation.
 */
export async function listParticipants(
  _roomId: string
): Promise<{ participants: unknown[] }> {
  // TODO: Implement using RoomServiceClient when needed
  return { participants: [] };
}
