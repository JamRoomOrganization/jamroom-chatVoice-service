/**
 * Health check types for readiness and liveness probes.
 *
 * Follows cloud-native health check patterns for Kubernetes
 * and container orchestrators.
 */

/**
 * Status of an individual health check.
 * - 'pass': Check passed successfully
 * - 'warn': Check passed but with warnings (degraded)
 * - 'fail': Check failed, dependency unavailable
 */
export type CheckStatus = 'pass' | 'fail' | 'warn';

/**
 * Result of a single health check.
 */
export interface HealthCheckResult {
  /**
   * Name of the check (e.g., 'database', 'livekit', 'redis')
   */
  name: string;

  /**
   * Status of this specific check
   */
  status: CheckStatus;

  /**
   * Optional details about the check result
   */
  details?: Record<string, unknown>;
}

/**
 * Overall health response data structure.
 * Used by /readyz endpoint.
 */
export interface HealthResponseData {
  /**
   * Overall status derived from all checks:
   * - 'pass' if all checks pass
   * - 'warn' if any check warns but none fail
   * - 'fail' if any check fails
   */
  status: CheckStatus;

  /**
   * Individual check results
   */
  checks: HealthCheckResult[];
}

/**
 * Simple liveness data for /healthz
 */
export interface LivenessData {
  status: 'ok';
  service: string;
}
