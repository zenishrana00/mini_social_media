/**
 * In-memory sliding window rate limiter middleware for sensitive endpoints.
 * Protects against brute-force attacks on login and registration.
 *
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 mins)
 * @param {number} options.max - Maximum allowed requests per window (default: 15)
 * @param {string} options.message - Error message when rate limit is exceeded
 */
export const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 15;
  const message = options.message || 'Too many attempts from this IP. Please try again later.';

  // Map of IP -> array of timestamps
  const hits = new Map();

  // Periodic cleanup of expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const validTimestamps = timestamps.filter((time) => now - time < windowMs);
      if (validTimestamps.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, validTimestamps);
      }
    }
  }, 5 * 60 * 1000).unref(); // unref so it doesn't keep node process alive

  return (req, res, next) => {
    // Disable rate limiting during automated integration tests
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const clientTimestamps = (hits.get(ip) || []).filter((time) => now - time < windowMs);

    if (clientTimestamps.length >= max) {
      const oldestHit = clientTimestamps[0];
      const retryAfterSeconds = Math.ceil((oldestHit + windowMs - now) / 1000);

      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        status: 'fail',
        message
      });
    }

    clientTimestamps.push(now);
    hits.set(ip, clientTimestamps);

    next();
  };
};
