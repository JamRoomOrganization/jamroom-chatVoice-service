/**
 * InternalAuth Middleware Unit Tests
 *
 * Tests for the internal API key authentication middleware.
 */

import express, { Express, Router } from 'express';
import request from 'supertest';
import { requireInternalApiKey, INTERNAL_API_KEY_HEADER } from '../src/middleware/internalAuth';
import { requestIdMiddleware } from '../src/middleware/requestId';
import { errorHandler } from '../src/middleware/errorHandler';

// Store original env
const originalInternalApiKey = process.env.INTERNAL_API_KEY;

describe('InternalAuth Middleware', () => {
  let app: Express;

  function createTestApp(apiKey?: string): Express {
    // Set or delete the API key BEFORE resetting modules
    // This ensures dotenv doesn't override our intended value
    if (apiKey !== undefined) {
      process.env.INTERNAL_API_KEY = apiKey;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }

    // Reset module cache to pick up new env
    jest.resetModules();

    // Clear the config cache by deleting it from require cache
    // This is necessary because dotenv might reload values from .env
    const configPath = require.resolve('../src/config');
    delete require.cache[configPath];
    const envPath = require.resolve('../src/config/env');
    delete require.cache[envPath];

    // Re-import config and middleware after resetting modules
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireInternalApiKey: freshMiddleware } = require('../src/middleware/internalAuth');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestIdMiddleware: freshRequestId } = require('../src/middleware/requestId');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { errorHandler: freshErrorHandler } = require('../src/middleware/errorHandler');

    const testApp = express();
    testApp.use(freshRequestId);
    testApp.use(express.json());

    // Test route protected by internal API key
    testApp.get('/protected', freshMiddleware, (req, res) => {
      res.status(200).json({ data: { message: 'Access granted' }, error: null });
    });

    testApp.use(freshErrorHandler);

    return testApp;
  }

  afterEach(() => {
    // Restore original env
    if (originalInternalApiKey !== undefined) {
      process.env.INTERNAL_API_KEY = originalInternalApiKey;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
    jest.resetModules();
  });

  describe('when INTERNAL_API_KEY is configured', () => {
    const testApiKey = 'test-internal-api-key-123';

    beforeEach(() => {
      app = createTestApp(testApiKey);
    });

    it('should allow access with valid API key', async () => {
      const response = await request(app)
        .get('/protected')
        .set(INTERNAL_API_KEY_HEADER, testApiKey);

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBe('Access granted');
    });

    it('should reject request with missing API key header', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.details.message).toContain('Missing required header');
    });

    it('should reject request with invalid API key', async () => {
      const response = await request(app)
        .get('/protected')
        .set(INTERNAL_API_KEY_HEADER, 'wrong-api-key');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.details.message).toBe('Invalid internal API key');
    });

    it('should reject request with empty API key', async () => {
      const response = await request(app)
        .get('/protected')
        .set(INTERNAL_API_KEY_HEADER, '');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should include requestId in error response', async () => {
      const response = await request(app)
        .get('/protected')
        .set('x-request-id', 'test-request-123');

      expect(response.status).toBe(401);
      expect(response.body.meta.requestId).toBe('test-request-123');
    });
  });

  describe('when INTERNAL_API_KEY is not configured', () => {
    beforeEach(() => {
      app = createTestApp(undefined);
    });

    it('should reject all requests when API key is not configured', async () => {
      const response = await request(app)
        .get('/protected')
        .set(INTERNAL_API_KEY_HEADER, 'any-key');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.details.message).toContain('not configured');
    });
  });

  describe('INTERNAL_API_KEY_HEADER constant', () => {
    it('should be x-internal-api-key', () => {
      expect(INTERNAL_API_KEY_HEADER).toBe('x-internal-api-key');
    });
  });
});
