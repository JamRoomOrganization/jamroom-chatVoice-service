import request from 'supertest';
import express, { Express } from 'express';
import { requestIdMiddleware } from '../src/middleware/requestId';
import { createDebugRouter } from '../src/routes/debug.routes';
import { errorHandler } from '../src/middleware/errorHandler';

describe('Debug Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use('/debug', createDebugRouter());
    app.use(errorHandler);
  });

  describe('POST /debug/echo', () => {
    it('should echo back valid payload', async () => {
      const payload = {
        message: 'Hello, World!',
      };

      const response = await request(app)
        .post('/debug/echo')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('received');
      expect(response.body.data.received.message).toBe('Hello, World!');
    });

    it('should include timestamp in response', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({ message: 'test' })
        .expect(200);

      expect(response.body.data).toHaveProperty('timestamp');

      // Validate ISO 8601 format
      const timestamp = response.body.data.timestamp;
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });

    it('should include meta with requestId', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({ message: 'test' })
        .expect(200);

      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('requestId');
      expect(typeof response.body.meta.requestId).toBe('string');
    });

    it('should propagate custom x-request-id header', async () => {
      const customRequestId = 'custom-echo-trace-123';

      const response = await request(app)
        .post('/debug/echo')
        .set('x-request-id', customRequestId)
        .send({ message: 'test' })
        .expect(200);

      expect(response.body.meta.requestId).toBe(customRequestId);
    });

    it('should fail validation when message is missing', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveProperty('issues');
    });

    it('should fail validation when message is empty string', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({ message: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when message is not a string', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({ message: 12345 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle unicode characters in message', async () => {
      const unicodeMessage = '¡Hola! 你好 🎵 العربية';

      const response = await request(app)
        .post('/debug/echo')
        .send({ message: unicodeMessage })
        .expect(200);

      expect(response.body.data.received.message).toBe(unicodeMessage);
    });

    it('should handle long messages (up to max length)', async () => {
      const longMessage = 'A'.repeat(1000); // Max allowed by validation

      const response = await request(app)
        .post('/debug/echo')
        .send({ message: longMessage })
        .expect(200);

      expect(response.body.data.received.message).toBe(longMessage);
    });

    it('should reject messages exceeding max length', async () => {
      const tooLongMessage = 'A'.repeat(1001);

      const response = await request(app)
        .post('/debug/echo')
        .send({ message: tooLongMessage })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should strip unknown fields from body', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({
          message: 'test',
          extraField: 'should be stripped',
          anotherField: 123,
        })
        .expect(200);

      expect(response.body.data.received).not.toHaveProperty('extraField');
      expect(response.body.data.received).not.toHaveProperty('anotherField');
      expect(response.body.data.received.message).toBe('test');
    });

    it('should have null error on success', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({ message: 'test' })
        .expect(200);

      expect(response.body.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should return proper error response format on validation failure', async () => {
      const response = await request(app)
        .post('/debug/echo')
        .send({ message: 123 })
        .expect(400);

      // Check error response structure
      expect(response.body).toHaveProperty('data', null);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('meta');

      // Check error object structure
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('details');
    });
  });
});
