import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  searchUsers
} from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * 1. Search Users
 * @route   GET /api/v1/users/search?q=...
 * @desc    Search for users by name or username
 * @access  Public
 * IMPORTANT: Placed BEFORE /:id route so 'search' is not interpreted as a dynamic user ID parameter.
 */
router.get('/search', searchUsers);

/**
 * 2. Update Current User Profile
 * @route   PATCH /api/v1/users/me
 * @desc    Update current authenticated user's profile details
 * @access  Private (Requires valid JWT)
 * Placed BEFORE /:id route so 'me' is not captured as a user ID.
 */
router.patch('/me', protect, updateUserProfile);

/**
 * 3. Get Public User Profile
 * @route   GET /api/v1/users/:id
 * @desc    Fetch public profile for a specific user ID
 * @access  Public
 */
router.get('/:id', getUserProfile);

export default router;
