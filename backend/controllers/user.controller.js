import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Follow from '../models/follow.model.js';

/**
 * Escapes special characters for regular expressions to prevent ReDoS and regex injection
 * @param {string} str - Raw input string
 * @returns {string} - Escaped safe regex string
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * @desc    Get public user profile by ID
 * @route   GET /api/v1/users/:id
 * @access  Public
 */
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user ID format.'
      });
    }

    // Find user excluding password
    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.'
      });
    }

    // Prepare public profile representation with real follow counts
    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id })
    ]);

    const publicProfile = {
      _id: user._id,
      name: user.name,
      username: user.username,
      bio: user.bio || '',
      profilePicture: user.profilePicture || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      followersCount,
      followingCount
    };

    return res.status(200).json({
      status: 'success',
      data: {
        user: publicProfile
      }
    });
  } catch (error) {
    console.error('[Get User Profile Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching the user profile.'
    });
  }
};

/**
 * @desc    Update current logged-in user profile
 * @route   PATCH /api/v1/users/me
 * @access  Private (Requires valid JWT)
 */
export const updateUserProfile = async (req, res) => {
  try {
    // Current authenticated user is extracted securely from req.user (from auth middleware)
    // Never trust a client-supplied user ID in the request body
    const currentUserId = req.user._id;

    // Explicitly reject any attempts to modify restricted or sensitive fields
    const restrictedFields = ['password', 'email', 'role', 'roles', '_id', 'id', 'resetPasswordToken'];
    const attemptedRestricted = restrictedFields.filter((field) => field in req.body);

    if (attemptedRestricted.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Modifying restricted field(s): ${attemptedRestricted.join(', ')} is not allowed through this endpoint.`
      });
    }

    const { name, username, bio, profilePicture } = req.body;

    // Ensure at least one valid field is provided for update
    if (
      name === undefined &&
      username === undefined &&
      bio === undefined &&
      profilePicture === undefined
    ) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide at least one field to update (name, username, bio, profilePicture).'
      });
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User account not found.'
      });
    }

    // 1. Validate and update name
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Name cannot be empty.'
        });
      }
      if (name.trim().length > 50) {
        return res.status(400).json({
          status: 'fail',
          message: 'Name cannot exceed 50 characters.'
        });
      }
      user.name = name.trim();
    }

    // 2. Validate and update username
    if (username !== undefined) {
      if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Username cannot be empty.'
        });
      }

      const normalizedUsername = username.toLowerCase().trim();

      if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
        return res.status(400).json({
          status: 'fail',
          message: 'Username must be between 3 and 30 characters.'
        });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Username may only contain letters, numbers, and underscores.'
        });
      }

      // Check for username collision with other users
      if (normalizedUsername !== user.username) {
        const existingUsername = await User.findOne({
          username: normalizedUsername,
          _id: { $ne: currentUserId }
        });

        if (existingUsername) {
          return res.status(400).json({
            status: 'fail',
            message: 'This username is already taken. Please choose another.'
          });
        }
        user.username = normalizedUsername;
      }
    }

    // 3. Validate and update bio
    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return res.status(400).json({
          status: 'fail',
          message: 'Bio must be a valid text string.'
        });
      }
      if (bio.trim().length > 250) {
        return res.status(400).json({
          status: 'fail',
          message: 'Bio cannot exceed 250 characters.'
        });
      }
      user.bio = bio.trim();
    }

    // 4. Validate and update profile picture URL
    if (profilePicture !== undefined) {
      if (typeof profilePicture !== 'string') {
        return res.status(400).json({
          status: 'fail',
          message: 'Profile picture must be a valid string URL.'
        });
      }
      user.profilePicture = profilePicture.trim();
    }

    // Save updated user document (password unchanged, pre('save') won't re-hash)
    await user.save();

    // Fetch real follow counts for response
    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id })
    ]);

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          bio: user.bio,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          followersCount,
          followingCount
        }
      }
    });
  } catch (error) {
    console.error('[Update User Profile Error]:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        status: 'fail',
        message: messages.join('. ')
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating your profile.'
    });
  }
};

/**
 * @desc    Search users by name or username
 * @route   GET /api/v1/users/search?q=...
 * @access  Public
 */
export const searchUsers = async (req, res) => {
  try {
    const rawQuery = req.query.q;

    // Return empty results if query is empty or missing
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: {
          users: []
        }
      });
    }

    // Sanitize search string to prevent ReDoS / regex injection
    const safeQuery = escapeRegex(rawQuery.trim());
    const searchRegex = new RegExp(safeQuery, 'i');

    // Query users matching name or username, limiting to top 15 results
    // Select only safe public fields
    const users = await User.find({
      $or: [
        { name: { $regex: searchRegex } },
        { username: { $regex: searchRegex } }
      ]
    })
      .select('_id name username bio profilePicture createdAt')
      .limit(15);

    return res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users
      }
    });
  } catch (error) {
    console.error('[Search Users Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while searching for users.'
    });
  }
};
