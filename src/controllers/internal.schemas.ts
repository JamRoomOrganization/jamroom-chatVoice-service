/**
 * @module internal.schemas
 * @description Zod schemas for internal maintenance endpoints.
 */

import { z } from 'zod';

// ============================================================================
// RENEW SESSIONS SCHEMAS
// ============================================================================

/**
 * Schema for POST /internal/voice/sessions/renew body.
 *
 * @example
 * ```json
 * { "thresholdSeconds": 600 }
 * ```
 */
export const RenewSessionsBodySchema = z.object({
  /**
   * Renew sessions expiring within this many seconds.
   * Defaults to 600 (10 minutes) if not provided.
   */
  thresholdSeconds: z
    .number()
    .int()
    .positive('thresholdSeconds must be a positive integer')
    .max(86400, 'thresholdSeconds cannot exceed 86400 (24 hours)')
    .default(600)
    .describe('Threshold in seconds for considering sessions as expiring'),
});

/**
 * TypeScript type for renew sessions body.
 */
export type RenewSessionsBody = z.infer<typeof RenewSessionsBodySchema>;
