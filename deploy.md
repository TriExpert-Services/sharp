# 🚀 Guía de Despliegue

## Para EasyPanel

### 1. Preparación
```bash
# Construir la imagen Docker
docker build -t heic-converter:latest .

# Subir imagen a registry (Docker Hub, etc.)
docker tag heic-converter:latest your-registry/heic-converter:latest
docker push your-registry/heic-converter:latest
```

### 2. Variables de Entorno Requeridas
```bash
JWT_SECRET=tu-secret-jwt-muy-seguro-cambiar-en-produccion
API_KEYS=api-key-1,api-key-2,api-key-3
ADMIN_PASSWORD_HASH=$2b$10$hash-del-password-admin
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
```

### 3. Configuración en EasyPanel
1. Crear nuevo proyecto
2. Usar archivo `easypanel.json`
3. Configurar variables de entorno
4. Configurar dominio personalizado
5. Habilitar HTTPS

---

## Para Dokploy

### 1. Preparación
```bash
# Asegurar que tienes el repositorio listo
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Configuración en Dokploy
1. Conectar repositorio Git
2. Usar archivo `dokploy.json`
3. Configurar variables de entorno:
   - `JWT_SECRET`: Secret para tokens JWT
   - `API_KEYS`: Claves API separadas por comas
   - `ADMIN_PASSWORD_HASH`: Hash bcrypt de password admin
   - `ALLOWED_ORIGINS`: Dominios permitidos para CORS

### 3. Despliegue
1. Clic en "Deploy"
2. Verificar logs de construcción
3. Probar endpoint `/health`

---

## Generar Password Hash para Admin

```bash
# Usando Node.js
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('tu-password', 10));"

# Usando online: https://bcrypt-generator.com/
# Rounds: 10
# Password: tu-password-admin
```

---

## Variables de Entorno Detalladas

| Variable | Descripción | Ejemplo | Requerido |
|----------|-------------|---------|-----------|
| `JWT_SECRET` | Clave secreta para JWT | `mi-super-secret-jwt-2024` | ✅ |
| `API_KEYS` | Claves API válidas | `key1,key2,key3` | ✅ |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt del password | `$2b$10$...` | ✅ |
| `ALLOWED_ORIGINS` | Dominios CORS permitidos | `https://example.com` | ❌ |
| `JPEG_QUALITY` | Calidad JPEG (1-100) | `85` | ❌ |
| `CONVERT_RATE_LIMIT` | Límite conversiones/15min | `20` | ❌ |
| `GENERAL_RATE_LIMIT` | Límite requests/15min | `100` | ❌ |

---

## Verificación Post-Despliegue

### Health Check
```bash
curl https://tu-dominio.com/health
```

### Test de Conversión
```bash
curl -X POST https://tu-dominio.com/convert \
  -H "X-API-Key: tu-api-key" \
  -F "file=@test.heic" \
  -F "quality=90"
```

### Test de Admin
```bash
curl -X POST https://tu-dominio.com/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu-password"}'
```

---

## Troubleshooting

### Error: Sharp no puede procesar HEIC
- Verificar que libheif está instalado en el contenedor
- Revisar logs de construcción Docker

### Error: API Key inválida
- Verificar variable `API_KEYS` esté configurada
- Verificar formato: claves separadas por comas

### Error: CORS
- Configurar `ALLOWED_ORIGINS` con tu dominio
- Incluir https:// en la URL

### Error: Rate Limit
- Ajustar variables de rate limiting
- Revisar analytics en panel admin

---

## Monitoreo

### Logs en Tiempo Real
```bash
# EasyPanel
easypanel logs heic-converter

# Dokploy
dokploy logs heic-converter
```

### Métricas Importantes
- CPU y memoria usage
- Request rate
- Error rate
- Response time

---

## Seguridad

### Recomendaciones
1. ✅ Cambiar todas las claves por defecto
2. ✅ Usar HTTPS obligatorio
3. ✅ Configurar rate limiting apropiado
4. ✅ Monitorear logs de seguridad
5. ✅ Actualizar dependencias regularmente

### Headers de Seguridad
- HSTS habilitado
- Content Security Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff