/**
 * Validation Middleware
 *
 * Generic request validation middleware using Zod schemas.
 * Validates body, query, and params against provided schemas.
 */

import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from '../types/http';

/**
 * Schema configuration for request validation.
 */
export interface RequestSchema {
  /**
   * Zod schema for validating request body
   */
  body?: ZodSchema;

  /**
   * Zod schema for validating query parameters
   */
  query?: ZodSchema;

  /**
   * Zod schema for validating route parameters
   */
  params?: ZodSchema;
}

/**
 * Formats Zod validation errors into a readable structure.
 *
 * @param error - ZodError instance
 * @returns Formatted error details
 */
function formatZodError(error: ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

/**
 * Creates a validation middleware for the given schema.
 *
 * Validates request body, query, and params against provided Zod schemas.
 * If validation fails, throws an AppError with VALIDATION_ERROR code.
 *
 * @param schema - Object containing Zod schemas for body, query, and/or params
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { validateRequest } from '../middleware/validation';
 *
 * const echoSchema = {
 *   body: z.object({
 *     message: z.string().min(1).max(1000),
 *   }),
 * };
 *
 * router.post('/echo', validateRequest(echoSchema), echoController);
 * ```
 */
export function validateRequest(schema: RequestSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Validate body if schema provided
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query if schema provided
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate params if schema provided
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (err) {
      // Handle Zod validation errors
      if (err instanceof ZodError) {
        const appError = AppError.validationError(
          'Invalid request payload',
          formatZodError(err)
        );
        next(appError);
        return;
      }

      // Re-throw unexpected errors
      next(err);
    }
  };
}
