const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

class HEICConverter {
  constructor() {
    this.inputDir = process.env.INPUT_DIR || '/app/input';
    this.outputDir = process.env.OUTPUT_DIR || '/app/output';
    this.quality = this.validateQuality(parseInt(process.env.JPEG_QUALITY) || 85);
  }

  validateQuality(quality) {
    if (isNaN(quality) || quality < 1 || quality > 100) {
      console.warn(`⚠️ Invalid quality ${quality}, using default 85`);
      return 85;
    }
    return quality;
  }

  async validateInputFile(inputPath) {
    try {
      const stats = await fs.stat(inputPath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }
      
      // Verificar que el archivo tenga extensión HEIC/HEIF
      if (!/\.(heic|heif)$/i.test(inputPath)) {
        throw new Error('File is not a HEIC/HEIF file');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Invalid input file: ${error.message}`);
    }
  }

  async convertFile(inputPath, outputPath) {
    try {
      // Validar archivo de entrada
      await this.validateInputFile(inputPath);
      
      // Asegurar que el directorio de salida existe
      await fs.ensureDir(path.dirname(outputPath));
      
      console.log(`Converting: ${inputPath} -> ${outputPath}`);
      
      await sharp(inputPath)
        .jpeg({ 
          quality: this.quality,
          progressive: true,
          mozjpeg: true
        })
        .toFile(outputPath);
      
      // Verificar que el archivo se creó correctamente
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Output file is empty');
      }
      
      console.log(`✅ Successfully converted: ${path.basename(outputPath)}`);
      return { success: true, outputPath, size: stats.size };
    } catch (error) {
      console.error(`❌ Error converting ${inputPath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async convertDirectory() {
    try {
      // Asegurar que los directorios existan
      await fs.ensureDir(this.inputDir);
      await fs.ensureDir(this.outputDir);

      // Leer archivos del directorio de entrada
      const files = await fs.readdir(this.inputDir);
      const heicFiles = files.filter(file => 
        /\.(heic|heif)$/i.test(file)
      );

      if (heicFiles.length === 0) {
        console.log('📁 No HEIC/HEIF files found in input directory');
        return;
      }

      console.log(`🔄 Found ${heicFiles.length} HEIC/HEIF files to convert`);

      let successCount = 0;
      let errorCount = 0;

      // Convertir cada archivo
      for (const file of heicFiles) {
        const inputPath = path.join(this.inputDir, file);
        const outputFileName = file.replace(/\.(heic|heif)$/i, '.jpg');
        const outputPath = path.join(this.outputDir, outputFileName);

        const result = await this.convertFile(inputPath, outputPath);
        if (result.success) {
          successCount++;
          console.log(`📊 File size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
          errorCount++;
        }
      }

      console.log(`\n📊 Conversion Summary:`);
      console.log(`✅ Successfully converted: ${successCount} files`);
      console.log(`❌ Failed conversions: ${errorCount} files`);
      console.log(`📁 Output directory: ${this.outputDir}`);

    } catch (error) {
      console.error('💥 Error during batch conversion:', error.message);
    }
  }

  async convertSingleFile(inputFile, outputFile) {
    try {
      return await this.convertFile(inputFile, outputFile);
    } catch (error) {
      console.error('💥 Error during single file conversion:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Método para limpiar archivos temporales
  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.remove(filePath);
        console.log(`🗑️ Cleaned up: ${filePath}`);
      } catch (error) {
        console.warn(`⚠️ Could not clean up ${filePath}:`, error.message);
      }
    }
  }
}

// Función principal
async function main() {
  const converter = new HEICConverter();
  
  // Verificar argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    // Conversión de archivo único
    const inputFile = args[0];
    const outputFile = args[1];
    
    console.log(`🔄 Converting single file: ${inputFile} -> ${outputFile}`);
    await converter.convertSingleFile(inputFile, outputFile);
  } else {
    // Conversión de directorio
    console.log('🚀 Starting HEIC to JPEG batch conversion...');
    console.log(`📂 Input directory: ${converter.inputDir}`);
    console.log(`📁 Output directory: ${converter.outputDir}`);
    console.log(`🎯 JPEG quality: ${converter.quality}%`);
    
    await converter.convertDirectory();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = HEICConverter;