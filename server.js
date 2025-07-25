const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const HEICConverter = require('./converter');
const security = require('./security/auth');
const { convertLimiter, generalLimiter, loginLimiter } = require('./security/rateLimiter');

const app = express();
const port = process.env.PORT || 4545;

// Configuración de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS con configuración segura
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (aplicaciones móviles, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Logging de requests
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      console.log(`📝 ${message.trim()}`);
    }
  }
}));

// Rate limiting general
app.use(generalLimiter);

// Parsing de JSON con límite de tamaño
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Asegurar que los directorios necesarios existan
async function ensureDirectories() {
  await fs.ensureDir('/tmp/uploads');
  await fs.ensureDir('/tmp/converted');
}

// Configurar multer con validaciones de seguridad
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, '/tmp/uploads');
  },
  filename: (req, file, cb) => {
    const sessionId = security.generateSessionId();
    const sanitizedName = security.sanitizeFilename(file.originalname);
    cb(null, `${sessionId}-${sanitizedName}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    try {
      security.validateFileType(file);
      cb(null, true);
    } catch (error) {
      security.logSecurityEvent('INVALID_FILE_TYPE', req, { 
        filename: file.originalname,
        mimetype: file.mimetype,
        error: error.message 
      });
      cb(error, false);
    }
  }
});

// Variables para analíticas con información de seguridad
let analytics = {
  totalConversions: 0,
  successfulConversions: 0,
  totalFileSize: 0,
  totalProcessingTime: 0,
  securityEvents: {
    invalidApiKeys: 0,
    rateLimitHits: 0,
    invalidFiles: 0
  }
};

// Página principal con información de seguridad
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🔒 Secure HEIC to JPEG Converter</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="X-Content-Type-Options" content="nosniff">
        <meta http-equiv="X-Frame-Options" content="DENY">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                max-width: 900px; 
                margin: 50px auto; 
                padding: 20px; 
                background: #f8f9fa;
            }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .security-notice { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3; }
            .upload-area { border: 2px dashed #ddd; padding: 40px; text-align: center; margin: 20px 0; border-radius: 10px; }
            .upload-area:hover { border-color: #007bff; background: #f8f9ff; }
            .form-group { margin: 15px 0; }
            label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
            input[type="text"], input[type="password"], input[type="number"] { 
                width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;
            }
            button { 
                background: #007bff; color: white; padding: 12px 24px; border: none; 
                border-radius: 5px; cursor: pointer; font-size: 16px; margin: 5px;
            }
            button:hover { background: #0056b3; }
            button.secondary { background: #6c757d; }
            button.secondary:hover { background: #545b62; }
            .result { margin: 20px 0; padding: 15px; border-radius: 5px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
            .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
            .analytics { margin: 20px 0; padding: 15px; background: #e8f5e8; border-radius: 5px; }
            .security-info { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .hidden { display: none; }
            .tabs { display: flex; margin-bottom: 20px; }
            .tab { padding: 10px 20px; background: #f8f9fa; border: 1px solid #ddd; cursor: pointer; }
            .tab.active { background: #007bff; color: white; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔒 Secure HEIC to JPEG Converter</h1>
            
            <div class="security-notice">
                <strong>🛡️ Security Features:</strong>
                <ul>
                    <li>🔑 API Key Authentication Required</li>
                    <li>🚦 Rate Limiting (20 conversions per 15 minutes)</li>
                    <li>📁 File Type Validation</li>
                    <li>🔍 Security Event Logging</li>
                    <li>🌐 CORS Protection</li>
                </ul>
            </div>

            <div class="tabs">
                <div class="tab active" onclick="showTab('convert')">Convert Files</div>
                <div class="tab" onclick="showTab('admin')">Admin Login</div>
            </div>

            <!-- Convert Tab -->
            <div id="convert-tab" class="tab-content active">
                <div class="security-info">
                    <strong>⚠️ API Key Required:</strong> You need a valid API key to use this service.
                </div>
                
                <form id="uploadForm" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="apiKey">🔑 API Key:</label>
                        <input type="text" id="apiKey" name="apiKey" placeholder="Enter your API key" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="quality">🎯 JPEG Quality (1-100):</label>
                        <input type="number" id="quality" name="quality" min="1" max="100" value="85">
                    </div>
                    
                    <div class="upload-area">
                        <input type="file" id="fileInput" name="file" accept=".heic,.heif" style="display: none;">
                        <button type="button" onclick="document.getElementById('fileInput').click()">
                            📁 Select HEIC File
                        </button>
                        <p>Maximum file size: 50MB</p>
                    </div>
                    
                    <button type="submit">🚀 Convert to JPEG</button>
                </form>
            </div>

            <!-- Admin Tab -->
            <div id="admin-tab" class="tab-content">
                <form id="loginForm">
                    <div class="form-group">
                        <label for="username">👤 Username:</label>
                        <input type="text" id="username" name="username" value="admin" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">🔒 Password:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    
                    <button type="submit">🔐 Login</button>
                </form>
                
                <div id="adminPanel" class="hidden">
                    <h3>📊 Admin Dashboard</h3>
                    <button onclick="loadAnalytics()">🔄 Refresh Analytics</button>
                    <button onclick="viewSecurityLogs()" class="secondary">🔒 Security Logs</button>
                </div>
            </div>
            
            <div id="result"></div>
            <div id="analytics"></div>
        </div>

        <script>
            let authToken = null;

            function showTab(tabName) {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                
                event.target.classList.add('active');
                document.getElementById(tabName + '-tab').classList.add('active');
            }

            // Login form
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                
                try {
                    const response = await fetch('/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: formData.get('username'),
                            password: formData.get('password')
                        })
                    });

                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                        authToken = data.token;
                        document.getElementById('adminPanel').classList.remove('hidden');
                        document.getElementById('result').innerHTML = 
                            '<div class="result success">✅ Admin login successful!</div>';
                        loadAnalytics();
                    } else {
                        document.getElementById('result').innerHTML = 
                            \`<div class="result error">❌ Login failed: \${data.error}</div>\`;
                    }
                } catch (error) {
                    document.getElementById('result').innerHTML = 
                        \`<div class="result error">❌ Login error: \${error.message}</div>\`;
                }
            });

            // Convert form
            document.getElementById('uploadForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData();
                const file = document.getElementById('fileInput').files[0];
                const apiKey = document.getElementById('apiKey').value;
                const quality = document.getElementById('quality').value;
                
                if (!file || !apiKey) {
                    document.getElementById('result').innerHTML = 
                        '<div class="result error">Please select a file and enter API key!</div>';
                    return;
                }

                formData.append('file', file);
                if (quality) formData.append('quality', quality);

                try {
                    document.getElementById('result').innerHTML = 
                        '<div class="result">🔄 Converting file...</div>';
                    
                    const response = await fetch('/convert', {
                        method: 'POST',
                        headers: { 'X-API-Key': apiKey },
                        body: formData
                    });

                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                        document.getElementById('result').innerHTML = \`
                            <div class="result success">
                                ✅ Successfully converted: \${data.originalName}<br>
                                📁 File size: \${data.fileSize} MB<br>
                                ⏱️ Processing time: \${data.processingTime}ms<br>
                                🔒 Session ID: \${data.sessionId}<br>
                                <a href="/download/\${data.filename}?api_key=\${apiKey}" download>📥 Download JPEG</a>
                            </div>
                        \`;
                    } else {
                        document.getElementById('result').innerHTML = 
                            \`<div class="result error">❌ Error: \${data.error}</div>\`;
                    }
                } catch (error) {
                    document.getElementById('result').innerHTML = 
                        \`<div class="result error">❌ Error: \${error.message}</div>\`;
                }
            });

            function loadAnalytics() {
                if (!authToken) return;
                
                fetch('/admin/analytics', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                })
                .then(res => res.json())
                .then(data => {
                    document.getElementById('analytics').innerHTML = \`
                        <div class="analytics">
                            <h3>📊 Analytics & Security</h3>
                            <p><strong>Total conversions:</strong> \${data.totalConversions}</p>
                            <p><strong>Success rate:</strong> \${data.successRate}%</p>
                            <p><strong>Average file size:</strong> \${data.avgFileSize} MB</p>
                            <p><strong>Invalid API key attempts:</strong> \${data.securityEvents.invalidApiKeys}</p>
                            <p><strong>Rate limit hits:</strong> \${data.securityEvents.rateLimitHits}</p>
                            <p><strong>Invalid file attempts:</strong> \${data.securityEvents.invalidFiles}</p>
                        </div>
                    \`;
                });
            }
        </script>
    </body>
    </html>
  `);
});

// Login de administrador
app.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await security.adminLogin(username, password);
    
    if (result.success) {
      security.logSecurityEvent('ADMIN_LOGIN_SUCCESS', req, { username });
      res.json(result);
    } else {
      security.logSecurityEvent('ADMIN_LOGIN_FAILED', req, { username, error: result.error });
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint para conversión con autenticación
app.post('/convert', 
  convertLimiter, 
  security.authenticateApiKey.bind(security),
  upload.single('file'), 
  security.validateConvertRequest(),
  async (req, res) => {
    const startTime = Date.now();
    const sessionId = security.generateSessionId();
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      security.logSecurityEvent('CONVERSION_STARTED', req, { 
        filename: req.file.originalname,
        sessionId 
      });

      const converter = new HEICConverter();
      const outputFileName = `${sessionId}-${req.file.filename.replace(/\.(heic|heif)$/i, '.jpg')}`;
      const outputPath = path.join('/tmp/converted', outputFileName);
      
      // Usar calidad personalizada si se proporciona
      if (req.body.quality) {
        converter.quality = parseInt(req.body.quality);
      }
      
      const result = await converter.convertSingleFile(req.file.path, outputPath);
      const processingTime = Date.now() - startTime;
      
      // Actualizar analíticas
      analytics.totalConversions++;
      analytics.totalProcessingTime += processingTime;
      
      if (result.success) {
        analytics.successfulConversions++;
        analytics.totalFileSize += result.size / (1024 * 1024);
        
        security.logSecurityEvent('CONVERSION_SUCCESS', req, { 
          sessionId,
          fileSize: result.size,
          processingTime 
        });
        
        res.json({
          success: true,
          filename: outputFileName,
          originalName: req.file.originalname,
          fileSize: (result.size / (1024 * 1024)).toFixed(2),
          processingTime,
          sessionId
        });
      } else {
        security.logSecurityEvent('CONVERSION_FAILED', req, { 
          sessionId,
          error: result.error 
        });
        
        res.status(500).json({ 
          success: false, 
          error: result.error,
          sessionId
        });
      }

      // Limpiar archivo de entrada
      setTimeout(() => {
        fs.remove(req.file.path).catch(console.error);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('Conversion error:', error);
      security.logSecurityEvent('CONVERSION_ERROR', req, { 
        sessionId,
        error: error.message 
      });
      
      res.status(500).json({ 
        error: error.message,
        sessionId
      });
    }
  }
);

// Endpoint para descarga con autenticación
app.get('/download/:filename', security.authenticateApiKey.bind(security), async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('/tmp/converted', filename);
    
    // Validaciones de seguridad
    if (!filename.endsWith('.jpg') || filename.includes('..') || filename.includes('/')) {
      security.logSecurityEvent('INVALID_DOWNLOAD_ATTEMPT', req, { filename });
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    security.logSecurityEvent('FILE_DOWNLOAD', req, { filename });
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      } else {
        // Eliminar archivo después de la descarga
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 30000);
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para analíticas de administrador
app.get('/admin/analytics', security.authenticateJWT.bind(security), (req, res) => {
  const successRate = analytics.totalConversions > 0 
    ? ((analytics.successfulConversions / analytics.totalConversions) * 100).toFixed(1)
    : 0;
  
  const avgFileSize = analytics.successfulConversions > 0
    ? (analytics.totalFileSize / analytics.successfulConversions).toFixed(2)
    : 0;

  res.json({
    totalConversions: analytics.totalConversions,
    successfulConversions: analytics.successfulConversions,
    successRate: parseFloat(successRate),
    avgFileSize: parseFloat(avgFileSize),
    avgProcessingTime: analytics.totalConversions > 0 
      ? Math.round(analytics.totalProcessingTime / analytics.totalConversions)
      : 0,
    securityEvents: analytics.securityEvents
  });
});

// Health check público
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    security: 'enabled'
  });
});

// Manejo de errores de seguridad
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      analytics.securityEvents.invalidFiles++;
      return res.status(413).json({ error: 'File too large (max 50MB)' });
    }
  }
  
  console.error('Security error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  security.logSecurityEvent('404_ACCESS_ATTEMPT', req, { path: req.originalUrl });
  res.status(404).json({ error: 'Endpoint not found' });
});

// Inicializar servidor
const server = app.listen(port, '0.0.0.0', () => {
  ensureDirectories().catch(console.error);
  console.log(`🔒 Secure HEIC to JPEG Converter running on http://0.0.0.0:${port}`);
  console.log(`🔑 Security features enabled:`);
  console.log(`   - API Key Authentication`);
  console.log(`   - Rate Limiting`);
  console.log(`   - File Validation`);
  console.log(`   - Security Headers`);
  console.log(`   - Event Logging`);
  console.log(`📊 Admin panel: http://0.0.0.0:${port}/ (admin tab)`);
  console.log(`🏥 Health check: http://0.0.0.0:${port}/health`);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});