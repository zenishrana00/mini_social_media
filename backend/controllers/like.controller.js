import mongoose from 'mongoose';
import Post from '../models/post.model.js';

/**
 * @desc    Like a post
 * @route   PUT /api/v1/posts/:id/like
 * @access  Private (Authenticated)
 */
export const likePost = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate post ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    // Use atomic $addToSet to prevent duplicate likes
    const post = await Post.findByIdAndUpdate(
      id,
      { $addToSet: { likes: req.user._id } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        likesCount: post.likes.length,
        isLiked: true
      }
    });
  } catch (error) {
    console.error('[Like Post Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while liking the post.'
    });
  }
};

/**
 * @desc    Unlike a post
 * @route   DELETE /api/v1/posts/:id/like
 * @access  Private (Authenticated)
 */
export const unlikePost = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate post ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    // Use atomic $pull to remove the user's like
    const post = await Post.findByIdAndUpdate(
      id,
      { $pull: { likes: req.user._id } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        likesCount: post.likes.length,
        isLiked: false
      }
    });
  } catch (error) {
    console.error('[Unlike Post Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while unliking the post.'
    });
  }
};
