/**
 * @module voiceResilience
 * @description Utilities for graceful degradation and resilience in voice operations.
 *
 * This module provides:
 * - Error classification for voice operations
 * - Retry logic with exponential backoff
 * - Safe wrapper functions for best-effort operations
 * - Structured logging helpers for voice failures
 *
 * Design principles:
 * - Voice failures should NEVER break text/music functionality
 * - Errors are classified for appropriate handling
 * - Best-effort operations log but don't throw
 * - All failures are logged with consistent structure
 */

import { logger } from '../middleware/logger';
import { AppError, ErrorCodes } from '../types/http';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Classification of voice operation errors.
 */
export type VoiceErrorType =
  | 'VOICE_SERVICE_UNAVAILABLE' // Voice service is down or unreachable
  | 'LIVEKIT_UNAVAILABLE' // LiveKit SFU is down
  | 'TOKEN_EXPIRED' // Token has expired
  | 'VALIDATION_ERROR' // Input validation failed
  | 'NOT_FOUND' // Resource not found (participant, room)
  | 'TRANSIENT' // Temporary error, safe to retry
  | 'PERMANENT'; // Permanent error, don't retry

/**
 * Result of error classification.
 */
export interface ErrorClassification {
  type: VoiceErrorType;
  isRetryable: boolean;
  shouldNotify: boolean;
  message: string;
}

/**
 * Options for retry operations.
 */
export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Result of a best-effort operation.
 */
export interface BestEffortResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Context for voice operation logging.
 */
export interface VoiceOperationContext {
  op: string;
  roomId: string;
  userId: string;
  requestId?: string;
  socketId?: string;
  [key: string]: unknown;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classifies an error for appropriate handling in voice operations.
 *
 * @param error - The error to classify
 * @returns Classification with type, retryability, and notification flags
 */
export function classifyVoiceError(error: unknown): ErrorClassification {
  // Handle AppError instances
  if (error instanceof AppError) {
    switch (error.code) {
      case ErrorCodes.VOICE_SERVICE_UNAVAILABLE:
        return {
          type: 'VOICE_SERVICE_UNAVAILABLE',
          isRetryable: false,
          shouldNotify: true,
          message: error.message,
        };

      case ErrorCodes.DEPENDENCY_UNAVAILABLE:
        return {
          type: 'LIVEKIT_UNAVAILABLE',
          isRetryable: true,
          shouldNotify: true,
          message: error.message,
        };

      case ErrorCodes.VALIDATION_ERROR:
      case ErrorCodes.BAD_REQUEST:
        return {
          type: 'VALIDATION_ERROR',
          isRetryable: false,
          shouldNotify: false,
          message: error.message,
        };

      case ErrorCodes.NOT_FOUND:
        return {
          type: 'NOT_FOUND',
          isRetryable: false,
          shouldNotify: false,
          message: error.message,
        };

      default:
        return {
          type: 'PERMANENT',
          isRetryable: false,
          shouldNotify: true,
          message: error.message,
        };
    }
  }

  // Handle standard Error
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network/connection errors - transient
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket hang up') ||
      message.includes('network')
    ) {
      return {
        type: 'TRANSIENT',
        isRetryable: true,
        shouldNotify: true,
        message: error.message,
      };
    }

    // Service unavailable indicators
    if (
      message.includes('service unavailable') ||
      message.includes('503') ||
      message.includes('temporarily unavailable')
    ) {
      return {
        type: 'VOICE_SERVICE_UNAVAILABLE',
        isRetryable: true,
        shouldNotify: true,
        message: error.message,
      };
    }

    // Token expiration
    if (message.includes('token') && message.includes('expired')) {
      return {
        type: 'TOKEN_EXPIRED',
        isRetryable: false,
        shouldNotify: false,
        message: error.message,
      };
    }

    // Default: permanent error
    return {
      type: 'PERMANENT',
      isRetryable: false,
      shouldNotify: true,
      message: error.message,
    };
  }

  // Unknown error type
  return {
    type: 'PERMANENT',
    isRetryable: false,
    shouldNotify: true,
    message: String(error),
  };
}

/**
 * Checks if an error indicates voice service unavailability.
 *
 * @param error - The error to check
 * @returns true if the error indicates voice service is unavailable
 */
export function isVoiceServiceUnavailable(error: unknown): boolean {
  const classification = classifyVoiceError(error);
  return (
    classification.type === 'VOICE_SERVICE_UNAVAILABLE' ||
    classification.type === 'LIVEKIT_UNAVAILABLE'
  );
}

/**
 * Converts any error to an AppError with appropriate code.
 *
 * @param error - The error to convert
 * @param context - Optional context for the error
 * @returns An AppError instance
 */
export function toVoiceAppError(
  error: unknown,
  context?: Partial<VoiceOperationContext>
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const classification = classifyVoiceError(error);

  switch (classification.type) {
    case 'VOICE_SERVICE_UNAVAILABLE':
      return AppError.voiceServiceUnavailable(classification.message, context);

    case 'LIVEKIT_UNAVAILABLE':
      return AppError.dependencyUnavailable(
        `LiveKit unavailable: ${classification.message}`,
        context
      );

    case 'VALIDATION_ERROR':
      return AppError.validationError(classification.message, context);

    case 'NOT_FOUND':
      return AppError.notFound(classification.message, context);

    default:
      return AppError.internal(classification.message, context);
  }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Calculates exponential backoff delay with jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * options.baseDelayMs;
  return Math.min(exponentialDelay + jitter, options.maxDelayMs);
}

/**
 * Executes an async function with retry logic.
 *
 * @param fn - The async function to execute
 * @param options - Retry options
 * @returns The function result or throws after all retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const classification = classifyVoiceError(error);

      // Don't retry non-retryable errors
      if (!classification.isRetryable) {
        throw lastError;
      }

      // Don't retry if we've exhausted retries
      if (attempt >= opts.maxRetries) {
        throw lastError;
      }

      // Notify about retry attempt
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError);
      }

      // Wait before retry
      const delay = calculateBackoff(attempt, opts);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

// ============================================================================
// BEST-EFFORT OPERATIONS
// ============================================================================

/**
 * Executes an operation as best-effort (doesn't throw on failure).
 *
 * Use this for cleanup operations where failure should be logged
 * but not propagated to callers.
 *
 * @param fn - The async function to execute
 * @param context - Context for logging on failure
 * @returns Result object with success flag and optional data/error
 */
export async function bestEffort<T>(
  fn: () => Promise<T>,
  context: VoiceOperationContext
): Promise<BestEffortResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const classification = classifyVoiceError(error);

    logger.warn(
      {
        ...context,
        status: 'best_effort_failed',
        errorType: classification.type,
        errorMessage: classification.message,
        isRetryable: classification.isRetryable,
      },
      `[voice-resilience] op=${context.op} status=best_effort_failed room=${context.roomId} user=${context.userId}`
    );

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Executes a cleanup operation as best-effort with retry.
 *
 * Useful for session deletion where we want to try a couple times
 * but not block the caller on failure.
 *
 * @param fn - The async function to execute
 * @param context - Context for logging
 * @param maxRetries - Maximum retry attempts (default: 1)
 * @returns Result object with success flag
 */
export async function bestEffortWithRetry<T>(
  fn: () => Promise<T>,
  context: VoiceOperationContext,
  maxRetries = 1
): Promise<BestEffortResult<T>> {
  try {
    const data = await withRetry(fn, {
      maxRetries,
      onRetry: (attempt, error) => {
        logger.debug(
          {
            ...context,
            status: 'retry',
            attempt,
            error: error.message,
          },
          `[voice-resilience] op=${context.op} status=retry attempt=${attempt} room=${context.roomId} user=${context.userId}`
        );
      },
    });

    return { success: true, data };
  } catch (error) {
    const classification = classifyVoiceError(error);

    logger.warn(
      {
        ...context,
        status: 'best_effort_exhausted',
        errorType: classification.type,
        errorMessage: classification.message,
      },
      `[voice-resilience] op=${context.op} status=best_effort_exhausted room=${context.roomId} user=${context.userId}`
    );

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

/**
 * Logs a voice operation failure with consistent structure.
 *
 * @param context - Operation context
 * @param error - The error that occurred
 */
export function logVoiceFailure(
  context: VoiceOperationContext,
  error: unknown
): void {
  const classification = classifyVoiceError(error);

  logger.error(
    {
      ...context,
      status: classification.type.toLowerCase(),
      errorType: classification.type,
      errorMessage: classification.message,
      isRetryable: classification.isRetryable,
    },
    `[voice-resilience] op=${context.op} status=${classification.type.toLowerCase()} room=${context.roomId} user=${context.userId}`
  );
}

/**
 * Logs a voice service unavailable error with consistent structure.
 *
 * @param context - Operation context
 * @param error - The error that occurred
 */
export function logVoiceServiceUnavailable(
  context: VoiceOperationContext,
  error: unknown
): void {
  const classification = classifyVoiceError(error);

  logger.error(
    {
      ...context,
      status: 'voice_service_unavailable',
      errorType: classification.type,
      errorMessage: classification.message,
    },
    `[voice-resilience] op=${context.op} status=voice_service_unavailable room=${context.roomId} user=${context.userId}`
  );
}

/**
 * Logs a successful voice operation for debugging.
 *
 * @param context - Operation context
 */
export function logVoiceSuccess(context: VoiceOperationContext): void {
  logger.debug(
    {
      ...context,
      status: 'ok',
    },
    `[voice-resilience] op=${context.op} status=ok room=${context.roomId} user=${context.userId}`
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const voiceResilience = {
  classifyVoiceError,
  isVoiceServiceUnavailable,
  toVoiceAppError,
  calculateBackoff,
  withRetry,
  bestEffort,
  bestEffortWithRetry,
  logVoiceFailure,
  logVoiceServiceUnavailable,
  logVoiceSuccess,
};

export default voiceResilience;
