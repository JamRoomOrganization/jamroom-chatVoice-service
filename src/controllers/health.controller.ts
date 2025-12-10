import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { LivenessData, HealthResponseData } from '../types/health';
import { buildSuccessResponse, createMeta } from '../utils/response';
import {
  runReadinessChecks,
  defaultReadinessChecks,
  ReadinessCheck,
} from '../services/health.service';

/**
 * Health check controller.
 *
 * GET /healthz
 *
 * Lightweight liveness probe - only checks if the process is running.
 * This endpoint should always return 200 if the service is alive.
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "status": "ok",
 *     "service": "chatVoice-service"
 *   },
 *   "error": null,
 *   "meta": {
 *     "requestId": "<uuid>",
 *     "timestamp": "<ISO8601>"
 *   }
 * }
 * ```
 */
export function healthCheck(req: Request, res: Response): void {
  const livenessData: LivenessData = {
    status: 'ok',
    service: config.serviceName,
  };

  const response = buildSuccessResponse(livenessData, createMeta(req));

  res.status(200).json(response);
}

/**
 * Readiness check controller.
 *
 * GET /readyz
 *
 * Comprehensive readiness probe that checks all service dependencies.
 * Used by orchestrators (e.g., Kubernetes) to determine if the service
 * is ready to accept traffic.
 *
 * Returns:
 * - 200 if all checks pass or only warnings
 * - 503 if any check fails
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "status": "pass",
 *     "checks": [
 *       { "name": "self", "status": "pass", "details": {...} }
 *     ]
 *   },
 *   "error": null,
 *   "meta": {
 *     "requestId": "<uuid>",
 *     "timestamp": "<ISO8601>"
 *   }
 * }
 * ```
 */
export async function readinessCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Run all configured readiness checks
    const readinessData = await runReadinessChecks(defaultReadinessChecks);

    // Determine HTTP status based on overall check status
    const httpStatus = readinessData.status === 'fail' ? 503 : 200;

    const response = buildSuccessResponse(readinessData, createMeta(req));

    res.status(httpStatus).json(response);
  } catch (error) {
    // Pass unexpected errors to the error handler
    next(error);
  }
}

/**
 * Creates a readiness check handler with custom checks.
 * Useful for testing or custom configurations.
 *
 * @param checks - Array of custom readiness checks
 * @returns Express route handler
 */
export function createReadinessHandler(checks: ReadinessCheck[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const readinessData = await runReadinessChecks(checks);
      const httpStatus = readinessData.status === 'fail' ? 503 : 200;
      const response = buildSuccessResponse(readinessData, createMeta(req));
      res.status(httpStatus).json(response);
    } catch (error) {
      next(error);
    }
  };
}
