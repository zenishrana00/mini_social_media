import express from 'express';
import { createComment, getPostComments, deleteComment } from '../controllers/comment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/v1/posts/:postId/comments — Create comment (authenticated)
// GET  /api/v1/posts/:postId/comments — Get comments (public)
router.route('/posts/:postId/comments')
  .post(protect, createComment)
  .get(getPostComments);

// DELETE /api/v1/comments/:id — Delete comment (authenticated)
router.delete('/comments/:id', protect, deleteComment);

export default router;
