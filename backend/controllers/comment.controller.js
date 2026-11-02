import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js';

/**
 * @desc    Create a comment on a post
 * @route   POST /api/v1/posts/:postId/comments
 * @access  Private (Authenticated)
 */
export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    // Validate postId format
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    // Validate content presence, type, and length
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Comment content is required and cannot be empty.'
      });
    }

    if (content.trim().length > 500) {
      return res.status(400).json({
        status: 'fail',
        message: 'Comment content cannot exceed 500 characters.'
      });
    }

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    // Create the comment
    const comment = await Comment.create({
      post: postId,
      author: req.user._id,
      content: content.trim()
    });

    // Populate author profile fields
    await comment.populate('author', 'name username profilePicture');

    return res.status(201).json({
      status: 'success',
      data: {
        comment
      }
    });
  } catch (error) {
    console.error('[Create Comment Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while creating the comment.'
    });
  }
};

/**
 * @desc    Get all comments for a post (paginated, oldest first)
 * @route   GET /api/v1/posts/:postId/comments
 * @access  Public
 */
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate postId format
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    // Pagination with safe defaults and bounded limits
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const totalComments = await Comment.countDocuments({ post: postId });
    const totalPages = Math.ceil(totalComments / limit);

    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username profilePicture')
      .lean();

    return res.status(200).json({
      status: 'success',
      results: comments.length,
      pagination: {
        totalComments,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        limit
      },
      data: {
        comments
      }
    });
  } catch (error) {
    console.error('[Get Post Comments Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving comments.'
    });
  }
};

/**
 * @desc    Delete a comment (comment author or post owner)
 * @route   DELETE /api/v1/comments/:id
 * @access  Private (Comment author or Post owner)
 */
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate comment ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid comment ID format.'
      });
    }

    // Find the comment
    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment not found.'
      });
    }

    // Fetch the parent post to check post ownership for moderation
    const post = await Post.findById(comment.post);

    // Authorization: allow comment author OR post owner to delete
    const isCommentAuthor = req.user._id.toString() === comment.author.toString();
    const isPostOwner = post && req.user._id.toString() === post.author.toString();

    if (!isCommentAuthor && !isPostOwner) {
      return res.status(403).json({
        status: 'fail',
        message: 'You are not authorized to delete this comment.'
      });
    }

    await Comment.findByIdAndDelete(id);

    return res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully.'
    });
  } catch (error) {
    console.error('[Delete Comment Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while deleting the comment.'
    });
  }
};
