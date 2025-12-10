import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import { requestIdMiddleware } from '../src/middleware/requestId';
import { AppError, ErrorCodes } from '../src/types/http';

describe('Error Handler Middleware', () => {
  let app: Express;

  /**
   * Creates a test app with the error handler middleware.
   * Includes requestId middleware to ensure requestId is available.
   */
  function createTestApp(): Express {
    const testApp = express();

    // Add requestId middleware first
    testApp.use(requestIdMiddleware);

    // JSON parsing
    testApp.use(express.json());

    return testApp;
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    app = createTestApp();
  });

  describe('Generic Error Handling', () => {
    it('should return 500 for unhandled errors', async () => {
      // Route that throws a generic error
      app.get('/error', () => {
        throw new Error('Something went wrong');
      });

      // Add error handler
      app.use(errorHandler);

      const response = await request(app)
        .get('/error')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toHaveProperty('data', null);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('meta');
    });

    it('should return INTERNAL_ERROR code for generic errors', async () => {
      app.get('/error', () => {
        throw new Error('Database connection failed');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should return "Unexpected error" message for generic errors', async () => {
      app.get('/error', () => {
        throw new Error('Sensitive internal error details');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      // Should NOT expose internal error details
      expect(response.body.error.message).toBe('Unexpected error');
      expect(response.body.error.message).not.toContain('Sensitive');
    });

    it('should return empty details for generic errors', async () => {
      app.get('/error', () => {
        throw new Error('Error with no safe details');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(response.body.error.details).toEqual({});
    });

    it('should include requestId in meta', async () => {
      app.get('/error', () => {
        throw new Error('Test error');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(response.body.meta).toHaveProperty('requestId');
      expect(typeof response.body.meta.requestId).toBe('string');
      expect(response.body.meta.requestId.length).toBeGreaterThan(0);
    });

    it('should include valid ISO 8601 timestamp in meta', async () => {
      app.get('/error', () => {
        throw new Error('Test error');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(response.body.meta).toHaveProperty('timestamp');

      // Validate ISO 8601 format
      const timestamp = response.body.meta.timestamp;
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });

    it('should propagate custom x-request-id header', async () => {
      const customRequestId = 'custom-trace-id-xyz';

      app.get('/error', () => {
        throw new Error('Test error');
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/error')
        .set('x-request-id', customRequestId)
        .expect(500);

      expect(response.body.meta.requestId).toBe(customRequestId);
    });
  });

  describe('AppError Handling', () => {
    it('should use AppError code and message', async () => {
      app.get('/app-error', () => {
        throw new AppError(
          ErrorCodes.NOT_FOUND,
          'Resource not found',
          404
        );
      });

      app.use(errorHandler);

      const response = await request(app).get('/app-error').expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Resource not found');
    });

    it('should use AppError httpStatus', async () => {
      app.get('/validation-error', () => {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid input',
          400
        );
      });

      app.use(errorHandler);

      await request(app).get('/validation-error').expect(400);
    });

    it('should use default httpStatus from ErrorCodeToHttpStatus', async () => {
      app.get('/default-status', () => {
        // Not passing httpStatus, should use default from ErrorCodeToHttpStatus
        throw new AppError(ErrorCodes.FORBIDDEN, 'Access denied');
      });

      app.use(errorHandler);

      await request(app).get('/default-status').expect(403);
    });

    it('should include AppError details', async () => {
      const errorDetails = {
        field: 'email',
        reason: 'Invalid format',
      };

      app.get('/detailed-error', () => {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Validation failed',
          400,
          errorDetails
        );
      });

      app.use(errorHandler);

      const response = await request(app).get('/detailed-error').expect(400);

      expect(response.body.error.details).toEqual(errorDetails);
    });

    it('should handle different error codes correctly', async () => {
      const testCases = [
        { code: ErrorCodes.BAD_REQUEST, status: 400 },
        { code: ErrorCodes.UNAUTHORIZED, status: 401 },
        { code: ErrorCodes.FORBIDDEN, status: 403 },
        { code: ErrorCodes.NOT_FOUND, status: 404 },
        { code: ErrorCodes.CONFLICT, status: 409 },
        { code: ErrorCodes.INTERNAL_ERROR, status: 500 },
        { code: ErrorCodes.DEPENDENCY_UNAVAILABLE, status: 503 },
      ];

      for (const testCase of testCases) {
        const testApp = createTestApp();

        testApp.get('/test', () => {
          throw new AppError(testCase.code, 'Test error', testCase.status);
        });

        testApp.use(errorHandler);

        const response = await request(testApp)
          .get('/test')
          .expect(testCase.status);

        expect(response.body.error.code).toBe(testCase.code);
      }
    });

    it('should work with AppError factory methods', async () => {
      app.get('/not-found', () => {
        throw AppError.notFound('User not found', { userId: '123' });
      });

      app.use(errorHandler);

      const response = await request(app).get('/not-found').expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('User not found');
      expect(response.body.error.details).toEqual({ userId: '123' });
    });
  });

  describe('Async Error Handling', () => {
    it('should handle async errors when wrapped', async () => {
      // Wrapper for async route handlers
      const asyncHandler = (
        fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
      ) => {
        return (req: Request, res: Response, next: NextFunction): void => {
          fn(req, res, next).catch(next);
        };
      };

      app.get(
        '/async-error',
        asyncHandler(async () => {
          await Promise.reject(new Error('Async operation failed'));
        })
      );

      app.use(errorHandler);

      const response = await request(app).get('/async-error').expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Unexpected error');
    });
  });

  describe('Response Format Consistency', () => {
    it('should always have data, error, and meta properties', async () => {
      app.get('/error', () => {
        throw new Error('Test');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(Object.keys(response.body).sort()).toEqual(
        ['data', 'error', 'meta'].sort()
      );
    });

    it('should always have code, message, and details in error object', async () => {
      app.get('/error', () => {
        throw new Error('Test');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(Object.keys(response.body.error).sort()).toEqual(
        ['code', 'details', 'message'].sort()
      );
    });

    it('should always have requestId and timestamp in meta object', async () => {
      app.get('/error', () => {
        throw new Error('Test');
      });

      app.use(errorHandler);

      const response = await request(app).get('/error').expect(500);

      expect(Object.keys(response.body.meta).sort()).toEqual(
        ['requestId', 'timestamp'].sort()
      );
    });
  });
});
