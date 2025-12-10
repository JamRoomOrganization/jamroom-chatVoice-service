/**
 * @module voicePolicyStore
 * @description In-memory store for voice room policies and moderation actions.
 *
 * This store manages:
 * - Room policies (speaker limits, host-only mode)
 * - Moderation action history (mutes, kicks, etc.)
 *
 * Designed for easy migration to a database in the future.
 */

import { v4 as uuidv4 } from 'uuid';
import { VoiceRoomPolicy, VoiceModerationAction, VoiceModerationActionType } from '../types/voice';
import { logger } from '../middleware/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of moderation actions to keep per room.
 * Prevents unbounded memory growth.
 */
const MAX_ACTIONS_PER_ROOM = 100;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for creating or updating a voice room policy.
 */
export interface UpdateVoiceRoomPolicyParams {
  /**
   * The room ID for the policy
   */
  roomId: string;

  /**
   * Maximum speakers allowed (null = unlimited)
   */
  maxSpeakers?: number | null;

  /**
   * Whether only host/cohost can publish audio
   */
  hostOnlyMode?: boolean;
}

/**
 * Parameters for recording a moderation action.
 * ID and createdAt are generated automatically.
 */
export interface RecordModerationActionParams {
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
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

/**
 * In-memory store for room policies.
 * Key: roomId
 */
const policies: Map<string, VoiceRoomPolicy> = new Map();

/**
 * In-memory store for moderation actions.
 * Key: roomId, Value: array of actions (most recent last)
 */
const moderationActions: Map<string, VoiceModerationAction[]> = new Map();

// ============================================================================
// POLICY OPERATIONS
// ============================================================================

/**
 * Creates or updates a voice room policy.
 *
 * If the policy doesn't exist, creates with defaults:
 * - maxSpeakers: null (unlimited)
 * - hostOnlyMode: false
 *
 * If the policy exists, updates only the provided fields.
 *
 * @param params - Policy update parameters
 * @returns The created or updated policy
 */
export function upsertPolicy(params: UpdateVoiceRoomPolicyParams): VoiceRoomPolicy {
  const { roomId, maxSpeakers, hostOnlyMode } = params;
  const now = new Date().toISOString();

  const existingPolicy = policies.get(roomId);

  if (existingPolicy) {
    // Update existing policy
    const updatedPolicy: VoiceRoomPolicy = {
      ...existingPolicy,
      ...(maxSpeakers !== undefined && { maxSpeakers }),
      ...(hostOnlyMode !== undefined && { hostOnlyMode }),
      updatedAt: now,
    };

    policies.set(roomId, updatedPolicy);

    logger.debug(
      { roomId, maxSpeakers: updatedPolicy.maxSpeakers, hostOnlyMode: updatedPolicy.hostOnlyMode },
      'Voice room policy updated'
    );

    return updatedPolicy;
  }

  // Create new policy with defaults
  const newPolicy: VoiceRoomPolicy = {
    roomId,
    maxSpeakers: maxSpeakers !== undefined ? maxSpeakers : null,
    hostOnlyMode: hostOnlyMode !== undefined ? hostOnlyMode : false,
    createdAt: now,
    updatedAt: now,
  };

  policies.set(roomId, newPolicy);

  logger.debug(
    { roomId, maxSpeakers: newPolicy.maxSpeakers, hostOnlyMode: newPolicy.hostOnlyMode },
    'Voice room policy created'
  );

  return newPolicy;
}

/**
 * Gets the policy for a room.
 *
 * @param roomId - The room ID to look up
 * @returns The policy if found, null otherwise
 */
export function getPolicy(roomId: string): VoiceRoomPolicy | null {
  return policies.get(roomId) || null;
}

/**
 * Deletes the policy for a room.
 *
 * @param roomId - The room ID to delete
 * @returns true if deleted, false if not found
 */
export function deletePolicy(roomId: string): boolean {
  const existed = policies.has(roomId);
  policies.delete(roomId);

  if (existed) {
    logger.debug({ roomId }, 'Voice room policy deleted');
  }

  return existed;
}

// ============================================================================
// MODERATION ACTION OPERATIONS
// ============================================================================

/**
 * Records a moderation action.
 *
 * Generates a unique ID and timestamp for the action.
 * Maintains a bounded list of actions per room (max 100).
 *
 * @param params - Action parameters (without id and createdAt)
 * @returns The recorded action with id and createdAt
 */
export function recordModerationAction(
  params: RecordModerationActionParams
): VoiceModerationAction {
  const { roomId, targetUserId, moderatorUserId, type, reason } = params;

  const action: VoiceModerationAction = {
    id: uuidv4(),
    roomId,
    targetUserId,
    moderatorUserId,
    type,
    reason,
    createdAt: new Date().toISOString(),
  };

  // Get or create actions array for this room
  let roomActions = moderationActions.get(roomId);
  if (!roomActions) {
    roomActions = [];
    moderationActions.set(roomId, roomActions);
  }

  // Add the new action
  roomActions.push(action);

  // Trim to max size (keep most recent)
  if (roomActions.length > MAX_ACTIONS_PER_ROOM) {
    const removed = roomActions.shift();
    logger.trace(
      { roomId, removedActionId: removed?.id },
      'Oldest moderation action removed due to limit'
    );
  }

  logger.info(
    {
      actionId: action.id,
      roomId,
      targetUserId,
      moderatorUserId,
      type,
      reason,
    },
    `[moderation] action=${type} room=${roomId} target=${targetUserId} moderator=${moderatorUserId}`
  );

  return action;
}

/**
 * Lists moderation actions for a room.
 *
 * Returns actions in chronological order (oldest first).
 *
 * @param roomId - The room ID to look up
 * @returns Array of moderation actions (empty if none)
 */
export function listModerationActions(roomId: string): VoiceModerationAction[] {
  return moderationActions.get(roomId) || [];
}

/**
 * Gets the count of moderation actions for a room.
 *
 * @param roomId - The room ID to look up
 * @returns Number of actions recorded
 */
export function countModerationActions(roomId: string): number {
  return moderationActions.get(roomId)?.length || 0;
}

/**
 * Deletes all moderation actions for a room.
 *
 * @param roomId - The room ID to clear
 * @returns Number of actions deleted
 */
export function clearModerationActions(roomId: string): number {
  const actions = moderationActions.get(roomId);
  const count = actions?.length || 0;
  moderationActions.delete(roomId);
  return count;
}

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Clears all policies and moderation actions.
 * Primarily for testing.
 */
export function clearAll(): void {
  policies.clear();
  moderationActions.clear();
  logger.debug('Voice policy store cleared');
}

/**
 * Gets the total count of policies.
 *
 * @returns Number of room policies stored
 */
export function countPolicies(): number {
  return policies.size;
}

/**
 * Gets all room IDs with policies.
 *
 * @returns Array of room IDs
 */
export function getAllPolicyRoomIds(): string[] {
  return Array.from(policies.keys());
}

// ============================================================================
// EXPORTED STORE OBJECT
// ============================================================================

/**
 * Voice policy store singleton.
 * Provides access to all policy and moderation action operations.
 */
export const voicePolicyStore = {
  // Policy operations
  upsertPolicy,
  getPolicy,
  deletePolicy,
  countPolicies,
  getAllPolicyRoomIds,

  // Moderation action operations
  recordModerationAction,
  listModerationActions,
  countModerationActions,
  clearModerationActions,

  // Utility
  clearAll,
};
