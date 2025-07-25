const rateLimit = require('express-rate-limit');

// Rate limiter para conversiones (más restrictivo)
const convertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 conversiones por IP por ventana
  message: {
    error: 'Too many conversion requests',
    message: 'Maximum 20 conversions per 15 minutes per IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚨 Rate limit exceeded for IP: ${req.ip} on conversion endpoint`);
    res.status(429).json({
      error: 'Too many conversion requests',
      message: 'Maximum 20 conversions per 15 minutes per IP',
      retryAfter: '15 minutes'
    });
  }
});

// Rate limiter general (menos restrictivo)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: {
    error: 'Too many requests',
    message: 'Maximum 100 requests per 15 minutes per IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para login (muy restrictivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP
  message: {
    error: 'Too many login attempts',
    message: 'Maximum 5 login attempts per 15 minutes per IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚨 Login rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Maximum 5 login attempts per 15 minutes per IP',
      retryAfter: '15 minutes'
    });
  }
});

module.exports = {
  convertLimiter,
  generalLimiter,
  loginLimiter
};