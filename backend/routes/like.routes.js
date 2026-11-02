import express from 'express';
import { likePost, unlikePost } from '../controllers/like.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// PUT    /api/v1/posts/:id/like — Like a post (authenticated)
// DELETE /api/v1/posts/:id/like — Unlike a post (authenticated)
router.route('/posts/:id/like')
  .put(protect, likePost)
  .delete(protect, unlikePost);

export default router;
