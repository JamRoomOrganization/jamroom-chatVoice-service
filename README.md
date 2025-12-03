# chatVoice-service

Microservicio de chat y voz para la plataforma **JamRoom**.

## 📋 Descripción

`chatVoice-service` es un microservicio HTTP construido con Node.js y TypeScript, diseñado siguiendo los principios de aplicaciones 12-factor. Proporciona la infraestructura base para funcionalidades de chat y voz en tiempo real.

## 🛠️ Stack Tecnológico

| Tecnología | Propósito |
|------------|-----------|
| **Node.js 20+** | Runtime |
| **TypeScript** | Lenguaje con tipado estricto |
| **Express** | Framework HTTP |
| **Pino** | Logging estructurado de alto rendimiento |
| **Zod** | Validación de esquemas y variables de entorno |
| **Jest** | Testing framework |
| **ts-node-dev** | Desarrollo con hot reload |

## 📁 Estructura del Proyecto

```
├── src/
│   ├── index.ts              # Bootstrap del servidor (entrypoint)
│   ├── app.ts                # Construcción de la app HTTP
│   ├── config/
│   │   ├── index.ts          # Configuración centralizada
│   │   └── env.ts            # Validación de variables de entorno
│   ├── routes/
│   │   ├── index.ts          # Registro centralizado de rutas
│   │   └── health.routes.ts  # Rutas de health check
│   ├── controllers/
│   │   ├── index.ts
│   │   └── health.controller.ts
│   ├── services/
│   │   ├── index.ts
│   │   └── livekitAdapter.ts # Esqueleto para integración LiveKit
│   ├── middleware/
│   │   ├── index.ts
│   │   ├── requestId.ts      # Generación/propagación de trace ID
│   │   ├── logger.ts         # Logging HTTP con Pino
│   │   └── errorHandler.ts   # Manejo global de errores
│   └── types/
│       ├── index.ts
│       └── http.ts           # Tipos de respuesta HTTP
├── tests/
│   ├── health.e2e.test.ts
│   └── errorHandler.unit.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 20.x o superior
- npm 10.x o superior

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/JamRoomOrganization/jamroom-chatVoice-service.git
cd jamroom-chatVoice-service

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
```

### Scripts Disponibles

```bash
# Desarrollo con hot reload
npm run dev

# Ejecutar tests
npm test

# Build de producción
npm run build

# Iniciar en producción
npm start
```

## ⚙️ Configuración

El servicio sigue el principio 12-factor de configuración por variables de entorno.

### Variables de Entorno

| Variable | Tipo | Default | Descripción |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | Puerto del servidor HTTP |
| `NODE_ENV` | string | `development` | Entorno (`development`, `test`, `production`) |

### Ejemplo `.env`

```env
PORT=3000
NODE_ENV=development
```

## 🔌 API Endpoints

### Health Check

#### `GET /healthz`

Verifica que el servicio está activo.

**Response 200 OK:**
```json
{
  "data": {
    "status": "ok",
    "service": "chatVoice-service"
  },
  "error": null,
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-12-01T10:30:00.000Z"
  }
}
```

#### `GET /readyz`

Verifica que el servicio está listo para recibir tráfico.

**Response 200 OK:**
```json
{
  "data": {
    "status": "ready"
  },
  "error": null,
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-12-01T10:30:00.000Z"
  }
}
```

## 📦 Formato de Respuesta

Todas las respuestas siguen un formato uniforme:

### Respuesta Exitosa
```json
{
  "data": { /* payload */ },
  "error": null,
  "meta": {
    "requestId": "<uuid>",
    "timestamp": "<ISO8601>"
  }
}
```

### Respuesta de Error
```json
{
  "data": null,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error",
    "details": {}
  },
  "meta": {
    "requestId": "<uuid>",
    "timestamp": "<ISO8601>"
  }
}
```

## 🔍 Observabilidad

### Request Tracing

El servicio soporta distributed tracing mediante el header `x-request-id`:

- Si el header está presente, se reutiliza el ID
- Si no existe, se genera un UUID v4
- El `requestId` se incluye en todos los logs y respuestas

### Logging

Logging estructurado con Pino que incluye:

- Método HTTP
- Path
- Código de respuesta
- Request ID
- Duración de la petición

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con cobertura
npm test -- --coverage

# Ejecutar tests específicos
npm test -- health.e2e.test.ts
```

## 🏗️ Arquitectura

El servicio sigue una arquitectura limpia y modular:

- **Controllers**: Orquestación de request/response
- **Services**: Lógica de dominio
- **Middleware**: Cross-cutting concerns (logging, errores, requestId)
- **Types**: Definiciones de tipos compartidas

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.

---

**JamRoom Organization** © 2025