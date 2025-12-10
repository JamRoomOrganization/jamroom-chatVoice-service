/**
 * @module voiceSessionStore
 * @description In-memory store for VoiceSession management with dual indexing.
 *
 * Provides efficient lookups by:
 * - sessionId (primary index)
 * - roomId (secondary index for listing all sessions in a room)
 *
 * Supports upsert semantics: if a session already exists for the same
 * (roomId, userId), it will be updated instead of creating a duplicate.
 */

import type {
  VoiceSession,
  CreateVoiceSessionParams,
  UpdateVoiceSessionParams,
} from '../types';

// ---------------------------------------------------------------------------
// Internal State
// ---------------------------------------------------------------------------

/** Primary index: sessionId → VoiceSession */
const sessionsById = new Map<string, VoiceSession>();

/** Secondary index: roomId → Set of sessionIds */
const sessionsByRoom = new Map<string, Set<string>>();

/** Reverse lookup: `${roomId}:${userId}` → sessionId (for upsert logic) */
const sessionByRoomUser = new Map<string, string>();

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Generates a composite key for room+user lookups.
 */
function roomUserKey(roomId: string, userId: string): string {
  return `${roomId}:${userId}`;
}

/**
 * Generates a unique session ID using timestamp and random component.
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `vs_${timestamp}_${random}`;
}

// ---------------------------------------------------------------------------
// Store Operations
// ---------------------------------------------------------------------------

/**
 * Creates a new VoiceSession or updates an existing one if the same
 * (roomId, userId) combination already exists.
 *
 * @param params - Parameters for creating the session
 * @param livekitInfo - LiveKit token information to attach
 * @returns The created or updated VoiceSession
 */
export function createOrUpdateSession(
  params: CreateVoiceSessionParams,
  livekitInfo: VoiceSession['livekit'],
): VoiceSession {
  const { roomId, userId, username, canPublishAudio, canSubscribe } = params;
  const key = roomUserKey(roomId, userId);
  const existingSessionId = sessionByRoomUser.get(key);
  const now = new Date().toISOString();

  if (existingSessionId) {
    // Update existing session
    const existing = sessionsById.get(existingSessionId);
    if (existing) {
      const updated: VoiceSession = {
        ...existing,
        username: username ?? existing.username,
        canPublishAudio,
        canSubscribe,
        livekit: livekitInfo,
        updatedAt: now,
      };
      sessionsById.set(existingSessionId, updated);
      return updated;
    }
  }

  // Create new session
  const sessionId = generateSessionId();
  const session: VoiceSession = {
    sessionId,
    roomId,
    userId,
    username,
    canPublishAudio,
    canSubscribe,
    livekit: livekitInfo,
    createdAt: now,
    updatedAt: now,
  };

  // Update all indexes
  sessionsById.set(sessionId, session);
  sessionByRoomUser.set(key, sessionId);

  // Update room index
  let roomSessions = sessionsByRoom.get(roomId);
  if (!roomSessions) {
    roomSessions = new Set();
    sessionsByRoom.set(roomId, roomSessions);
  }
  roomSessions.add(sessionId);

  return session;
}

/**
 * Updates an existing VoiceSession by sessionId.
 *
 * @param sessionId - The ID of the session to update
 * @param updates - Partial fields to update
 * @returns The updated session, or null if not found
 */
export function updateSession(
  sessionId: string,
  updates: UpdateVoiceSessionParams,
): VoiceSession | null {
  const existing = sessionsById.get(sessionId);
  if (!existing) {
    return null;
  }

  const updated: VoiceSession = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  sessionsById.set(sessionId, updated);
  return updated;
}

/**
 * Deletes a VoiceSession by sessionId.
 *
 * @param sessionId - The ID of the session to delete
 * @returns true if the session was deleted, false if not found
 */
export function deleteSession(sessionId: string): boolean {
  const session = sessionsById.get(sessionId);
  if (!session) {
    return false;
  }

  // Remove from primary index
  sessionsById.delete(sessionId);

  // Remove from room+user index
  const key = roomUserKey(session.roomId, session.userId);
  sessionByRoomUser.delete(key);

  // Remove from room index
  const roomSessions = sessionsByRoom.get(session.roomId);
  if (roomSessions) {
    roomSessions.delete(sessionId);
    if (roomSessions.size === 0) {
      sessionsByRoom.delete(session.roomId);
    }
  }

  return true;
}

/**
 * Deletes all VoiceSessions for a given room.
 *
 * @param roomId - The room ID to clear sessions for
 * @returns The number of sessions deleted
 */
export function deleteSessionsByRoom(roomId: string): number {
  const roomSessions = sessionsByRoom.get(roomId);
  if (!roomSessions || roomSessions.size === 0) {
    return 0;
  }

  let count = 0;
  for (const sessionId of roomSessions) {
    const session = sessionsById.get(sessionId);
    if (session) {
      // Remove from room+user index
      const key = roomUserKey(session.roomId, session.userId);
      sessionByRoomUser.delete(key);
      // Remove from primary index
      sessionsById.delete(sessionId);
      count++;
    }
  }

  // Clear room index
  sessionsByRoom.delete(roomId);

  return count;
}

/**
 * Retrieves a VoiceSession by sessionId.
 *
 * @param sessionId - The ID of the session to retrieve
 * @returns The session, or null if not found
 */
export function getSession(sessionId: string): VoiceSession | null {
  return sessionsById.get(sessionId) ?? null;
}

/**
 * Finds a VoiceSession by roomId and userId combination.
 *
 * @param roomId - The room ID
 * @param userId - The user ID
 * @returns The session, or null if not found
 */
export function findByRoomAndUser(
  roomId: string,
  userId: string,
): VoiceSession | null {
  const key = roomUserKey(roomId, userId);
  const sessionId = sessionByRoomUser.get(key);
  if (!sessionId) {
    return null;
  }
  return sessionsById.get(sessionId) ?? null;
}

/**
 * Lists all VoiceSessions for a given room.
 *
 * @param roomId - The room ID to list sessions for
 * @returns Array of sessions in the room (empty array if none)
 */
export function listSessionsByRoom(roomId: string): VoiceSession[] {
  const roomSessions = sessionsByRoom.get(roomId);
  if (!roomSessions) {
    return [];
  }

  const sessions: VoiceSession[] = [];
  for (const sessionId of roomSessions) {
    const session = sessionsById.get(sessionId);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}

/**
 * Returns the total count of active sessions.
 *
 * @returns The number of active sessions
 */
export function countSessions(): number {
  return sessionsById.size;
}

/**
 * Returns the count of sessions in a specific room.
 *
 * @param roomId - The room ID to count sessions for
 * @returns The number of sessions in the room
 */
export function countSessionsInRoom(roomId: string): number {
  return sessionsByRoom.get(roomId)?.size ?? 0;
}

/**
 * Clears all sessions from the store.
 * Primarily used for testing.
 */
export function clearAll(): void {
  sessionsById.clear();
  sessionsByRoom.clear();
  sessionByRoomUser.clear();
}

/**
 * Returns all session IDs (for debugging/testing).
 */
export function getAllSessionIds(): string[] {
  return Array.from(sessionsById.keys());
}

/**
 * Lists all VoiceSessions whose LiveKit token expires within the given threshold.
 *
 * @param thresholdSeconds - Number of seconds from now to consider as "expiring soon"
 * @returns Array of sessions expiring within the threshold
 *
 * @example
 * ```typescript
 * // Get all sessions expiring in the next 10 minutes (600 seconds)
 * const expiringSessions = listExpiringSessions(600);
 * ```
 */
export function listExpiringSessions(thresholdSeconds: number): VoiceSession[] {
  const now = Date.now();
  const thresholdMs = thresholdSeconds * 1000;
  const expirationThreshold = now + thresholdMs;

  const expiringSessions: VoiceSession[] = [];

  for (const session of sessionsById.values()) {
    const expiresAt = new Date(session.livekit.expiresAt).getTime();

    // Session is expiring if its expiresAt is before the threshold time
    if (expiresAt <= expirationThreshold) {
      expiringSessions.push(session);
    }
  }

  return expiringSessions;
}

/**
 * Returns all sessions in the store (for maintenance operations).
 *
 * @returns Array of all active sessions
 */
export function getAllSessions(): VoiceSession[] {
  return Array.from(sessionsById.values());
}
