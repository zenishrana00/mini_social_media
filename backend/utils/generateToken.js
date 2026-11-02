import jwt from 'jsonwebtoken';

/**
 * Generate a JSON Web Token (JWT)
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {string} - Signed JWT
 */
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'dev_fallback_secret_key', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

/**
 * Set HttpOnly cookie with JWT on response object
 * @param {Object} res - Express response object
 * @param {string} token - Signed JWT
 */
export const setTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // 30 days in milliseconds (matches default 30d expiry)
  const maxAge = 30 * 24 * 60 * 60 * 1000;

  res.cookie('token', token, {
    httpOnly: true, // Prevents client-side JS from reading cookie (protects against XSS)
    secure: isProduction, // Only transmit over HTTPS in production
    sameSite: isProduction ? 'strict' : 'lax', // CSRF mitigation
    maxAge
  });
};

/**
 * Clear the authentication cookie on logout
 * @param {Object} res - Express response object
 */
export const clearTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0), // Immediate expiration
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax'
  });
};
