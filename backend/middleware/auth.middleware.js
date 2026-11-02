import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

/**
 * Middleware to protect private routes using JWT authentication.
 * Checks for token in HttpOnly cookie first, then in the Authorization Bearer header.
 */
export const protect = async (req, res, next) => {
  let token;

  // 1. Prefer token from HttpOnly cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization: Bearer <token> header for API consumers/testing
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token is provided, reject request
  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'Not authorized. Please log in to access this resource.'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_fallback_secret_key');

    // Retrieve user associated with this token (excluding password)
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // Attach authenticated user to request object
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error.message);
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired token. Please log in again.'
    });
  }
};
