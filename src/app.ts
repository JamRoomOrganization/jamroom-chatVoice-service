import express, { Express } from 'express';
import cors from 'cors';  // <-- AÑADE ESTA IMPORTACIÓN
import {
  requestIdMiddleware,
  httpLoggerMiddleware,
  errorHandler,
  notFoundHandler,
} from './middleware';
import { registerRoutes } from './routes';

export function createApp(): Express {
  const app = express();

  // =========================================================================
  // PRE-ROUTE MIDDLEWARE
  // Order matters! These run before route handlers
  // =========================================================================

  // 1. Request ID middleware - must be first to ensure requestId is available
  app.use(requestIdMiddleware);

  // 2. HTTP request logging - logs all incoming requests with requestId
  app.use(httpLoggerMiddleware);

  // 3. CORS middleware - ¡AGREGA ESTO! (después de logging, antes de body parsing)
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : ['https://jamroom-front.vercel.app'];
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Log blocked origins for debugging
      console.warn(`CORS blocked for origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    exposedHeaders: ['set-cookie', 'authorization']
  }));

  // 4. Body parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // =========================================================================
  // ROUTES
  // =========================================================================

  // Register all application routes
  registerRoutes(app);

  // =========================================================================
  // POST-ROUTE MIDDLEWARE
  // These run after route handlers (error handling)
  // =========================================================================

  // 4. 404 handler - catches requests that didn't match any route
  app.use(notFoundHandler);

  // 5. Global error handler - must be LAST middleware
  app.use(errorHandler);

  return app;
}
