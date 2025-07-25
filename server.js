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

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'HEIC to JPEG Converter API is running',
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'HEIC to JPEG Converter API',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'POST /convert': 'Convert HEIC file to JPEG (multipart/form-data with "file" field)',
      'GET /download/:filename': 'Download converted file'
    },
    usage: 'Send POST request to /convert with HEIC file in "file" field'
  });
});

// Convert endpoint for n8n
app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded. Please send a HEIC/HEIF file in the "file" field.' 
      });
    }

    const converter = new HEICConverter();
    const outputFileName = req.file.filename.replace(/\.(heic|heif)$/i, '.jpg');
    const outputDir = '/tmp/converted';
    await fs.ensureDir(outputDir);
    const outputPath = path.join(outputDir, outputFileName);
    
    const success = await converter.convertSingleFile(req.file.path, outputPath);
    
    if (success) {
      // Leer el archivo convertido y enviarlo como base64
      const convertedBuffer = await fs.readFile(outputPath);
      
      res.json({
        success: true,
        message: 'File converted successfully',
        originalName: req.file.originalname,
        convertedName: outputFileName,
        size: convertedBuffer.length,
        downloadUrl: `/download/${outputFileName}`,
        base64: convertedBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      });

      // Limpiar archivos temporales después de un tiempo
      setTimeout(async () => {
        try {
          await fs.remove(req.file.path);
          await fs.remove(outputPath);
        } catch (err) {
          console.log('Cleanup error:', err.message);
        }
      }, 300000); // 5 minutos

    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to convert file'
      });
    }

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Download endpoint
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('/tmp/converted', filename);
    
    if (await fs.pathExists(filePath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  res.status(500).json({ error: error.message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 HEIC to JPEG API running on http://0.0.0.0:${port}`);
  console.log(`📡 Ready for n8n requests`);
  console.log(`🔗 Health check: http://0.0.0.0:${port}/health`);
});