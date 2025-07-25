#!/bin/bash
set -e

echo "🚀 Starting HEIC to JPEG Converter..."

# Verificar variables de entorno críticas
if [ -z "$JWT_SECRET" ]; then
    echo "❌ ERROR: JWT_SECRET is required"
    exit 1
fi

if [ -z "$API_KEYS" ]; then
    echo "❌ ERROR: API_KEYS is required"
    exit 1
fi

if [ -z "$ADMIN_PASSWORD_HASH" ]; then
    echo "❌ ERROR: ADMIN_PASSWORD_HASH is required"
    exit 1
fi

echo "✅ Environment variables validated"

# Crear directorios necesarios
mkdir -p /app/input /app/output /tmp/uploads /tmp/converted

echo "✅ Directories created"

# Verificar que Sharp funciona
echo "🔍 Verifying Sharp installation..."
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.version);" || {
    echo "❌ Sharp verification failed"
    exit 1
}

echo "✅ Sharp verified successfully"

# Iniciar servidor
echo "🚀 Starting server on port ${PORT:-4545}..."
exec node server.js