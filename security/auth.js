const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

class SecurityManager {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.API_KEYS = new Set((process.env.API_KEYS || '').split(',').filter(key => key.length > 0));
    this.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);
    
    // Configurar API keys por defecto si no existen
    if (this.API_KEYS.size === 0) {
      this.API_KEYS.add('dev-key-12345');
      console.warn('⚠️  Using default API key. Set API_KEYS environment variable in production!');
    }
  }

  // Middleware de autenticación por API Key
  authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required', 
        message: 'Provide API key in X-API-Key header or api_key query parameter' 
      });
    }

    if (!this.API_KEYS.has(apiKey)) {
      console.warn(`🚨 Invalid API Key attempt: ${apiKey} from IP: ${this.getClientIP(req)}`);
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    req.apiKey = apiKey;
    next();
  }

  // Middleware de autenticación por JWT (para admin)
  authenticateJWT(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.warn(`🚨 Invalid JWT attempt from IP: ${this.getClientIP(req)}`);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // Login de administrador
  async adminLogin(username, password) {
    if (username !== 'admin') {
      return { success: false, error: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, this.ADMIN_PASSWORD_HASH);
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    const token = jwt.sign(
      { username: 'admin', role: 'admin' },
      this.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { 
      success: true, 
      token,
      expiresIn: '24h'
    };
  }

  // Validadores de entrada
  validateConvertRequest() {
    return [
      body('quality')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Quality must be between 1 and 100'),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ 
            error: 'Validation failed', 
            details: errors.array() 
          });
        }
        next();
      }
    ];
  }

  // Sanitizar nombre de archivo
  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
  }

  // Validar tipo de archivo
  validateFileType(file) {
    const allowedMimes = ['image/heic', 'image/heif'];
    const allowedExtensions = /\.(heic|heif)$/i;
    
    if (!allowedMimes.includes(file.mimetype) && !allowedExtensions.test(file.originalname)) {
      throw new Error('Only HEIC/HEIF files are allowed');
    }
    
    return true;
  }

  // Obtener IP del cliente
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           'unknown';
  }

  // Generar ID de sesión único
  generateSessionId() {
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  }

  // Log de eventos de seguridad
  logSecurityEvent(event, req, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'],
      apiKey: req.apiKey ? `***${req.apiKey.slice(-4)}` : 'none',
      ...details
    };
    
    console.log(`🔒 SECURITY: ${JSON.stringify(logEntry)}`);
  }
}

module.exports = new SecurityManager();