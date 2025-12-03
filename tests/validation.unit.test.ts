import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../src/middleware/validation';
import { requestIdMiddleware } from '../src/middleware/requestId';
import { errorHandler } from '../src/middleware/errorHandler';

describe('Validation Middleware', () => {
  let app: Express;

  /**
   * Creates a test app with validation middleware.
   */
  function createTestApp(): Express {
    const testApp = express();
    testApp.use(requestIdMiddleware);
    testApp.use(express.json());
    return testApp;
  }

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Body Validation', () => {
    const bodySchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email format'),
      age: z.number().int().positive().optional(),
    });

    it('should pass validation with valid body', async () => {
      app.post(
        '/test',
        validateRequest({ body: bodySchema }),
        (req: Request, res: Response) => {
          res.json({ success: true, data: req.body });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 'John', email: 'john@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('John');
      expect(response.body.data.email).toBe('john@example.com');
    });

    it('should fail validation with missing required field', async () => {
      app.post(
        '/test',
        validateRequest({ body: bodySchema }),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ email: 'john@example.com' }) // Missing name
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveProperty('issues');
    });

    it('should fail validation with invalid email format', async () => {
      app.post(
        '/test',
        validateRequest({ body: bodySchema }),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 'John', email: 'not-an-email' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'email',
          }),
        ])
      );
    });

    it('should strip unknown fields from body', async () => {
      app.post(
        '/test',
        validateRequest({ body: bodySchema }),
        (req: Request, res: Response) => {
          res.json({ data: req.body });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({
          name: 'John',
          email: 'john@example.com',
          unknownField: 'should be stripped',
        })
        .expect(200);

      expect(response.body.data).not.toHaveProperty('unknownField');
    });
  });

  describe('Query Validation', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      search: z.string().optional(),
    });

    it('should pass validation with valid query params', async () => {
      app.get(
        '/test',
        validateRequest({ query: querySchema }),
        (req: Request, res: Response) => {
          res.json({ query: req.query });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .get('/test?page=2&limit=20&search=hello')
        .expect(200);

      expect(response.body.query.page).toBe(2);
      expect(response.body.query.limit).toBe(20);
      expect(response.body.query.search).toBe('hello');
    });

    it('should apply default values for missing optional params', async () => {
      app.get(
        '/test',
        validateRequest({ query: querySchema }),
        (req: Request, res: Response) => {
          res.json({ query: req.query });
        }
      );
      app.use(errorHandler);

      const response = await request(app).get('/test').expect(200);

      expect(response.body.query.page).toBe(1);
      expect(response.body.query.limit).toBe(10);
    });

    it('should fail validation with invalid query param type', async () => {
      app.get(
        '/test',
        validateRequest({ query: querySchema }),
        (req: Request, res: Response) => {
          res.json({ query: req.query });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .get('/test?page=not-a-number')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when limit exceeds max', async () => {
      app.get(
        '/test',
        validateRequest({ query: querySchema }),
        (req: Request, res: Response) => {
          res.json({ query: req.query });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .get('/test?limit=500')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Params Validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid('Invalid UUID format'),
    });

    it('should pass validation with valid params', async () => {
      app.get(
        '/users/:id',
        validateRequest({ params: paramsSchema }),
        (req: Request, res: Response) => {
          res.json({ id: req.params.id });
        }
      );
      app.use(errorHandler);

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/users/${validUuid}`)
        .expect(200);

      expect(response.body.id).toBe(validUuid);
    });

    it('should fail validation with invalid UUID param', async () => {
      app.get(
        '/users/:id',
        validateRequest({ params: paramsSchema }),
        (req: Request, res: Response) => {
          res.json({ id: req.params.id });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .get('/users/not-a-uuid')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'id',
            message: 'Invalid UUID format',
          }),
        ])
      );
    });
  });

  describe('Combined Validation', () => {
    const bodySchema = z.object({
      title: z.string().min(1),
    });

    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const querySchema = z.object({
      notify: z.coerce.boolean().default(false),
    });

    it('should validate body, params, and query together', async () => {
      app.put(
        '/items/:id',
        validateRequest({ body: bodySchema, params: paramsSchema, query: querySchema }),
        (req: Request, res: Response) => {
          res.json({
            params: req.params,
            body: req.body,
            query: req.query,
          });
        }
      );
      app.use(errorHandler);

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .put(`/items/${validUuid}?notify=true`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.params.id).toBe(validUuid);
      expect(response.body.body.title).toBe('Updated Title');
      expect(response.body.query.notify).toBe(true);
    });

    it('should fail fast on first validation error', async () => {
      app.put(
        '/items/:id',
        validateRequest({ body: bodySchema, params: paramsSchema, query: querySchema }),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      app.use(errorHandler);

      // Invalid params should fail first
      const response = await request(app)
        .put('/items/invalid-uuid?notify=true')
        .send({ title: 'Updated Title' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Response Structure', () => {
    const bodySchema = z.object({
      name: z.string().min(3, 'Name must be at least 3 characters'),
    });

    it('should include detailed validation issues', async () => {
      app.post(
        '/test',
        validateRequest({ body: bodySchema }),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 'AB' })
        .expect(400);

      expect(response.body.error.details.issues[0]).toEqual(
        expect.objectContaining({
          code: 'too_small',
          path: 'name',
          message: 'Name must be at least 3 characters',
        })
      );
    });

    it('should include all validation errors', async () => {
      const multiFieldSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().positive(),
      });

      app.post(
        '/test',
        validateRequest({ body: multiFieldSchema }),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: '', email: 'invalid', age: -5 })
        .expect(400);

      expect(response.body.error.details.issues.length).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty body gracefully', async () => {
      const optionalBodySchema = z.object({
        name: z.string().optional(),
      });

      app.post(
        '/test',
        validateRequest({ body: optionalBodySchema }),
        (req: Request, res: Response) => {
          res.json({ body: req.body });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({})
        .expect(200);

      expect(response.body.body).toEqual({});
    });

    it('should handle null values in body', async () => {
      const nullableSchema = z.object({
        name: z.string().nullable(),
      });

      app.post(
        '/test',
        validateRequest({ body: nullableSchema }),
        (req: Request, res: Response) => {
          res.json({ body: req.body });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: null })
        .expect(200);

      expect(response.body.body.name).toBeNull();
    });

    it('should transform values according to schema', async () => {
      const transformSchema = z.object({
        email: z.string().email().toLowerCase(),
        code: z.string().toUpperCase(),
      });

      app.post(
        '/test',
        validateRequest({ body: transformSchema }),
        (req: Request, res: Response) => {
          res.json({ body: req.body });
        }
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ email: 'JOHN@EXAMPLE.COM', code: 'abc123' })
        .expect(200);

      expect(response.body.body.email).toBe('john@example.com');
      expect(response.body.body.code).toBe('ABC123');
    });
  });
});
