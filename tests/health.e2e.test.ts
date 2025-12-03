import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';

describe('Health Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  describe('GET /healthz', () => {
    it('should return 200 OK with correct structure', async () => {
      const response = await request(app)
        .get('/healthz')
        .expect('Content-Type', /json/)
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error', null);
      expect(response.body).toHaveProperty('meta');
    });

    it('should return status "ok" and service name', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.body.data).toEqual({
        status: 'ok',
        service: 'chatVoice-service',
      });
    });

    it('should include requestId in meta', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.body.meta).toHaveProperty('requestId');
      expect(typeof response.body.meta.requestId).toBe('string');
      expect(response.body.meta.requestId.length).toBeGreaterThan(0);
    });

    it('should include valid ISO 8601 timestamp in meta', async () => {
      const response = await request(app).get('/healthz').expect(200);

      expect(response.body.meta).toHaveProperty('timestamp');

      // Validate ISO 8601 format
      const timestamp = response.body.meta.timestamp;
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });

    it('should use provided x-request-id header', async () => {
      const customRequestId = 'test-request-id-12345';

      const response = await request(app)
        .get('/healthz')
        .set('x-request-id', customRequestId)
        .expect(200);

      expect(response.body.meta.requestId).toBe(customRequestId);
    });

    it('should generate requestId when not provided', async () => {
      const response = await request(app).get('/healthz').expect(200);

      // UUID v4 format validation
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(response.body.meta.requestId).toMatch(uuidV4Regex);
    });
  });

  describe('GET /readyz', () => {
    it('should return 200 OK with correct structure', async () => {
      const response = await request(app)
        .get('/readyz')
        .expect('Content-Type', /json/)
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error', null);
      expect(response.body).toHaveProperty('meta');
    });

    it('should return status and checks array', async () => {
      const response = await request(app).get('/readyz').expect(200);

      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('checks');
      expect(Array.isArray(response.body.data.checks)).toBe(true);
    });

    it('should return status "pass" when all checks pass', async () => {
      const response = await request(app).get('/readyz').expect(200);

      expect(response.body.data.status).toBe('pass');
    });

    it('should include self check in checks array', async () => {
      const response = await request(app).get('/readyz').expect(200);

      const selfCheck = response.body.data.checks.find(
        (c: { name: string }) => c.name === 'self'
      );
      expect(selfCheck).toBeDefined();
      expect(selfCheck.status).toBe('pass');
    });

    it('should include requestId in meta', async () => {
      const response = await request(app).get('/readyz').expect(200);

      expect(response.body.meta).toHaveProperty('requestId');
      expect(typeof response.body.meta.requestId).toBe('string');
    });

    it('should include valid ISO 8601 timestamp in meta', async () => {
      const response = await request(app).get('/readyz').expect(200);

      expect(response.body.meta).toHaveProperty('timestamp');

      const timestamp = response.body.meta.timestamp;
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('data', null);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body).toHaveProperty('meta');
    });
  });
});
