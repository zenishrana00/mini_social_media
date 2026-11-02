import User from '../models/user.model.js';
import { generateToken, setTokenCookie, clearTokenCookie } from '../utils/generateToken.js';

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
  try {
    const { name, username, email, password, bio, profilePicture } = req.body;

    // 1. Validate required fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide name, username, email, and password.'
      });
    }

    if (
      typeof name !== 'string' ||
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name, username, email, and password must be valid strings.'
      });
    }

    // 2. Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // 3. Check for existing email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({
        status: 'fail',
        message: 'An account with this email address already exists.'
      });
    }

    // 4. Check for existing username
    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      return res.status(400).json({
        status: 'fail',
        message: 'This username is already taken. Please choose another.'
      });
    }

    // 5. Create new user (password is automatically hashed by Mongoose pre-save hook)
    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      bio: bio ? bio.trim() : '',
      profilePicture: profilePicture ? profilePicture.trim() : ''
    });

    // 6. Generate JWT and attach to HttpOnly cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    // 7. Send success response (user.toJSON ensures password is never returned)
    return res.status(201).json({
      status: 'success',
      message: 'Account registered successfully.',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('[Register Controller Error]:', error);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        status: 'fail',
        message: messages.join('. ')
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while creating your account. Please try again.'
    });
  }
};

/**
 * @desc    Authenticate user & set token cookie
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input presence and type
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide both email/username and password.'
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide valid text for email/username and password.'
      });
    }

    const identifier = email.toLowerCase().trim();

    // 2. Find user by email OR username, explicitly requesting the password field
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    }).select('+password');

    // 3. Verify user existence and password correctness
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials. Please verify your details and try again.'
      });
    }

    // 4. Generate JWT and set HttpOnly cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    // 5. Return user object (password is omitted by toJSON)
    return res.status(200).json({
      status: 'success',
      message: 'Logged in successfully.',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('[Login Controller Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred during login. Please try again.'
    });
  }
};

/**
 * @desc    Log out current user & clear authentication cookie
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
export const logout = async (req, res) => {
  try {
    clearTokenCookie(res);
    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('[Logout Controller Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred during logout.'
    });
  }
};

/**
 * @desc    Get currently logged in user profile
 * @route   GET /api/v1/auth/me
 * @access  Private (Protected by auth middleware)
 */
export const getMe = async (req, res) => {
  // req.user is attached by protect middleware
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
};
