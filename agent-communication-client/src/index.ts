/**
 * Main application entry point for the Agent Communication API
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import logger from './utils/logger';
import routes from './routes';
import { testConnection } from './db/supabase';
import { DMAgent } from './agent/dmAgent';

async function main(): Promise<void> {
  try {
    // Test the Supabase connection
    const connected = await testConnection();
    if (!connected) {
      logger.error('Failed to connect to database, exiting');
      process.exit(1);
    }
    
    // Initialize the DM agent
    await DMAgent.initialize();
    
    // Create Express app
    const app = express();
    const port = parseInt(env.PORT, 10);
    
    // Middleware
    app.use(helmet()); // Security headers
    app.use(cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'x-api-key'],
    }));
    app.use(express.json()); // Parse JSON bodies
    
    // Apply rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
      limit: parseInt(env.RATE_LIMIT_MAX, 10),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    });
    app.use(limiter);
    
    // Routes
    app.use('/api', routes);
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    });
    
    // Start server
    app.listen(port, () => {
      logger.info(`🚀 Server running on port ${port} in ${env.NODE_ENV} mode`);
      logger.info(`Health check available at http://localhost:${port}/health`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start the application
main();