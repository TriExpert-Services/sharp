# 🔄 HEIC to JPEG Converter Docker

Un contenedor Docker para convertir archivos HEIC/HEIF a formato JPEG de manera eficiente usando Node.js y Sharp.

## 🚀 Características

- ✅ Conversión rápida y eficiente de HEIC/HEIF a JPEG
- 🌐 Interfaz web para conversiones interactivas
- 📁 Conversión por lotes de directorios completos
- 🎯 Control de calidad JPEG configurable
- 🐳 Completamente containerizado con Docker
- 📱 Soporte para archivos de iPhone/iPad

## 🏗️ Construcción

```bash
# Construir la imagen
docker build -t heic-converter .

# O usar docker-compose
docker-compose build
```

## 💻 Uso

### 1. Interfaz Web (Recomendado)

```bash
# Iniciar el servidor web
docker-compose up heic-converter

# Abrir en el navegador
open http://localhost:3000
```

### 2. Conversión por Lotes (CLI)

```bash
# Crear directorios
mkdir -p input output

# Copiar archivos HEIC al directorio input
cp *.heic input/

# Ejecutar conversión
docker-compose run --rm heic-converter-cli

# Los archivos JPEG aparecerán en el directorio output
```

### 3. Conversión de Archivo Único

```bash
# Convertir un archivo específico
docker run --rm \
  -v $(pwd)/mi-foto.heic:/app/input.heic \
  -v $(pwd):/app/output \
  heic-converter \
  node converter.js /app/input.heic /app/output/mi-foto.jpg
```

### 4. Usando Volúmenes Personalizados

```bash
docker run --rm \
  -v /ruta/a/tus/heic:/app/input \
  -v /ruta/a/salida:/app/output \
  -e JPEG_QUALITY=95 \
  heic-converter
```

## ⚙️ Variables de Entorno

| Variable | Descripción | Por Defecto |
|----------|-------------|-------------|
| `INPUT_DIR` | Directorio de archivos HEIC | `/app/input` |
| `OUTPUT_DIR` | Directorio de salida JPEG | `/app/output` |
| `JPEG_QUALITY` | Calidad JPEG (1-100) | `85` |
| `PORT` | Puerto del servidor web | `3000` |

## 📂 Estructura de Directorios

```
heic-converter/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── converter.js          # Lógica de conversión
├── server.js             # Servidor web
├── input/               # Archivos HEIC de entrada
├── output/              # Archivos JPEG convertidos
└── README.md
```

## 🔧 Ejemplos de Uso

### Conversión Básica
```bash
# Copiar archivos HEIC
cp ~/Fotos/*.heic input/

# Convertir todos los archivos
docker-compose run --rm heic-converter-cli

# Ver resultados
ls -la output/
```

### Alta Calidad
```bash
docker run --rm \
  -v $(pwd)/input:/app/input \
  -v $(pwd)/output:/app/output \
  -e JPEG_QUALITY=95 \
  heic-converter
```

### Servidor Web Persistente
```bash
# Iniciar en background
docker-compose up -d heic-converter

# Ver logs
docker-compose logs -f heic-converter

# Detener
docker-compose down
```

## 🎯 Calidad de Imagen

- **60-70**: Calidad baja, archivos pequeños
- **80-85**: Calidad media (por defecto)
- **90-95**: Alta calidad
- **95-100**: Máxima calidad, archivos grandes

## 🔍 Troubleshooting

### Error: "Cannot read HEIF files"
```bash
# Verificar que Sharp está instalado correctamente
docker run --rm heic-converter node -e "console.log(require('sharp').format)"
```

### Permisos de Archivos
```bash
# Dar permisos a los directorios
chmod -R 755 input output
```

### Ver Logs Detallados
```bash
docker-compose logs heic-converter
```

## 📦 API Endpoints (Servidor Web)

- `GET /` - Interfaz web
- `POST /convert` - Subir y convertir archivos
- `GET /download/:file` - Descargar archivos convertidos

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver LICENSE file para detalles.