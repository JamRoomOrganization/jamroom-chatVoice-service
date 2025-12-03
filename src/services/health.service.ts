/**
 * Health Service
 *
 * Provides functionality for running readiness checks against
 * service dependencies. Follows cloud-native patterns for
 * health probes.
 */

import {
  CheckStatus,
  HealthCheckResult,
  HealthResponseData,
} from '../types/health';

/**
 * Interface for a readiness check.
 * Each dependency (DB, LiveKit, Redis, etc.) implements this.
 */
export interface ReadinessCheck {
  /**
   * Human-readable name for the check
   */
  name: string;

  /**
   * Async function that performs the check and returns the result
   */
  check: () => Promise<HealthCheckResult>;
}

/**
 * Derives overall status from individual check results.
 *
 * @param results - Array of individual check results
 * @returns Overall status: 'pass', 'warn', or 'fail'
 */
function deriveOverallStatus(results: HealthCheckResult[]): CheckStatus {
  const hasFail = results.some((r) => r.status === 'fail');
  const hasWarn = results.some((r) => r.status === 'warn');

  if (hasFail) return 'fail';
  if (hasWarn) return 'warn';
  return 'pass';
}

/**
 * Runs all provided readiness checks and aggregates results.
 *
 * @param checks - Array of readiness checks to run
 * @returns Aggregated health response with overall status
 *
 * @example
 * ```typescript
 * const checks: ReadinessCheck[] = [
 *   { name: 'database', check: checkDatabase },
 *   { name: 'livekit', check: checkLiveKit },
 * ];
 *
 * const result = await runReadinessChecks(checks);
 * // { status: 'pass', checks: [...] }
 * ```
 */
export async function runReadinessChecks(
  checks: ReadinessCheck[]
): Promise<HealthResponseData> {
  // If no checks provided, return pass with empty checks
  if (checks.length === 0) {
    return {
      status: 'pass',
      checks: [],
    };
  }

  // Run all checks in parallel
  const results = await Promise.all(
    checks.map(async (c) => {
      try {
        return await c.check();
      } catch (error) {
        // If a check throws, treat it as a failure
        return {
          name: c.name,
          status: 'fail' as CheckStatus,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    })
  );

  const overallStatus = deriveOverallStatus(results);

  return {
    status: overallStatus,
    checks: results,
  };
}

/**
 * Built-in check: Self check (always passes if the service is running)
 * This is a minimal check to ensure the service is operational.
 */
export const selfCheck: ReadinessCheck = {
  name: 'self',
  check: async (): Promise<HealthCheckResult> => {
    return {
      name: 'self',
      status: 'pass',
      details: {
        message: 'Service is operational',
      },
    };
  },
};

/**
 * Creates a check for future LiveKit integration.
 * Currently returns pass as LiveKit is not yet implemented.
 *
 * @returns ReadinessCheck for LiveKit
 */
export function createLiveKitCheck(): ReadinessCheck {
  return {
    name: 'livekit',
    check: async (): Promise<HealthCheckResult> => {
      // TODO: Implement real LiveKit check when integrated
      // For now, return pass as LiveKit is not yet required
      return {
        name: 'livekit',
        status: 'pass',
        details: {
          message: 'LiveKit integration pending - check skipped',
          implemented: false,
        },
      };
    },
  };
}

/**
 * Default readiness checks for the service.
 * Add new checks here as dependencies are integrated.
 */
export const defaultReadinessChecks: ReadinessCheck[] = [
  selfCheck,
  // Future checks:
  // createLiveKitCheck(),
  // createDatabaseCheck(),
  // createRedisCheck(),
];
