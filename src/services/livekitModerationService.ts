/**
 * @module livekitModerationService
 * @description Service for LiveKit room moderation operations.
 *
 * This module handles:
 * - Muting/unmuting participants
 * - Disconnecting participants (kick)
 * - Room management operations
 *
 * Uses LiveKit's RoomServiceClient for server-side control.
 */

import { RoomServiceClient } from 'livekit-server-sdk';
import { config } from '../config';
import { AppError } from '../types/http';
import { logger } from '../middleware/logger';
import { metrics, startTimer } from './metrics';
import type { ModerationActionType, ModerationResultType } from './metrics';

// ============================================================================
// ROOM SERVICE CLIENT SINGLETON
// ============================================================================

/**
 * Singleton RoomServiceClient instance.
 * Lazily initialized on first use.
 */
let roomServiceClient: RoomServiceClient | null = null;

/**
 * Gets or creates the RoomServiceClient singleton.
 *
 * @throws AppError if LiveKit configuration is missing
 * @returns RoomServiceClient instance
 */
function getRoomServiceClient(): RoomServiceClient {
  if (roomServiceClient) {
    return roomServiceClient;
  }

  const { apiKey, apiSecret, wsUrl } = config.livekit;

  const missingFields: string[] = [];
  if (!apiKey) missingFields.push('LIVEKIT_API_KEY');
  if (!apiSecret) missingFields.push('LIVEKIT_API_SECRET');
  if (!wsUrl) missingFields.push('LIVEKIT_URL');

  if (missingFields.length > 0) {
    throw AppError.dependencyUnavailable('LiveKit configuration error', {
      missingFields,
      message: `Missing required LiveKit configuration: ${missingFields.join(', ')}`,
    });
  }

  // Convert wsUrl to HTTP endpoint for RoomServiceClient
  // wss://my.livekit.cloud -> https://my.livekit.cloud
  const httpUrl = wsUrl!.replace('wss://', 'https://').replace('ws://', 'http://');

  roomServiceClient = new RoomServiceClient(httpUrl, apiKey!, apiSecret!);

  logger.debug({ httpUrl }, 'LiveKit RoomServiceClient initialized');

  return roomServiceClient;
}

// ============================================================================
// MODERATION OPERATIONS
// ============================================================================

/**
 * Mutes a participant's audio in a room (server-side mute).
 *
 * @param roomName - The LiveKit room name (format: jamroom:roomId)
 * @param identity - The participant identity (userId)
 * @throws AppError if LiveKit service is unavailable
 */
export async function muteParticipantAudio(
  roomName: string,
  identity: string
): Promise<void> {
  const client = getRoomServiceClient();
  const timer = startTimer();
  const actionType: ModerationActionType = 'SERVER_MUTE';
  let result: ModerationResultType = 'success';

  try {
    // Mute audio by setting track muted
    // Note: This uses the updateParticipant API to mute the participant
    await client.mutePublishedTrack(roomName, identity, 'audio', true);

    logger.info(
      { roomName, identity, status: 'ok' },
      `[livekit-moderation] op=mute room=${roomName} identity=${identity} status=ok`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if participant not found (benign case)
    if (isNotFoundError(error)) {
      result = 'not_found';
      logger.info(
        { roomName, identity, status: 'not_found' },
        `[livekit-moderation] op=mute room=${roomName} identity=${identity} status=not_found`
      );
      // Fall through to record metrics, then return
    } else {
      result = 'error';
      logger.error(
        { roomName, identity, status: 'error', error: errorMessage },
        `[livekit-moderation] op=mute room=${roomName} identity=${identity} status=error error=${errorMessage}`
      );

      // Record metrics before throwing
      metrics.moderationLatency.observe(timer.end());
      metrics.voiceModerationActions.inc({ type: actionType, result });

      throw AppError.dependencyUnavailable('LiveKit mute operation failed', {
        roomName,
        identity,
        error: errorMessage,
      });
    }
  }

  // Record metrics for success and not_found cases
  metrics.moderationLatency.observe(timer.end());
  metrics.voiceModerationActions.inc({ type: actionType, result });
}

/**
 * Unmutes a participant's audio in a room (server-side unmute).
 *
 * @param roomName - The LiveKit room name (format: jamroom:roomId)
 * @param identity - The participant identity (userId)
 * @throws AppError if LiveKit service is unavailable
 */
export async function unmuteParticipantAudio(
  roomName: string,
  identity: string
): Promise<void> {
  const client = getRoomServiceClient();
  const timer = startTimer();
  const actionType: ModerationActionType = 'SERVER_UNMUTE';
  let result: ModerationResultType = 'success';

  try {
    // Unmute audio by setting track unmuted
    await client.mutePublishedTrack(roomName, identity, 'audio', false);

    logger.info(
      { roomName, identity, status: 'ok' },
      `[livekit-moderation] op=unmute room=${roomName} identity=${identity} status=ok`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if participant not found (benign case)
    if (isNotFoundError(error)) {
      result = 'not_found';
      logger.info(
        { roomName, identity, status: 'not_found' },
        `[livekit-moderation] op=unmute room=${roomName} identity=${identity} status=not_found`
      );
      // Fall through to record metrics, then return
    } else {
      result = 'error';
      logger.error(
        { roomName, identity, status: 'error', error: errorMessage },
        `[livekit-moderation] op=unmute room=${roomName} identity=${identity} status=error error=${errorMessage}`
      );

      // Record metrics before throwing
      metrics.moderationLatency.observe(timer.end());
      metrics.voiceModerationActions.inc({ type: actionType, result });

      throw AppError.dependencyUnavailable('LiveKit unmute operation failed', {
        roomName,
        identity,
        error: errorMessage,
      });
    }
  }

  // Record metrics for success and not_found cases
  metrics.moderationLatency.observe(timer.end());
  metrics.voiceModerationActions.inc({ type: actionType, result });
}

/**
 * Disconnects (kicks) a participant from a room.
 *
 * @param roomName - The LiveKit room name (format: jamroom:roomId)
 * @param identity - The participant identity (userId)
 * @param reason - Optional reason for the disconnect
 * @throws AppError if LiveKit service is unavailable
 */
export async function disconnectParticipant(
  roomName: string,
  identity: string,
  reason?: string
): Promise<void> {
  const client = getRoomServiceClient();
  const timer = startTimer();
  const actionType: ModerationActionType = 'KICK';
  let result: ModerationResultType = 'success';

  try {
    // Remove participant from room
    await client.removeParticipant(roomName, identity);

    logger.info(
      { roomName, identity, reason, status: 'ok' },
      `[livekit-moderation] op=kick room=${roomName} identity=${identity} status=ok${reason ? ` reason=${reason}` : ''}`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if participant not found (benign case)
    if (isNotFoundError(error)) {
      result = 'not_found';
      logger.info(
        { roomName, identity, reason, status: 'not_found' },
        `[livekit-moderation] op=kick room=${roomName} identity=${identity} status=not_found`
      );
      // Fall through to record metrics, then return
    } else {
      result = 'error';
      logger.error(
        { roomName, identity, reason, status: 'error', error: errorMessage },
        `[livekit-moderation] op=kick room=${roomName} identity=${identity} status=error error=${errorMessage}`
      );

      // Record metrics before throwing
      metrics.moderationLatency.observe(timer.end());
      metrics.voiceModerationActions.inc({ type: actionType, result });

      throw AppError.dependencyUnavailable('LiveKit kick operation failed', {
        roomName,
        identity,
        reason,
        error: errorMessage,
      });
    }
  }

  // Record metrics for success and not_found cases
  metrics.moderationLatency.observe(timer.end());
  metrics.voiceModerationActions.inc({ type: actionType, result });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if an error indicates a "not found" condition.
 *
 * LiveKit throws errors when participant/room is not found.
 * We treat these as benign cases.
 *
 * @param error - The error to check
 * @returns true if the error is a "not found" type
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('not found') ||
      message.includes('participant not found') ||
      message.includes('room not found') ||
      message.includes('404')
    );
  }
  return false;
}

/**
 * Converts a room ID to LiveKit room name format.
 *
 * @param roomId - The application room ID
 * @returns The LiveKit room name (format: jamroom:roomId)
 */
export function toRoomName(roomId: string): string {
  return `jamroom:${roomId}`;
}

/**
 * Resets the RoomServiceClient singleton.
 * Primarily for testing.
 */
export function resetRoomServiceClient(): void {
  roomServiceClient = null;
}
