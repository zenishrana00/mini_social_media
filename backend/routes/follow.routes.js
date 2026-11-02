import express from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus
} from '../controllers/follow.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Follow / Unfollow a user
 * POST   /api/v1/users/:id/follow — Follow (authenticated)
 * DELETE /api/v1/users/:id/follow — Unfollow (authenticated)
 */
router.route('/:id/follow')
  .post(protect, followUser)
  .delete(protect, unfollowUser);

/**
 * GET /api/v1/users/:id/followers — Get followers list (public)
 */
router.get('/:id/followers', getFollowers);

/**
 * GET /api/v1/users/:id/following — Get following list (public)
 */
router.get('/:id/following', getFollowing);

/**
 * GET /api/v1/users/:id/follow-status — Check follow status (authenticated)
 */
router.get('/:id/follow-status', protect, getFollowStatus);

export default router;
