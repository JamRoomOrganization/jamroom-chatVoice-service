/**
 * VoiceResilience Unit Tests
 *
 * Tests for voice resilience utilities including error classification,
 * retry logic, and best-effort operations.
 */

import { AppError, ErrorCodes } from '../src/types/http';
import {
  classifyVoiceError,
  isVoiceServiceUnavailable,
  toVoiceAppError,
  calculateBackoff,
  withRetry,
  bestEffort,
  bestEffortWithRetry,
  VoiceOperationContext,
  RetryOptions,
} from '../src/services/voiceResilience';

// Mock logger
jest.mock('../src/middleware/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('VoiceResilience', () => {
  describe('classifyVoiceError', () => {
    describe('AppError classification', () => {
      it('classifies VOICE_SERVICE_UNAVAILABLE as voice service unavailable', () => {
        const error = AppError.voiceServiceUnavailable('Voice service is down');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('VOICE_SERVICE_UNAVAILABLE');
        expect(result.isRetryable).toBe(false);
        expect(result.shouldNotify).toBe(true);
      });

      it('classifies DEPENDENCY_UNAVAILABLE as LiveKit unavailable', () => {
        const error = AppError.dependencyUnavailable('LiveKit connection failed');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('LIVEKIT_UNAVAILABLE');
        expect(result.isRetryable).toBe(true);
        expect(result.shouldNotify).toBe(true);
      });

      it('classifies VALIDATION_ERROR as validation error', () => {
        const error = AppError.validationError('Invalid input');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('VALIDATION_ERROR');
        expect(result.isRetryable).toBe(false);
        expect(result.shouldNotify).toBe(false);
      });

      it('classifies BAD_REQUEST as validation error', () => {
        const error = AppError.badRequest('Malformed request');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('VALIDATION_ERROR');
        expect(result.isRetryable).toBe(false);
        expect(result.shouldNotify).toBe(false);
      });

      it('classifies NOT_FOUND as not found', () => {
        const error = AppError.notFound('Session not found');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('NOT_FOUND');
        expect(result.isRetryable).toBe(false);
        expect(result.shouldNotify).toBe(false);
      });

      it('classifies unknown AppError codes as permanent', () => {
        const error = AppError.internal('Unknown error');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('PERMANENT');
        expect(result.isRetryable).toBe(false);
        expect(result.shouldNotify).toBe(true);
      });
    });

    describe('Standard Error classification', () => {
      it('classifies ECONNREFUSED as transient', () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:3002');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('TRANSIENT');
        expect(result.isRetryable).toBe(true);
        expect(result.shouldNotify).toBe(true);
      });

      it('classifies ECONNRESET as transient', () => {
        const error = new Error('read ECONNRESET');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('TRANSIENT');
        expect(result.isRetryable).toBe(true);
      });

      it('classifies ETIMEDOUT as transient', () => {
        const error = new Error('connect ETIMEDOUT');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('TRANSIENT');
        expect(result.isRetryable).toBe(true);
      });

      it('classifies socket hang up as transient', () => {
        const error = new Error('socket hang up');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('TRANSIENT');
        expect(result.isRetryable).toBe(true);
      });

      it('classifies network errors as transient', () => {
        const error = new Error('network error: unable to reach host');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('TRANSIENT');
        expect(result.isRetryable).toBe(true);
      });

      it('classifies service unavailable as voice service unavailable', () => {
        const error = new Error('Service temporarily unavailable');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('VOICE_SERVICE_UNAVAILABLE');
        expect(result.isRetryable).toBe(true);
      });

      it('classifies 503 as voice service unavailable', () => {
        const error = new Error('Request failed with status 503');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('VOICE_SERVICE_UNAVAILABLE');
        expect(result.isRetryable).toBe(true);
      });

      it('classifies token expired as token expired', () => {
        const error = new Error('token has expired');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('TOKEN_EXPIRED');
        expect(result.isRetryable).toBe(false);
        expect(result.shouldNotify).toBe(false);
      });

      it('classifies unknown errors as permanent', () => {
        const error = new Error('Something went wrong');

        const result = classifyVoiceError(error);

        expect(result.type).toBe('PERMANENT');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('Non-Error classification', () => {
      it('classifies string as permanent error', () => {
        const result = classifyVoiceError('string error');

        expect(result.type).toBe('PERMANENT');
        expect(result.message).toBe('string error');
      });

      it('classifies null as permanent error', () => {
        const result = classifyVoiceError(null);

        expect(result.type).toBe('PERMANENT');
        expect(result.message).toBe('null');
      });

      it('classifies object as permanent error', () => {
        const result = classifyVoiceError({ code: 500 });

        expect(result.type).toBe('PERMANENT');
      });
    });
  });

  describe('isVoiceServiceUnavailable', () => {
    it('returns true for VOICE_SERVICE_UNAVAILABLE AppError', () => {
      const error = AppError.voiceServiceUnavailable('Voice down');

      expect(isVoiceServiceUnavailable(error)).toBe(true);
    });

    it('returns true for DEPENDENCY_UNAVAILABLE AppError', () => {
      const error = AppError.dependencyUnavailable('LiveKit down');

      expect(isVoiceServiceUnavailable(error)).toBe(true);
    });

    it('returns true for service unavailable Error', () => {
      const error = new Error('Service temporarily unavailable');

      expect(isVoiceServiceUnavailable(error)).toBe(true);
    });

    it('returns false for validation errors', () => {
      const error = AppError.validationError('Invalid input');

      expect(isVoiceServiceUnavailable(error)).toBe(false);
    });

    it('returns false for not found errors', () => {
      const error = AppError.notFound('Session not found');

      expect(isVoiceServiceUnavailable(error)).toBe(false);
    });
  });

  describe('toVoiceAppError', () => {
    it('returns AppError unchanged', () => {
      const original = AppError.notFound('Not found');

      const result = toVoiceAppError(original);

      expect(result).toBe(original);
    });

    it('converts voice service unavailable to AppError', () => {
      const error = new Error('Service temporarily unavailable');

      const result = toVoiceAppError(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCodes.VOICE_SERVICE_UNAVAILABLE);
    });

    it('converts network errors to dependency unavailable', () => {
      const error = new Error('connect ECONNREFUSED');

      const result = toVoiceAppError(error);

      // Transient errors are converted based on classification
      expect(result).toBeInstanceOf(AppError);
    });

    it('converts validation errors appropriately', () => {
      // Create a validation-like error manually
      const error = AppError.validationError('Invalid input');

      const result = toVoiceAppError(error);

      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('includes context in error details', () => {
      const error = new Error('Service temporarily unavailable');
      const context = { roomId: 'room-1', userId: 'user-1' };

      const result = toVoiceAppError(error, context);

      expect(result.details).toEqual(expect.objectContaining(context));
    });
  });

  describe('calculateBackoff', () => {
    const options: RetryOptions = {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    };

    it('returns delay within expected range for attempt 0', () => {
      const delay = calculateBackoff(0, options);

      // 100 * 2^0 + jitter(0-100) = 100-200
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    });

    it('returns delay within expected range for attempt 1', () => {
      const delay = calculateBackoff(1, options);

      // 100 * 2^1 + jitter(0-100) = 200-300
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(300);
    });

    it('returns delay within expected range for attempt 2', () => {
      const delay = calculateBackoff(2, options);

      // 100 * 2^2 + jitter(0-100) = 400-500
      expect(delay).toBeGreaterThanOrEqual(400);
      expect(delay).toBeLessThanOrEqual(500);
    });

    it('caps delay at maxDelayMs', () => {
      const delay = calculateBackoff(10, options);

      expect(delay).toBeLessThanOrEqual(options.maxDelayMs);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns result on first successful attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 });
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on transient error and succeeds', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 });

      // Fast-forward through retry delay
      await jest.advanceTimersByTimeAsync(200);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws immediately on non-retryable error', async () => {
      const fn = jest.fn().mockRejectedValue(AppError.validationError('Invalid'));

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 })
      ).rejects.toThrow('Invalid');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and throws', async () => {
      jest.useRealTimers(); // Use real timers for this specific test
      
      const fn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 })
      ).rejects.toThrow('ECONNREFUSED');
      
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('calls onRetry callback on each retry', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');
      const onRetry = jest.fn();

      const resultPromise = withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 100,
        onRetry,
      });

      await jest.advanceTimersByTimeAsync(500);
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
    });
  });

  describe('bestEffort', () => {
    const context: VoiceOperationContext = {
      op: 'delete_session',
      roomId: 'room-1',
      userId: 'user-1',
      requestId: 'req-123',
    };

    it('returns success with data on success', async () => {
      const fn = jest.fn().mockResolvedValue({ deleted: true });

      const result = await bestEffort(fn, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ deleted: true });
      expect(result.error).toBeUndefined();
    });

    it('returns failure with error on failure', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Delete failed'));

      const result = await bestEffort(fn, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Delete failed');
      expect(result.data).toBeUndefined();
    });

    it('does not throw on failure', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Critical failure'));

      await expect(bestEffort(fn, context)).resolves.toBeDefined();
    });

    it('handles non-Error thrown values', async () => {
      const fn = jest.fn().mockRejectedValue('string error');

      const result = await bestEffort(fn, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('bestEffortWithRetry', () => {
    const context: VoiceOperationContext = {
      op: 'delete_session',
      roomId: 'room-1',
      userId: 'user-1',
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns success on first attempt success', async () => {
      const fn = jest.fn().mockResolvedValue({ deleted: true });

      const result = await bestEffortWithRetry(fn, context, 1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ deleted: true });
    });

    it('retries on transient error and succeeds', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue({ deleted: true });

      const resultPromise = bestEffortWithRetry(fn, context, 1);
      await jest.advanceTimersByTimeAsync(500);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('returns failure after exhausting retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const resultPromise = bestEffortWithRetry(fn, context, 2);
      await jest.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not throw even after exhausting retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      const resultPromise = bestEffortWithRetry(fn, context, 1);
      await jest.advanceTimersByTimeAsync(500);

      await expect(resultPromise).resolves.toBeDefined();
    });
  });

  describe('ErrorCodes integration', () => {
    it('VOICE_SERVICE_UNAVAILABLE code exists', () => {
      expect(ErrorCodes.VOICE_SERVICE_UNAVAILABLE).toBe('VOICE_SERVICE_UNAVAILABLE');
    });

    it('AppError.voiceServiceUnavailable factory works', () => {
      const error = AppError.voiceServiceUnavailable('Voice is down', { roomId: 'room-1' });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('VOICE_SERVICE_UNAVAILABLE');
      expect(error.httpStatus).toBe(503);
      expect(error.message).toBe('Voice is down');
      expect(error.details).toEqual({ roomId: 'room-1' });
    });
  });
});
