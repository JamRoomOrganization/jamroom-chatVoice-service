/**
 * @module internalController
 * @description Controller handlers for internal maintenance endpoints.
 *
 * These endpoints are designed for:
 * - Ops teams
 * - Cron jobs
 * - Kubernetes CronJobs
 * - Internal tooling
 *
 * NOT for frontend/client consumption.
 */

import type { Request, Response, NextFunction } from 'express';
import { buildSuccessResponse, createMeta } from '../utils/response';
import { renewExpiringSessions, getSessionExpirationStats } from '../services/voiceSessionMaintenance';
import type { RenewSessionsBody } from './internal.schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Response data for session renewal endpoint.
 */
interface RenewSessionsResponseData {
  /**
   * Number of sessions that were renewed.
   */
  renewed: number;

  /**
   * Total number of sessions that were expiring.
   */
  totalExpiring: number;

  /**
   * Number of sessions that failed to renew.
   */
  failed: number;

  /**
   * Threshold used for the operation (in seconds).
   */
  thresholdSeconds: number;
}

/**
 * Response data for session stats endpoint.
 */
interface SessionStatsResponseData {
  /**
   * Total number of active sessions.
   */
  total: number;

  /**
   * Number of sessions already expired.
   */
  expired: number;

  /**
   * Number of sessions expiring in the next 5 minutes.
   */
  expiringIn5Min: number;

  /**
   * Number of sessions expiring in the next 10 minutes.
   */
  expiringIn10Min: number;

  /**
   * Number of sessions expiring in the next 30 minutes.
   */
  expiringIn30Min: number;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * POST /internal/voice/sessions/renew
 *
 * Renews LiveKit tokens for all sessions expiring within the threshold.
 *
 * @example Request:
 * ```http
 * POST /internal/voice/sessions/renew
 * Content-Type: application/json
 *
 * { "thresholdSeconds": 600 }
 * ```
 *
 * @example Response:
 * ```json
 * {
 *   "data": {
 *     "renewed": 5,
 *     "totalExpiring": 5,
 *     "failed": 0,
 *     "thresholdSeconds": 600
 *   },
 *   "error": null,
 *   "meta": { "requestId": "...", "timestamp": "..." }
 * }
 * ```
 */
export async function renewSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as RenewSessionsBody;
    const thresholdSeconds = body.thresholdSeconds ?? 600;

    const result = await renewExpiringSessions(thresholdSeconds);

    const responseData: RenewSessionsResponseData = {
      renewed: result.renewed,
      totalExpiring: result.totalExpiring,
      failed: result.failed,
      thresholdSeconds,
    };

    const response = buildSuccessResponse(responseData, createMeta(req));
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /internal/voice/sessions/stats
 *
 * Returns statistics about session expiration states.
 * Useful for monitoring and alerting.
 *
 * @example Response:
 * ```json
 * {
 *   "data": {
 *     "total": 100,
 *     "expired": 0,
 *     "expiringIn5Min": 5,
 *     "expiringIn10Min": 10,
 *     "expiringIn30Min": 20
 *   },
 *   "error": null,
 *   "meta": { "requestId": "...", "timestamp": "..." }
 * }
 * ```
 */
export function getSessionStats(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const stats = getSessionExpirationStats();

  const responseData: SessionStatsResponseData = {
    total: stats.total,
    expired: stats.expired,
    expiringIn5Min: stats.expiringIn5Min,
    expiringIn10Min: stats.expiringIn10Min,
    expiringIn30Min: stats.expiringIn30Min,
  };

  const response = buildSuccessResponse(responseData, createMeta(req));
  res.status(200).json(response);
}
