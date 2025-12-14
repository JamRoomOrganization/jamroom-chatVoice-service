import { createApp } from './app';
import { config } from './config';
import { logStartup, logShutdown, logger } from './middleware';

/**
 * Bootstrap and start the HTTP server.
 *
 * This is the main entry point for the chatVoice-service.
 *
 * Startup sequence:
 * 1. Load and validate configuration from environment
 * 2. Create Express application with all middleware and routes
 * 3. Start HTTP server on configured port
 * 4. Register graceful shutdown handlers
 */
async function main(): Promise<void> {
  try {
    // Create the application
    const app = createApp();

    // Start the HTTP server
    const server = app.listen(config.PORT, '::', () => {
      logStartup(config.PORT);
    });

    // =========================================================================
    // GRACEFUL SHUTDOWN
    // =========================================================================

    /**
     * Handles graceful shutdown of the server.
     * Called on SIGTERM (container orchestrator) and SIGINT (Ctrl+C)
     */
    const shutdown = (signal: string): void => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      logShutdown();

      server.close((err) => {
        if (err) {
          logger.error({ err }, 'Error during server shutdown');
          process.exit(1);
        }

        logger.info('Server closed successfully');
        process.exit(0);
      });

      // Force shutdown after timeout (10 seconds)
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000).unref();
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ err: error }, 'Uncaught exception');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled promise rejection');
      process.exit(1);
    });

  } catch (error) {
    // Configuration validation or other startup errors
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the application
main();
