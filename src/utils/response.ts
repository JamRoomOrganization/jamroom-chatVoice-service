/**
 * Response Helpers
 *
 * Utility functions for building standardized API responses.
 * Ensures consistent response format across all endpoints.
 */

import { Request } from 'express';
import { ApiResponse, ApiErrorResponse, ResponseMeta, ApiError } from '../types/http';

/**
 * Creates response metadata with requestId and timestamp.
 *
 * @param req - Express request object (for requestId)
 * @returns ResponseMeta object
 */
export function createMeta(req: Request): ResponseMeta {
  return {
    requestId: req.requestId || 'unknown',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates metadata from a raw requestId string.
 * Useful in error handlers where Request might not be fully available.
 *
 * @param requestId - The request trace ID
 * @returns ResponseMeta object
 */
export function createMetaFromRequestId(requestId: string): ResponseMeta {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a standardized success response.
 *
 * @param data - The response payload
 * @param meta - Response metadata (requestId, timestamp)
 * @returns Formatted ApiResponse
 *
 * @example
 * ```typescript
 * const response = buildSuccessResponse(
 *   { status: 'ok', service: 'chatVoice-service' },
 *   createMeta(req)
 * );
 * res.status(200).json(response);
 * ```
 */
export function buildSuccessResponse<T>(
  data: T,
  meta: ResponseMeta
): ApiResponse<T> {
  return {
    data,
    error: null,
    meta,
  };
}

/**
 * Builds a standardized error response.
 *
 * @param error - Error details (code, message, details)
 * @param meta - Response metadata (requestId, timestamp)
 * @returns Formatted ApiErrorResponse
 *
 * @example
 * ```typescript
 * const response = buildErrorResponse(
 *   { code: 'NOT_FOUND', message: 'Resource not found', details: {} },
 *   createMeta(req)
 * );
 * res.status(404).json(response);
 * ```
 */
export function buildErrorResponse(
  error: ApiError,
  meta: ResponseMeta
): ApiErrorResponse {
  return {
    data: null,
    error,
    meta,
  };
}

/**
 * Convenience function to build and send a success response.
 *
 * @param req - Express request
 * @param data - Response payload
 * @returns ApiResponse ready to send
 */
export function successResponse<T>(req: Request, data: T): ApiResponse<T> {
  return buildSuccessResponse(data, createMeta(req));
}
