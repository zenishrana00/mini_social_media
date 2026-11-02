import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';
import likeRoutes from './routes/like.routes.js';
import followRoutes from './routes/follow.routes.js';

// Set up __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express application
const app = express();

// -----------------------------------------------------------------------------
// Core Middleware & Security Headers
// -----------------------------------------------------------------------------
// Set essential HTTP security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enable Cross-Origin Resource Sharing with credentials support for cookies
const clientUrl = process.env.CLIENT_URL;
app.use(
  cors({
    origin: clientUrl ? clientUrl.split(',').map((url) => url.trim()) : true,
    credentials: true
  })
);

// Parse Cookie headers and populate req.cookies
app.use(cookieParser());

// Parse incoming JSON requests in req.body
app.use(express.json());

// Parse incoming URL-encoded form data in req.body
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// Serve Frontend Static Files
// -----------------------------------------------------------------------------
// Path pointing to the frontend directory
const frontendPath = path.join(__dirname, '../frontend');

// Serve static assets (CSS, JS, images, and HTML files)
app.use(express.static(frontendPath));

// Clean URL page routing for frontend views
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(frontendPath, 'register.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(frontendPath, 'profile.html'));
});

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------
/**
 * @route   GET /api/v1/health
 * @desc    Health-check API endpoint to verify server status and uptime
 * @access  Public
 */
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Mini Social Media Platform API is healthy and operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------
// Authentication routes: /api/v1/auth/register, /api/v1/auth/login, etc.
app.use('/api/v1/auth', authRoutes);

// User profile & search routes: /api/v1/users/search, /api/v1/users/me, /api/v1/users/:id
app.use('/api/v1/users', userRoutes);

// Follow routes: /api/v1/users/:id/follow, /api/v1/users/:id/followers, etc.
app.use('/api/v1/users', followRoutes);

// Posts & Feed routes: /api/v1/posts, /api/v1/posts/:id, /api/v1/posts/user/:userId
app.use('/api/v1/posts', postRoutes);

// Comment routes: /api/v1/posts/:postId/comments, /api/v1/comments/:id
app.use('/api/v1', commentRoutes);

// Like routes: /api/v1/posts/:id/like
app.use('/api/v1', likeRoutes);

// -----------------------------------------------------------------------------
// Fallback & Error Handling Middleware
// -----------------------------------------------------------------------------
// 404 handler for unhandled API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[Application Error]`, err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;
