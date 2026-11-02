import mongoose from 'mongoose';
import Follow from '../models/follow.model.js';
import User from '../models/user.model.js';

/**
 * @desc    Follow a user
 * @route   POST /api/v1/users/:id/follow
 * @access  Private (Authenticated)
 */
export const followUser = async (req, res) => {
  try {
    const { id } = req.params;
    const followerId = req.user._id;

    // Validate target user ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    // Prevent self-following
    if (followerId.toString() === id) {
      return res.status(400).json({
        status: 'fail',
        message: 'You cannot follow yourself.'
      });
    }

    // Check target user exists
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    // Create follow relationship (unique index prevents duplicates)
    try {
      await Follow.create({ follower: followerId, following: id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          status: 'fail',
          message: 'You are already following this user.'
        });
      }
      throw err;
    }

    // Return updated counts
    const followersCount = await Follow.countDocuments({ following: id });
    const followingCount = await Follow.countDocuments({ follower: followerId });

    return res.status(200).json({
      status: 'success',
      message: `You are now following ${targetUser.name}.`,
      data: {
        isFollowing: true,
        followersCount,
        followingCount
      }
    });
  } catch (error) {
    console.error('[Follow User Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while following the user.'
    });
  }
};

/**
 * @desc    Unfollow a user
 * @route   DELETE /api/v1/users/:id/follow
 * @access  Private (Authenticated)
 */
export const unfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const followerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    // Check target user exists
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    const result = await Follow.findOneAndDelete({
      follower: followerId,
      following: id
    });

    if (!result) {
      return res.status(400).json({
        status: 'fail',
        message: 'You are not following this user.'
      });
    }

    const followersCount = await Follow.countDocuments({ following: id });
    const followingCount = await Follow.countDocuments({ follower: followerId });

    return res.status(200).json({
      status: 'success',
      message: `You have unfollowed ${targetUser.name}.`,
      data: {
        isFollowing: false,
        followersCount,
        followingCount
      }
    });
  } catch (error) {
    console.error('[Unfollow User Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while unfollowing the user.'
    });
  }
};

/**
 * @desc    Get followers of a user (paginated)
 * @route   GET /api/v1/users/:id/followers
 * @access  Public
 */
export const getFollowers = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    const userExists = await User.exists({ _id: id });
    if (!userExists) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const totalFollowers = await Follow.countDocuments({ following: id });
    const totalPages = Math.ceil(totalFollowers / limit);

    const followers = await Follow.find({ following: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('follower', 'name username profilePicture bio')
      .lean();

    // Extract the populated user objects
    const users = followers.map((f) => f.follower);

    return res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        total: totalFollowers,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        limit
      },
      data: {
        users
      }
    });
  } catch (error) {
    console.error('[Get Followers Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving followers.'
    });
  }
};

/**
 * @desc    Get users that a user is following (paginated)
 * @route   GET /api/v1/users/:id/following
 * @access  Public
 */
export const getFollowing = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    const userExists = await User.exists({ _id: id });
    if (!userExists) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const totalFollowing = await Follow.countDocuments({ follower: id });
    const totalPages = Math.ceil(totalFollowing / limit);

    const following = await Follow.find({ follower: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('following', 'name username profilePicture bio')
      .lean();

    const users = following.map((f) => f.following);

    return res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        total: totalFollowing,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        limit
      },
      data: {
        users
      }
    });
  } catch (error) {
    console.error('[Get Following Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving following list.'
    });
  }
};

/**
 * @desc    Get follow status between current user and target user
 * @route   GET /api/v1/users/:id/follow-status
 * @access  Private (Authenticated)
 */
export const getFollowStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    const userExists = await User.exists({ _id: id });
    if (!userExists) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    const isFollowing = await Follow.exists({
      follower: req.user._id,
      following: id
    });

    const followersCount = await Follow.countDocuments({ following: id });
    const followingCount = await Follow.countDocuments({ follower: id });

    return res.status(200).json({
      status: 'success',
      data: {
        isFollowing: !!isFollowing,
        followersCount,
        followingCount
      }
    });
  } catch (error) {
    console.error('[Get Follow Status Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while checking follow status.'
    });
  }
};
