import rateLimit from 'express-rate-limit';

export const reportSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 submissions per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many submissions received from this network. Please wait a few moments before trying again.'
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. For security, please wait 15 minutes before retrying.'
  }
});
