const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const HEICConverter = require('./converter');

const app = express();
const port = process.env.PORT || 3000;

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/tmp/uploads';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
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
                        result.innerHTML = \`<div class="result success">
                            ✅ Successfully converted \${data.successCount} files!<br>
                            <a href="/download/\${data.zipFile}" download>📥 Download ZIP</a>
                        </div>\`;
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
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const converter = new HEICConverter();
    const convertedFiles = [];
    let successCount = 0;

    for (const file of req.files) {
      const outputFileName = file.filename.replace(/\.(heic|heif)$/i, '.jpg');
      const outputPath = path.join('/tmp/converted', outputFileName);
      
      const success = await converter.convertSingleFile(file.path, outputPath);
      if (success) {
        convertedFiles.push(outputPath);
        successCount++;
      }
    }

    // Crear ZIP con archivos convertidos (opcional)
    const zipFile = `converted-${Date.now()}.zip`;
    
    res.json({
      success: true,
      successCount,
      totalFiles: req.files.length,
      zipFile: zipFile
    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 HEIC to JPEG Converter server running on http://0.0.0.0:${port}`);
});