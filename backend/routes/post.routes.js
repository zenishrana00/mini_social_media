import express from 'express';
import {
  createPost,
  getFeed,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost,
  getFollowingFeed
} from '../controllers/post.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * 1. Feed & Post Creation
 * @route   POST /api/v1/posts       (Create a new post - Authenticated)
 * @route   GET  /api/v1/posts       (Get authenticated chronological feed)
 */
router.route('/')
  .post(protect, createPost)
  .get(protect, getFeed);

/**
 * 2. Personalized Following Feed
 * @route   GET /api/v1/posts/feed
 * @desc    Get posts from followed users + own posts
 * IMPORTANT: Positioned BEFORE /:id to prevent 'feed' from matching as a post ID
 */
router.get('/feed', protect, getFollowingFeed);

/**
 * 3. User Specific Posts
 * @route   GET /api/v1/posts/user/:userId
 * @desc    Fetch public posts created by a specific user
 * IMPORTANT: Positioned BEFORE /:id to prevent 'user' from matching as a post ID
 */
router.get('/user/:userId', getUserPosts);

/**
 * 4. Individual Post Operations
 * @route   GET    /api/v1/posts/:id  (Public post view)
 * @route   PATCH  /api/v1/posts/:id  (Edit post - Author only)
 * @route   DELETE /api/v1/posts/:id  (Delete post - Author only)
 */
router.route('/:id')
  .get(getPostById)
  .patch(protect, updatePost)
  .delete(protect, deletePost);

export default router;
