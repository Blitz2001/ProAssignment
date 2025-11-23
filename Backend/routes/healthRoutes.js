import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// @desc    Health check endpoint
// @route   GET /api/health
// @access  Public
router.get('/', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        unit: 'MB',
      },
    },
  };

  // Check database connection
  try {
    if (mongoose.connection.readyState === 1) {
      healthCheck.checks.database = 'connected';
      healthCheck.status = 'healthy';
    } else if (mongoose.connection.readyState === 2) {
      healthCheck.checks.database = 'connecting';
      healthCheck.status = 'degraded';
    } else {
      healthCheck.checks.database = 'disconnected';
      healthCheck.status = 'unhealthy';
    }
  } catch (error) {
    healthCheck.checks.database = 'error';
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

export default router;

