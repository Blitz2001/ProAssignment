import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { apiLimiter, authLimiter, uploadLimiter, chatLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput } from './middleware/sanitizeMiddleware.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import writerRoutes from './routes/writerRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import paysheetRoutes from './routes/paysheetRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import testRoutes from './routes/testRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';

dotenv.config();

// Global process-level error handlers to avoid silent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Allow logs to flush, then exit to let PM2/systemd restart cleanly
  setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  // Allow logs to flush, then exit to let PM2/systemd restart cleanly
  setTimeout(() => process.exit(1), 100);
});

// Validate required environment variables
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in environment variables');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('Error: JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

// CRITICAL: Wait for database connection before starting server
// This ensures all data operations will work correctly
import mongoose from 'mongoose';

const startServer = async () => {
  try {
    await connectDB();
    
    // Wait a moment to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify connection is ready
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ CRITICAL: Database connection not ready after connectDB()!');
      process.exit(1);
    }
    
    console.log('✅ Database connection verified - Ready to accept requests');
  } catch (dbError) {
    console.error('❌ Failed to connect to database:', dbError);
    process.exit(1);
  }
};

// CRITICAL: Database connection must complete before starting HTTP server
// This prevents race conditions where requests arrive before DB is ready

const app = express();
const server = http.createServer(app);

// If behind a proxy (or when some environments add X-Forwarded-For),
// trust the reverse proxy so req.ip is derived correctly and
// express-rate-limit does not throw on unexpected X-Forwarded-For formats.
app.set('trust proxy', 1);

// Configure CORS based on environment
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : (process.env.NODE_ENV === 'production' 
      ? ['http://localhost:3000'] // Update with your production frontend URL
      : ['http://localhost:3000', 'http://localhost:5173']); // Vite default port

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins[0] 
      : '*', // Allow all in development
    credentials: true,
  },
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for file uploads (adjust if needed)
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Rate limiting - apply to all routes
app.use('/api', apiLimiter);

// Specific rate limiters for sensitive routes
app.use('/api/auth', authLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/chats', chatLimiter);

// Socket.io connection management
let activeUsers = new Map(); // Map<userId, socketId>

io.on('connection', (socket) => {
  console.log('✅ Socket: User connected:', socket.id);

  // Add user to active users map
  socket.on('addUser', (userId) => {
    activeUsers.set(userId.toString(), socket.id);
    io.emit('getUsers', Array.from(activeUsers.keys()));
    console.log(`✅ Socket: User ${userId} mapped to socket ${socket.id}`);
    console.log(`📊 Socket: Total active users: ${activeUsers.size}`);
  });

  // Handle explicit removeUser event
  socket.on('removeUser', (userId) => {
    activeUsers.delete(userId.toString());
    io.emit('getUsers', Array.from(activeUsers.keys()));
    console.log(`🔌 Socket: User ${userId} removed from active users`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    for (let [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        console.log(`🔌 Socket: User ${userId} disconnected (socket ${socket.id})`);
        break;
      }
    }
    io.emit('getUsers', Array.from(activeUsers.keys()));
    console.log(`📊 Socket: Total active users: ${activeUsers.size}`);
  });
});


// Middleware to attach io and activeUsers to requests
app.use((req, res, next) => {
  req.io = io;
  req.activeUsers = activeUsers;
  next();
});

// Health check (no rate limiting)
app.use('/api/health', healthRoutes);

// Test routes (for debugging - remove in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', testRoutes);
}

// API Routes (with rate limiting)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/writers', writerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/paysheets', paysheetRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/feedback', feedbackRoutes);

// Static file serving - REMOVED for security
// Files are now served through protected download routes
// app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// CRITICAL: Wait for database connection before starting HTTP server
startServer().then(() => {
  // Database is connected, now start the HTTP server
  server.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`📍 Server listening on port ${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`✅ Production mode enabled`);
      console.log(`🔒 Security features: Enabled`);
      console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
    }
    console.log(`\n✅ Server fully initialized and ready to accept connections`);
    console.log(`✅ Database connection: ACTIVE`);
    console.log(`✅ All systems: OPERATIONAL\n`);
  });
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
