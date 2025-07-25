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

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm install && npm prune --production && npm cache clean --force

# Copiar el código fuente
COPY . .

# Crear directorios para input y output
RUN mkdir -p /app/input /app/output /tmp/uploads /tmp/converted /tmp/downloads

# Exponer puerto (opcional, para API web)
EXPOSE 3000

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /tmp

USER nodejs

# Comando por defecto
CMD ["node", "server.js"]