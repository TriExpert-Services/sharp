const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');
const HEICConverter = require('./converter');

const app = express();
const port = process.env.PORT || 3000;

// Asegurar que los directorios necesarios existan
async function ensureDirectories() {
  await fs.ensureDir('/tmp/uploads');
  await fs.ensureDir('/tmp/converted');
  await fs.ensureDir('/tmp/downloads');
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
    files: 10 // máximo 10 archivos
  },
  fileFilter: (req, file, cb) => {
    if (/\.(heic|heif)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only HEIC/HEIF files are allowed!'), false);
    }
  }
});

// Función para crear ZIP
async function createZip(files, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`📦 ZIP created: ${archive.pointer()} total bytes`);
      resolve(zipPath);
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    files.forEach(file => {
      if (fs.existsSync(file)) {
        archive.file(file, { name: path.basename(file) });
      }
    });
    
    archive.finalize();
  });
}

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
        </style>
    </head>
    <body>
        <h1>🔄 HEIC to JPEG Converter</h1>
        <p>Upload your HEIC/HEIF files and convert them to JPEG format.</p>
        
        <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-area">
                <input type="file" id="fileInput" name="files" multiple accept=".heic,.heif" style="display: none;">
                <button type="button" onclick="document.getElementById('fileInput').click()">
                    📁 Select HEIC Files
                </button>
                <p>or drag and drop files here</p>
            </div>
            <button type="submit">🚀 Convert to JPEG</button>
        </form>
        
        <div id="result"></div>

        <script>
            const form = document.getElementById('uploadForm');
            const fileInput = document.getElementById('fileInput');
            const result = document.getElementById('result');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData();
                const files = fileInput.files;
                
                if (files.length === 0) {
                    result.innerHTML = '<div class="result error">Please select files first!</div>';
                    return;
                }

                for (let file of files) {
                    formData.append('files', file);
                }

                try {
                    result.innerHTML = '<div class="result">🔄 Converting files...</div>';
                    
                    const response = await fetch('/convert', {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        let html = \`<div class="result success">
                            ✅ Successfully converted \${data.successCount} of \${data.totalFiles} files!\`;
                        
                        if (data.zipFile) {
                            html += \`<br><a href="/download/\${data.zipFile}" download>📥 Download ZIP</a>\`;
                        }
                        
                        if (data.errors && data.errors.length > 0) {
                            html += \`<br><br>❌ Errors:<br>\${data.errors.join('<br>')}\`;
                        }
                        
                        html += \`</div>\`;
                        result.innerHTML = html;
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

// Endpoint para conversión
app.post('/convert', upload.array('files', 10), async (req, res) => {
  const uploadedFiles = [];
  const convertedFiles = [];
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const converter = new HEICConverter();
    let successCount = 0;
    const errors = [];

    // Guardar referencias de archivos subidos para limpieza
    uploadedFiles.push(...req.files.map(f => f.path));
    for (const file of req.files) {
      const outputFileName = file.filename.replace(/\.(heic|heif)$/i, '.jpg');
      const outputPath = path.join('/tmp/converted', outputFileName);
      
      const result = await converter.convertSingleFile(file.path, outputPath);
      if (result.success) {
        convertedFiles.push(outputPath);
        successCount++;
      } else {
        errors.push(`${file.originalname}: ${result.error}`);
      }
    }

    let zipFile = null;
    
    // Crear ZIP solo si hay archivos convertidos
    if (convertedFiles.length > 0) {
      const zipFileName = `converted-${Date.now()}.zip`;
      const zipPath = path.join('/tmp/downloads', zipFileName);
      
      try {
        await createZip(convertedFiles, zipPath);
        zipFile = zipFileName;
      } catch (zipError) {
        console.error('Error creating ZIP:', zipError);
        errors.push('Failed to create ZIP file');
      }
    }

    // Respuesta
    const response = {
      success: successCount > 0,
      successCount,
      totalFiles: req.files.length,
      zipFile,
      errors: errors.length > 0 ? errors : undefined
    };

    res.json(response);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Limpiar archivos temporales después de un tiempo
    setTimeout(async () => {
      const converter = new HEICConverter();
      await converter.cleanupTempFiles([...uploadedFiles, ...convertedFiles]);
    }, 5 * 60 * 1000); // 5 minutos
  }
});

// Endpoint para descargar archivos
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('/tmp/downloads', filename);
    
    // Verificar que el archivo existe y es seguro
    if (!fs.existsSync(filePath) || !filename.endsWith('.zip')) {
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

// Inicializar directorios al iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  ensureDirectories().catch(console.error);
  console.log(`🌐 HEIC to JPEG Converter server running on http://0.0.0.0:${port}`);
});