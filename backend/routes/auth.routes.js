import express from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// Rate limiter for registration: max 10 attempts per 15 minutes per IP
const registerLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again after 15 minutes.'
});

// Rate limiter for login: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.'
});

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', registerLimiter, register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user credentials & issue JWT HttpOnly cookie
 * @access  Public
 */
router.post('/login', loginLimiter, login);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Clear authentication cookie
 * @access  Public
 */
router.post('/logout', logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Fetch authenticated user's profile details
 * @access  Private (Requires valid JWT)
 */
router.get('/me', protect, getMe);

export default router;
