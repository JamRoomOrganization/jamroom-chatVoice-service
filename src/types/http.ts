/**
 * Standard HTTP response types for the chatVoice-service.
 * All responses follow a consistent wrapper format for predictable client handling.
 */

/**
 * Metadata included in every response.
 */
export interface ResponseMeta {
  /**
   * Unique identifier for request tracing.
   * Either passed via x-request-id header or generated as UUID v4.
   */
  requestId: string;

  /**
   * ISO 8601 timestamp of when the response was generated.
   */
  timestamp: string;
}

/**
 * Standard error structure for error responses.
 */
export interface ApiError {
  /**
   * Machine-readable error code.
   * Examples: "INTERNAL_ERROR", "VALIDATION_ERROR", "NOT_FOUND"
   */
  code: string;

  /**
   * Human-readable error message.
   */
  message: string;

  /**
   * Additional error details (optional).
   * Should never contain sensitive information.
   */
  details: Record<string, unknown>;
}

/**
 * Standard API response wrapper.
 * All successful responses use this format.
 *
 * @template T The type of data in the response.
 */
export interface ApiResponse<T> {
  /**
   * Response payload. Null for error responses.
   */
  data: T;

  /**
   * Error information. Null for successful responses.
   */
  error: null;

  /**
   * Response metadata including requestId and timestamp.
   */
  meta: ResponseMeta;
}

/**
 * Standard API error response wrapper.
 * All error responses use this format.
 */
export interface ApiErrorResponse {
  /**
   * Always null for error responses.
   */
  data: null;

  /**
   * Error information.
   */
  error: ApiError;

  /**
   * Response metadata including requestId and timestamp.
   */
  meta: ResponseMeta;
}

/**
 * Known error codes used by the service.
 * Extensible taxonomy for different error scenarios.
 */
export const ErrorCodes = {
  /** Generic internal server error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Request payload validation failed */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Requested resource not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Malformed request */
  BAD_REQUEST: 'BAD_REQUEST',
  /** Authentication required */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Insufficient permissions */
  FORBIDDEN: 'FORBIDDEN',
  /** Resource conflict (e.g., duplicate) */
  CONFLICT: 'CONFLICT',
  /** External dependency unavailable (DB, LiveKit, Redis) */
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  /** Voice service unavailable - enables graceful degradation */
  VOICE_SERVICE_UNAVAILABLE: 'VOICE_SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Maps error codes to their default HTTP status codes.
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.DEPENDENCY_UNAVAILABLE]: 503,
  [ErrorCodes.VOICE_SERVICE_UNAVAILABLE]: 503,
};

/**
 * Custom application error with support for error codes and HTTP status.
 * Use this class for all domain/application errors to ensure consistent
 * error handling and response formatting.
 *
 * @example
 * ```typescript
 * // Using default HTTP status from ErrorCodeToHttpStatus
 * throw new AppError('NOT_FOUND', 'User not found');
 *
 * // With custom HTTP status
 * throw new AppError('VALIDATION_ERROR', 'Invalid email format', 422, { field: 'email' });
 *
 * // Using factory methods
 * throw AppError.notFound('User not found');
 * throw AppError.validationError('Invalid input', { field: 'email' });
 * ```
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus?: number,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus ?? ErrorCodeToHttpStatus[code] ?? 500;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Factory: Creates a NOT_FOUND error
   */
  static notFound(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.NOT_FOUND, message, 404, details);
  }

  /**
   * Factory: Creates a VALIDATION_ERROR
   */
  static validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details);
  }

  /**
   * Factory: Creates a BAD_REQUEST error
   */
  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.BAD_REQUEST, message, 400, details);
  }

  /**
   * Factory: Creates an UNAUTHORIZED error
   */
  static unauthorized(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.UNAUTHORIZED, message, 401, details);
  }

  /**
   * Factory: Creates a FORBIDDEN error
   */
  static forbidden(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.FORBIDDEN, message, 403, details);
  }

  /**
   * Factory: Creates a CONFLICT error
   */
  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.CONFLICT, message, 409, details);
  }

  /**
   * Factory: Creates a DEPENDENCY_UNAVAILABLE error
   */
  static dependencyUnavailable(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.DEPENDENCY_UNAVAILABLE, message, 503, details);
  }

  /**
   * Factory: Creates a VOICE_SERVICE_UNAVAILABLE error.
   * Used for graceful degradation when voice operations fail.
   * Allows sync-service to continue with text/music while voice is unavailable.
   */
  static voiceServiceUnavailable(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.VOICE_SERVICE_UNAVAILABLE, message, 503, details);
  }

  /**
   * Factory: Creates an INTERNAL_ERROR
   */
  static internal(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, details);
  }
}

/**
 * Health check status response data.
 * @deprecated Use LivenessData from './health' instead
 */
export interface HealthData {
  status: 'ok' | 'degraded' | 'unhealthy';
  service: string;
}

/**
 * Readiness check response data.
 * @deprecated Use HealthResponseData from './health' instead
 */
export interface ReadyData {
  status: 'ready' | 'not_ready';
  checks?: Record<string, boolean>;
}
