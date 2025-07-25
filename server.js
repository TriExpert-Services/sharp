const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const HEICConverter = require('./converter');

const app = express();
const port = process.env.PORT || 3000;

// Asegurar que los directorios necesarios existan
async function ensureDirectories() {
  await fs.ensureDir('/tmp/uploads');
  await fs.ensureDir('/tmp/converted');
}

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, '/tmp/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max por archivo
    files: 1 // máximo 1 archivo para n8n
  },
  fileFilter: (req, file, cb) => {
    if (/\.(heic|heif)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only HEIC/HEIF files are allowed!'), false);
    }
  }
});

app.use(express.static('public'));
app.use(express.json());

// Página principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>HEIC to JPEG Converter</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; }
            .upload-area:hover { border-color: #007bff; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .result { margin: 20px 0; padding: 15px; border-radius: 5px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
            .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
            .analytics { margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h1>🔄 HEIC to JPEG Converter</h1>
        <p>Upload your HEIC/HEIF file and convert it to JPEG format for n8n processing.</p>
        
        <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-area">
                <input type="file" id="fileInput" name="file" accept=".heic,.heif" style="display: none;">
                <button type="button" onclick="document.getElementById('fileInput').click()">
                    📁 Select HEIC File
                </button>
                <p>or drag and drop a file here</p>
            </div>
            <button type="submit">🚀 Convert to JPEG</button>
        </form>
        
        <div id="result"></div>
        <div id="analytics"></div>

        <script>
            const form = document.getElementById('uploadForm');
            const fileInput = document.getElementById('fileInput');
            const result = document.getElementById('result');
            const analytics = document.getElementById('analytics');

            // Mostrar analíticas al cargar
            fetch('/analytics')
              .then(res => res.json())
              .then(data => {
                analytics.innerHTML = \`
                  <div class="analytics">
                    <h3>📊 Analytics</h3>
                    <p>Total conversions: \${data.totalConversions}</p>
                    <p>Success rate: \${data.successRate}%</p>
                    <p>Average file size: \${data.avgFileSize} MB</p>
                  </div>
                \`;
              });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData();
                const file = fileInput.files[0];
                
                if (!file) {
                    result.innerHTML = '<div class="result error">Please select a file first!</div>';
                    return;
                }

                formData.append('file', file);

                try {
                    result.innerHTML = '<div class="result">🔄 Converting file...</div>';
                    
                    const response = await fetch('/convert', {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                        result.innerHTML = \`
                          <div class="result success">
                            ✅ Successfully converted: \${data.originalName}<br>
                            📁 File size: \${data.fileSize} MB<br>
                            ⏱️ Processing time: \${data.processingTime}ms<br>
                            <a href="/download/\${data.filename}" download>📥 Download JPEG</a>
                          </div>
                        \`;
                        
                        // Actualizar analíticas
                        fetch('/analytics')
                          .then(res => res.json())
                          .then(data => {
                            analytics.innerHTML = \`
                              <div class="analytics">
                                <h3>📊 Analytics</h3>
                                <p>Total conversions: \${data.totalConversions}</p>
                                <p>Success rate: \${data.successRate}%</p>
                                <p>Average file size: \${data.avgFileSize} MB</p>
                              </div>
                            \`;
                          });
                    } else {
                        result.innerHTML = \`<div class="result error">❌ Error: \${data.error}</div>\`;
                    }
                } catch (error) {
                    result.innerHTML = \`<div class="result error">❌ Error: \${error.message}</div>\`;
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Variables para analíticas
let analytics = {
  totalConversions: 0,
  successfulConversions: 0,
  totalFileSize: 0,
  totalProcessingTime: 0
};

// Endpoint para conversión de archivo único
app.post('/convert', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const converter = new HEICConverter();
    const outputFileName = req.file.filename.replace(/\.(heic|heif)$/i, '.jpg');
    const outputPath = path.join('/tmp/converted', outputFileName);
    
    const result = await converter.convertSingleFile(req.file.path, outputPath);
    const processingTime = Date.now() - startTime;
    
    // Actualizar analíticas
    analytics.totalConversions++;
    analytics.totalProcessingTime += processingTime;
    
    if (result.success) {
      analytics.successfulConversions++;
      analytics.totalFileSize += result.size / (1024 * 1024); // MB
      
      res.json({
        success: true,
        filename: outputFileName,
        originalName: req.file.originalname,
        fileSize: (result.size / (1024 * 1024)).toFixed(2),
        processingTime
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    // Limpiar archivo de entrada después de un tiempo
    setTimeout(() => {
      fs.remove(req.file.path).catch(console.error);
    }, 5 * 60 * 1000); // 5 minutos

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para descargar archivo convertido
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('/tmp/converted', filename);
    
    // Verificar que el archivo existe y es seguro
    if (!fs.existsSync(filePath) || !filename.endsWith('.jpg')) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      } else {
        // Eliminar archivo después de la descarga
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 30000); // 30 segundos
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para analíticas
app.get('/analytics', (req, res) => {
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
      : 0
  });
});

// Health check endpoint para n8n
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Inicializar directorios al iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  ensureDirectories().catch(console.error);
  console.log(`🌐 HEIC to JPEG Converter server running on http://0.0.0.0:${port}`);
  console.log(`📊 Analytics available at http://0.0.0.0:${port}/analytics`);
  console.log(`🏥 Health check at http://0.0.0.0:${port}/health`);
});