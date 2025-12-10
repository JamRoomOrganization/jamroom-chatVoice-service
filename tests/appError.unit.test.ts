import { AppError, ErrorCodes, ErrorCodeToHttpStatus } from '../src/types/http';

describe('AppError', () => {
  describe('Constructor', () => {
    it('should create an AppError with required parameters', () => {
      const error = new AppError(ErrorCodes.NOT_FOUND, 'Resource not found');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('AppError');
    });

    it('should use default httpStatus from ErrorCodeToHttpStatus', () => {
      const error = new AppError(ErrorCodes.NOT_FOUND, 'Resource not found');

      expect(error.httpStatus).toBe(404);
    });

    it('should allow overriding httpStatus', () => {
      const error = new AppError(ErrorCodes.BAD_REQUEST, 'Custom status', 422);

      expect(error.httpStatus).toBe(422);
    });

    it('should store details object', () => {
      const details = { userId: '123', field: 'email' };
      const error = new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Validation failed',
        400,
        details
      );

      expect(error.details).toEqual(details);
    });

    it('should default details to empty object', () => {
      const error = new AppError(ErrorCodes.INTERNAL_ERROR, 'Something went wrong');

      expect(error.details).toEqual({});
    });

    it('should be an instance of Error', () => {
      const error = new AppError(ErrorCodes.BAD_REQUEST, 'Bad request');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have proper stack trace', () => {
      const error = new AppError(ErrorCodes.INTERNAL_ERROR, 'Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('Factory Methods', () => {
    describe('notFound', () => {
      it('should create NOT_FOUND error with correct defaults', () => {
        const error = AppError.notFound('User not found');

        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('User not found');
        expect(error.httpStatus).toBe(404);
      });

      it('should accept custom details', () => {
        const error = AppError.notFound('User not found', { userId: '123' });

        expect(error.details).toEqual({ userId: '123' });
      });
    });

    describe('badRequest', () => {
      it('should create BAD_REQUEST error with correct defaults', () => {
        const error = AppError.badRequest('Invalid input');

        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toBe('Invalid input');
        expect(error.httpStatus).toBe(400);
      });
    });

    describe('unauthorized', () => {
      it('should create UNAUTHORIZED error with correct defaults', () => {
        const error = AppError.unauthorized('Authentication required');

        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.message).toBe('Authentication required');
        expect(error.httpStatus).toBe(401);
      });
    });

    describe('forbidden', () => {
      it('should create FORBIDDEN error with correct defaults', () => {
        const error = AppError.forbidden('Access denied');

        expect(error.code).toBe('FORBIDDEN');
        expect(error.message).toBe('Access denied');
        expect(error.httpStatus).toBe(403);
      });
    });

    describe('conflict', () => {
      it('should create CONFLICT error with correct defaults', () => {
        const error = AppError.conflict('Resource already exists');

        expect(error.code).toBe('CONFLICT');
        expect(error.message).toBe('Resource already exists');
        expect(error.httpStatus).toBe(409);
      });
    });

    describe('validationError', () => {
      it('should create VALIDATION_ERROR with correct defaults', () => {
        const error = AppError.validationError('Validation failed', {
          issues: [{ path: ['email'], message: 'Invalid email' }],
        });

        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.message).toBe('Validation failed');
        expect(error.httpStatus).toBe(400);
        expect(error.details.issues).toHaveLength(1);
      });
    });

    describe('internal', () => {
      it('should create INTERNAL_ERROR with correct defaults', () => {
        const error = AppError.internal('Unexpected error');

        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.message).toBe('Unexpected error');
        expect(error.httpStatus).toBe(500);
      });
    });

    describe('dependencyUnavailable', () => {
      it('should create DEPENDENCY_UNAVAILABLE error with correct defaults', () => {
        const error = AppError.dependencyUnavailable('Database unavailable');

        expect(error.code).toBe('DEPENDENCY_UNAVAILABLE');
        expect(error.message).toBe('Database unavailable');
        expect(error.httpStatus).toBe(503);
      });

      it('should accept service details', () => {
        const error = AppError.dependencyUnavailable('Service down', {
          service: 'livekit',
          endpoint: 'http://localhost:7880',
        });

        expect(error.details).toEqual({
          service: 'livekit',
          endpoint: 'http://localhost:7880',
        });
      });
    });
  });

  describe('ErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCodes.DEPENDENCY_UNAVAILABLE).toBe('DEPENDENCY_UNAVAILABLE');
    });
  });

  describe('ErrorCodeToHttpStatus', () => {
    it('should map all error codes to correct HTTP status', () => {
      expect(ErrorCodeToHttpStatus.BAD_REQUEST).toBe(400);
      expect(ErrorCodeToHttpStatus.UNAUTHORIZED).toBe(401);
      expect(ErrorCodeToHttpStatus.FORBIDDEN).toBe(403);
      expect(ErrorCodeToHttpStatus.NOT_FOUND).toBe(404);
      expect(ErrorCodeToHttpStatus.VALIDATION_ERROR).toBe(400);
      expect(ErrorCodeToHttpStatus.CONFLICT).toBe(409);
      expect(ErrorCodeToHttpStatus.INTERNAL_ERROR).toBe(500);
      expect(ErrorCodeToHttpStatus.DEPENDENCY_UNAVAILABLE).toBe(503);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize properly for logging', () => {
      const error = new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Validation failed',
        400,
        { field: 'email', reason: 'invalid format' }
      );

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      // Note: Error properties don't serialize by default
      // but we can check the custom properties
      expect(parsed.code).toBe('VALIDATION_ERROR');
      expect(parsed.httpStatus).toBe(400);
      expect(parsed.details).toEqual({ field: 'email', reason: 'invalid format' });
    });

    it('should have enumerable custom properties', () => {
      const error = new AppError(ErrorCodes.BAD_REQUEST, 'Test');

      expect(Object.keys(error)).toContain('code');
      expect(Object.keys(error)).toContain('httpStatus');
      expect(Object.keys(error)).toContain('details');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      const error = new AppError(ErrorCodes.BAD_REQUEST, '');

      expect(error.message).toBe('');
    });

    it('should handle complex nested details', () => {
      const complexDetails = {
        errors: [
          { field: 'name', messages: ['required', 'too short'] },
          { field: 'email', messages: ['invalid format'] },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: 'abc-123',
        },
      };

      const error = new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Multiple validation errors',
        400,
        complexDetails
      );

      expect(error.details).toEqual(complexDetails);
    });

    it('should preserve details reference (not deep clone)', () => {
      const details = { mutable: true };
      const error = new AppError(ErrorCodes.BAD_REQUEST, 'Test', 400, details);

      details.mutable = false;

      expect(error.details.mutable).toBe(false);
    });
  });
});
