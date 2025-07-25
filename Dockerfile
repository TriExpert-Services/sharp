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
    curl \
    wget \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Crear directorio de trabajo
WORKDIR /app

# Crear directorios necesarios con permisos correctos
RUN mkdir -p /app/input /app/output /app/security /tmp/uploads /tmp/converted && \
    chown -R nodejs:nodejs /app /tmp

# Copiar archivos de dependencias primero (para mejor cache de Docker)
COPY --chown=nodejs:nodejs package*.json ./

# Cambiar a usuario nodejs para instalar dependencias
USER nodejs

# Instalar dependencias de Node.js
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar el código fuente con permisos correctos
USER root
COPY --chown=nodejs:nodejs converter.js server.js ./
COPY --chown=nodejs:nodejs security/ ./security/

# Cambiar a usuario no-root
USER nodejs

# Verificar que Sharp funciona correctamente
RUN node -e "console.log('Sharp version:', require('sharp').format)"

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando por defecto
CMD ["node", "server.js"]