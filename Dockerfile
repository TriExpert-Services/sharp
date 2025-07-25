FROM node:18-alpine

# Instalar dependencias del sistema necesarias para Sharp y libheif
RUN apk add --no-cache \
    vips-dev \
    libheif-dev \
    libde265-dev \
    x265-dev \
    python3 \
    make \
    g++

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm install

# Copiar el código fuente
COPY . .

# Crear directorios para input y output
RUN mkdir -p /app/input /app/output

# Exponer puerto (opcional, para API web)
EXPOSE 3000

# Comando por defecto
CMD ["node", "converter.js"]