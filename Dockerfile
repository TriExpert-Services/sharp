FROM node:18-alpine

# Instalar dependencias del sistema necesarias para Sharp y libheif
RUN apk add --no-cache \
    vips-dev \
    libheif-dev \
    libde265-dev \
    x265-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (para mejor cache de Docker)
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar el código fuente
COPY converter.js server.js ./

# Crear directorios necesarios
RUN mkdir -p /app/input /app/output /tmp/uploads /tmp/converted

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /tmp

# Cambiar a usuario no-root
USER nodejs

# Verificar que Sharp funciona correctamente
RUN node -e "console.log('Sharp version:', require('sharp').format)"

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Comando por defecto
CMD ["node", "server.js"]