/**
 * @module voiceSessionMaintenance
 * @description Service for maintaining VoiceSession lifecycle, including token renewal.
 *
 * This service handles:
 * - Token expiration detection
 * - Automatic token renewal for expiring sessions
 * - Session cleanup and maintenance operations
 *
 * Designed to be called by internal endpoints (ops, cron jobs, Kubernetes CronJobs).
 */

import { logger } from '../middleware/logger';
import * as voiceSessionStore from './voiceSessionStore';
import { issueTokenForUser } from './livekitAdapter';
import { metrics } from './metrics';
import type { VoiceSession } from '../types/voice';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of a session renewal operation.
 */
export interface RenewalResult {
  /**
   * Total number of sessions that were due for renewal.
   */
  totalExpiring: number;

  /**
   * Number of sessions successfully renewed.
   */
  renewed: number;

  /**
   * Number of sessions that failed to renew.
   */
  failed: number;

  /**
   * Session IDs that failed to renew (for debugging).
   */
  failedSessionIds: string[];
}

/**
 * Callback function type for issuing tokens.
 * Allows dependency injection for testing.
 */
export type TokenIssuer = typeof issueTokenForUser;

// ============================================================================
// MAINTENANCE OPERATIONS
// ============================================================================

/**
 * Renews LiveKit tokens for all sessions that are close to expiring.
 *
 * For each session whose token expires within `thresholdSeconds`:
 * 1. Generates a new token using the same roomId, userId, and permission flags.
 * 2. Updates the session with the new LiveKit token info.
 * 3. Logs success or failure for observability.
 *
 * @param thresholdSeconds - Renew sessions expiring within this many seconds
 * @param tokenIssuer - Optional token issuer function (for testing)
 * @returns Detailed result of the renewal operation
 *
 * @example
 * ```typescript
 * // Renew all sessions expiring in the next 10 minutes
 * const result = await renewExpiringSessions(600);
 * console.log(`Renewed ${result.renewed} sessions`);
 * ```
 */
export async function renewExpiringSessions(
  thresholdSeconds: number,
  tokenIssuer: TokenIssuer = issueTokenForUser
): Promise<RenewalResult> {
  const result: RenewalResult = {
    totalExpiring: 0,
    renewed: 0,
    failed: 0,
    failedSessionIds: [],
  };

  // Get all sessions expiring within threshold
  const expiringSessions = voiceSessionStore.listExpiringSessions(thresholdSeconds);
  result.totalExpiring = expiringSessions.length;

  if (expiringSessions.length === 0) {
    logger.debug(
      { thresholdSeconds },
      'No sessions found expiring within threshold'
    );
    return result;
  }

  logger.info(
    { count: expiringSessions.length, thresholdSeconds },
    'Starting token renewal for expiring sessions'
  );

  // Process each expiring session
  for (const session of expiringSessions) {
    try {
      // Store old expiration for logging
      const oldExpiration = session.livekit.expiresAt;

      await renewSession(session, tokenIssuer);
      result.renewed++;

      // Get updated session for new expiration
      const updatedSession = voiceSessionStore.getSession(session.sessionId);
      const newExpiration = updatedSession?.livekit.expiresAt || 'unknown';

      // Record metric
      metrics.voiceSessionsRenewed.inc();
      
      // Enhanced logging with old/new expiration per spec
      logger.info(
        {
          sessionId: session.sessionId,
          roomId: session.roomId,
          userId: session.userId,
          oldExpiration,
          newExpiration,
        },
        `[voice] renew_token room=${session.roomId} user=${session.userId} session=${session.sessionId} old_exp=${oldExpiration} new_exp=${newExpiration}`
      );
    } catch (error) {
      result.failed++;
      result.failedSessionIds.push(session.sessionId);

      // Record failure metric
      metrics.voiceSessionsRenewalFailed.inc();

      logger.error(
        {
          err: error,
          sessionId: session.sessionId,
          roomId: session.roomId,
          userId: session.userId,
        },
        'Failed to renew session token'
      );
    }
  }

  logger.info(
    {
      totalExpiring: result.totalExpiring,
      renewed: result.renewed,
      failed: result.failed,
    },
    'Completed session token renewal'
  );

  return result;
}

/**
 * Renews a single session's LiveKit token.
 *
 * @param session - The session to renew
 * @param tokenIssuer - Function to issue new tokens
 * @throws If token issuance or session update fails
 */
async function renewSession(
  session: VoiceSession,
  tokenIssuer: TokenIssuer
): Promise<void> {
  // Generate new token with same parameters
  const newTokenInfo = await tokenIssuer({
    roomId: session.roomId,
    userId: session.userId,
    username: session.username,
    canPublishAudio: session.canPublishAudio,
    canSubscribe: session.canSubscribe,
  });

  // Update session with new token info
  const updated = voiceSessionStore.updateSession(session.sessionId, {
    livekit: newTokenInfo,
  });

  if (!updated) {
    throw new Error(`Session ${session.sessionId} not found during renewal update`);
  }
}

/**
 * Gets statistics about session expiration states.
 *
 * Useful for observability and alerting.
 *
 * @returns Statistics about session states
 */
export function getSessionExpirationStats(): {
  total: number;
  expiringIn5Min: number;
  expiringIn10Min: number;
  expiringIn30Min: number;
  expired: number;
} {
  const total = voiceSessionStore.countSessions();
  const now = Date.now();
  const allSessions = voiceSessionStore.getAllSessions();

  let expired = 0;
  let expiringIn5Min = 0;
  let expiringIn10Min = 0;
  let expiringIn30Min = 0;

  for (const session of allSessions) {
    const expiresAt = new Date(session.livekit.expiresAt).getTime();
    const timeToExpiry = expiresAt - now;

    if (timeToExpiry <= 0) {
      expired++;
    } else {
      // Cumulative counting: sessions expiring in 5min also count toward 10min and 30min
      if (timeToExpiry <= 5 * 60 * 1000) {
        expiringIn5Min++;
      }
      if (timeToExpiry <= 10 * 60 * 1000) {
        expiringIn10Min++;
      }
      if (timeToExpiry <= 30 * 60 * 1000) {
        expiringIn30Min++;
      }
    }
  }

  return {
    total,
    expired,
    expiringIn5Min,
    expiringIn10Min,
    expiringIn30Min,
  };
}
