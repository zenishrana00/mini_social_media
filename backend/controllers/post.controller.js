import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import Comment from '../models/comment.model.js';
import Follow from '../models/follow.model.js';

// Safe URL validator for image attachments
const isValidHttpUrl = (str) => {
  if (!str) return true;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

/**
 * @desc    Create a new post
 * @route   POST /api/v1/posts
 * @access  Private (Authenticated)
 */
export const createPost = async (req, res) => {
  try {
    // Never trust author ID supplied in req.body; always bind to authenticated req.user._id
    const authorId = req.user._id;
    const { content, imageUrl } = req.body;

    // Validate content presence and length
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Post content cannot be empty.'
      });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Post content cannot exceed 1000 characters.'
      });
    }

    // Validate optional image URL
    if (imageUrl && !isValidHttpUrl(imageUrl.trim())) {
      return res.status(400).json({
        status: 'fail',
        message: 'Image URL must be a valid HTTP or HTTPS address.'
      });
    }

    // Create the post document
    const post = await Post.create({
      author: authorId,
      content: content.trim(),
      imageUrl: imageUrl ? imageUrl.trim() : ''
    });

    // Populate safe author profile fields (omitting passwords, emails, etc.)
    await post.populate('author', 'name username profilePicture');

    return res.status(201).json({
      status: 'success',
      message: 'Post created successfully.',
      data: {
        post
      }
    });
  } catch (error) {
    console.error('[Create Post Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while creating the post.'
    });
  }
};

/**
 * @desc    Get home feed posts (newest first, paginated)
 * @route   GET /api/v1/posts
 * @access  Private (Authenticated)
 */
export const getFeed = async (req, res) => {
  try {
    // Pagination parameters with safe defaults and bounded limits
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username profilePicture')
      .lean();

    return res.status(200).json({
      status: 'success',
      results: posts.length,
      pagination: {
        totalPosts,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        limit
      },
      data: {
        posts
      }
    });
  } catch (error) {
    console.error('[Get Feed Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving the home feed.'
    });
  }
};

/**
 * @desc    Get single post by ID
 * @route   GET /api/v1/posts/:id
 * @access  Public
 */
export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    const post = await Post.findById(id)
      .populate('author', 'name username profilePicture')
      .lean();

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        post
      }
    });
  } catch (error) {
    console.error('[Get Post By ID Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving the post.'
    });
  }
};

/**
 * @desc    Get all posts by a specific user
 * @route   GET /api/v1/posts/user/:userId
 * @access  Public
 */
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    // Verify target user exists
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const totalPosts = await Post.countDocuments({ author: userId });
    const totalPages = Math.ceil(totalPosts / limit);

    const posts = await Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username profilePicture')
      .lean();

    return res.status(200).json({
      status: 'success',
      results: posts.length,
      pagination: {
        totalPosts,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        limit
      },
      data: {
        posts
      }
    });
  } catch (error) {
    console.error('[Get User Posts Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving user posts.'
    });
  }
};

/**
 * @desc    Update a post (author only)
 * @route   PATCH /api/v1/posts/:id
 * @access  Private (Author only)
 */
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    // Author check: strictly prohibit editing another user's post
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You are not authorized to edit this post.'
      });
    }

    // Validate update fields
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Post content cannot be empty.'
        });
      }
      if (content.trim().length > 1000) {
        return res.status(400).json({
          status: 'fail',
          message: 'Post content cannot exceed 1000 characters.'
        });
      }
      post.content = content.trim();
    }

    if (imageUrl !== undefined) {
      if (imageUrl && !isValidHttpUrl(imageUrl.trim())) {
        return res.status(400).json({
          status: 'fail',
          message: 'Image URL must be a valid HTTP or HTTPS address.'
        });
      }
      post.imageUrl = imageUrl ? imageUrl.trim() : '';
    }

    await post.save();
    await post.populate('author', 'name username profilePicture');

    return res.status(200).json({
      status: 'success',
      message: 'Post updated successfully.',
      data: {
        post
      }
    });
  } catch (error) {
    console.error('[Update Post Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating the post.'
    });
  }
};

/**
 * @desc    Delete a post (author only)
 * @route   DELETE /api/v1/posts/:id
 * @access  Private (Author only)
 */
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid post ID format.'
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        status: 'fail',
        message: 'Post not found.'
      });
    }

    // Author check: strictly prohibit deleting another user's post
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You are not authorized to delete this post.'
      });
    }

    await Post.findByIdAndDelete(id);

    // Clean up comments associated with the deleted post
    await Comment.deleteMany({ post: id });

    return res.status(200).json({
      status: 'success',
      message: 'Post deleted successfully.'
    });
  } catch (error) {
    console.error('[Delete Post Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while deleting the post.'
    });
  }
};


/**
 * @desc    Get personalized following feed (posts from followed users + own posts)
 * @route   GET /api/v1/posts/feed
 * @access  Private (Authenticated)
 */
export const getFollowingFeed = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get the list of user IDs that the current user follows
    const followDocs = await Follow.find({ follower: userId }).select('following').lean();
    const followingIds = followDocs.map((f) => f.following);

    // Include the current user's own posts too
    const feedAuthors = [...followingIds, userId];

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const totalPosts = await Post.countDocuments({ author: { $in: feedAuthors } });
    const totalPages = Math.ceil(totalPosts / limit);

    const posts = await Post.find({ author: { $in: feedAuthors } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username profilePicture')
      .lean();

    return res.status(200).json({
      status: 'success',
      results: posts.length,
      pagination: {
        totalPosts,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        limit
      },
      data: {
        posts
      }
    });
  } catch (error) {
    console.error('[Get Following Feed Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving the following feed.'
    });
  }
};
