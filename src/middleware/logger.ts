import pino from 'pino';
import pinoHttp from 'pino-http';
import { IncomingMessage } from 'http';
import { config } from '../config';

/**
 * Extended request type that includes our custom requestId property.
 */
interface RequestWithId extends IncomingMessage {
  requestId?: string;
}

/**
 * Base pino logger instance.
 * Configured based on the current environment.
 */
export const logger = pino({
  name: config.serviceName,
  level: config.isProduction ? 'info' : 'debug',
  ...(config.isDevelopment && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  }),
  base: {
    service: config.serviceName,
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * HTTP request logging middleware using pino-http.
 *
 * Features:
 * - Logs method, path, status code, and duration
 * - Includes requestId in every log entry
 * - Auto-logs request completion
 */
export const httpLoggerMiddleware = pinoHttp({
  logger,
  // Generate request ID from our requestId middleware
  genReqId: (req) => (req as RequestWithId).requestId || 'unknown',

  // Customize serializers to avoid logging sensitive data
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: req.id,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

  // Custom log level based on status code
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },

  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with ${res.statusCode}`;
  },

  // Custom error message
  customErrorMessage: (_req, res, err) => {
    return `Request failed with ${res.statusCode}: ${err?.message || 'Unknown error'}`;
  },

  // Quiet mode in test environment
  quietReqLogger: config.isTest,
  autoLogging: !config.isTest,
});

/**
 * Log application startup information.
 */
export function logStartup(port: number): void {
  logger.info(
    {
      port,
      nodeEnv: config.NODE_ENV,
    },
    `🚀 ${config.serviceName} started on port ${port} in ${config.NODE_ENV} mode`
  );
}

/**
 * Log application shutdown.
 */
export function logShutdown(): void {
  logger.info(`${config.serviceName} is shutting down...`);
}
