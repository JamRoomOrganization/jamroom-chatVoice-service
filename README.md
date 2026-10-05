# jamroom-chatVoice-service

[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](LICENSE)

Servicio HTTP de JamRoom para gestionar sesiones de voz, operaciones de moderación interna, endpoints operativos y métricas de observabilidad. Está implementado en TypeScript sobre Express y expone una API uniforme para integrarse con otros servicios de la plataforma.

## 1) Descripción ejecutiva

`jamroom-chatVoice-service` resuelve la orquestación backend de voz en JamRoom:

- emite/renueva contexto de sesión de voz para clientes,
- aplica acciones de moderación (mute/unmute/kick/policies) para consumo interno,
- ofrece endpoints de salud, readiness y mantenimiento,
- publica métricas para monitoreo.

El servicio puede iniciar sin LiveKit configurado, pero las funcionalidades de voz dependen de esa integración.

## 2) Responsabilidades del servicio

- Gestión de sesiones de voz (`create/upsert`, consulta, eliminación, listado por sala).
- Moderación de voz protegida por `x-internal-api-key`.
- Operaciones internas para renovación y estadísticas de sesiones.
- Health checks (`/healthz`, `/health`, `/readyz`).
- Exposición de métricas (`/metrics`, `/metrics/json`).
- Estandarización de respuestas HTTP (`{ data, error, meta }`) y trazabilidad por request ID.

## 3) Características principales

- Node.js `>=20`.
- Express 4 + middleware de CORS, request ID y logging HTTP (`pino-http`).
- Validación con Zod (payloads y configuración de entorno).
- Manejo global de errores y respuesta uniforme.
- Integración con LiveKit Server SDK.
- Graceful shutdown con señales `SIGTERM`/`SIGINT`.
- Suite de pruebas unitarias y e2e con Jest + Supertest.

## 4) Stack tecnológico

- **Runtime**: Node.js
- **Lenguaje**: TypeScript
- **HTTP**: Express 4
- **Validación**: Zod
- **Logging**: Pino / pino-http
- **Voz**: livekit-server-sdk
- **Testing**: Jest, Supertest, ts-jest
- **DX**: ts-node-dev

## 5) Arquitectura y flujo

Flujo general:

1. `src/index.ts` arranca el proceso y servidor HTTP.
2. `src/app.ts` construye Express y registra middleware + rutas.
3. `src/config/env.ts` valida variables de entorno con Zod.
4. Controladores procesan requests y delegan a servicios.
5. Respuestas (excepto casos como `204` y `GET /metrics` texto) siguen `{ data, error, meta }`.

## 6) Estructura del proyecto

```text
src/
  index.ts
  app.ts
  config/
    index.ts
    env.ts
  controllers/
  middleware/
  routes/
  services/
  types/
  utils/
tests/
package.json
jest.config.js
tsconfig.json
sonar-project.properties
LICENSE
```

## 7) Prerrequisitos

- Node.js `>=20`
- npm

## 8) Instalación

```bash
npm install
```

## 9) Configuración

> **Importante**: `.env` contiene secretos y **no debe versionarse**.

En este repositorio no existe `.env.example` actualmente, por lo que debes crear tu `.env` manualmente.

### Variables de entorno

| Variable | Tipo | Requerida | Default | Descripción |
|---|---|---|---|---|
| `PORT` | number | No | `3002` | Puerto HTTP del servicio. |
| `NODE_ENV` | `development \| test \| production` | No | `development` | Entorno de ejecución. |
| `CORS_ORIGIN` | string | No | `http://localhost:3000` | Origen(s) permitidos para CORS. |
| `LIVEKIT_API_KEY` | string | Condicional | — | Requerida para operaciones de voz que generen/renueven credenciales LiveKit. |
| `LIVEKIT_API_SECRET` | string | Condicional | — | Secreto para firma de tokens LiveKit. |
| `LIVEKIT_URL` | URL `ws://` o `wss://` | Condicional | — | URL de conexión a LiveKit. |
| `LIVEKIT_TOKEN_TTL_SECONDS` | number | No | `3600` (en configuración de app) | TTL de token de voz. |
| `INTERNAL_API_KEY` | string (mínimo 16 caracteres) | Condicional | — | Protege endpoints internos de moderación (`x-internal-api-key`). |

**Condicional** = obligatoria para el conjunto de endpoints que la necesita.

### Ejemplo mínimo de `.env`

```env
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Recomendado para moderación interna
INTERNAL_API_KEY=change-this-internal-key-16chars-min

# Necesario para funcionalidad de voz con LiveKit
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=
LIVEKIT_TOKEN_TTL_SECONDS=3600
```

## 10) Ejecución local

```bash
# Desarrollo
npm run dev

# Compilación
npm run build

# Ejecución de build
npm start
```

## 11) Scripts disponibles

- `npm run dev`: desarrollo con recarga.
- `npm test`: ejecuta Jest en modo serial con cobertura.
- `npm run test:ci`: pruebas para CI (`--coverage --ci`).
- `npm run build`: compila TypeScript a `dist`.
- `npm start`: inicia `dist/index.js`.

## 12) API y endpoints

### Salud y diagnóstico

- `GET /healthz`
- `GET /health`
- `GET /readyz`
- `POST /debug/echo`

### Sesiones de voz

- `POST /api/v1/voice/sessions`
- `GET /api/v1/voice/sessions/:sessionId`
- `DELETE /api/v1/voice/sessions/:sessionId`
- `GET /api/v1/voice/rooms/:roomId/sessions`

### Moderación (uso interno)

- `POST /api/v1/voice/moderation/server-mute`
- `POST /api/v1/voice/moderation/server-unmute`
- `POST /api/v1/voice/moderation/kick`
- `POST /api/v1/voice/moderation/policy`
- `GET /api/v1/voice/moderation/rooms/:roomId/actions`

### Operaciones internas

- `POST /internal/voice/sessions/renew`
- `GET /internal/voice/sessions/stats`

### Métricas

- `GET /metrics` (texto Prometheus)
- `GET /metrics/json` (JSON)

## 13) Autenticación interna

Los endpoints de moderación requieren:

- Header: `x-internal-api-key: <valor de INTERNAL_API_KEY>`
- Están diseñados para consumo interno (ej. `sync-service`), no para clientes frontend.

Las rutas `/internal/*` están pensadas para operaciones, cron jobs y monitorización.

## 14) Formato de respuestas

Formato estándar:

```json
{
  "data": {},
  "error": null,
  "meta": {
    "requestId": "...",
    "timestamp": "..."
  }
}
```

Errores:

```json
{
  "data": null,
  "error": {
    "code": "...",
    "message": "...",
    "details": {}
  },
  "meta": {
    "requestId": "...",
    "timestamp": "..."
  }
}
```

Notas:

- `requestId` se propaga desde `x-request-id` o se genera automáticamente.
- Los errores de validación de Zod se normalizan por middleware de validación.
- `DELETE /api/v1/voice/sessions/:sessionId` responde `204 No Content`.
- `GET /metrics` entrega texto Prometheus (no wrapper JSON).

## 15) Ejemplos `curl`

### Health check

```bash
curl -sS http://localhost:3002/healthz
```

### Crear/actualizar sesión de voz

```bash
curl -sS -X POST http://localhost:3002/api/v1/voice/sessions \
  -H 'Content-Type: application/json' \
  -H 'x-request-id: local-test-001' \
  -d '{
    "roomId": "room-123",
    "userId": "user-456",
    "username": "Juan",
    "canPublishAudio": true,
    "canSubscribe": true
  }'
```

### Moderación protegida (server-mute)

```bash
curl -sS -X POST http://localhost:3002/api/v1/voice/moderation/server-mute \
  -H 'Content-Type: application/json' \
  -H 'x-internal-api-key: change-this-internal-key-16chars-min' \
  -d '{
    "roomId": "room-123",
    "targetUserId": "user-456",
    "moderatorUserId": "moderator-001",
    "reason": "moderación manual"
  }'
```

### Métricas

```bash
# Formato Prometheus
curl -sS http://localhost:3002/metrics

# Resumen JSON
curl -sS http://localhost:3002/metrics/json
```

## 16) Observabilidad

- Logging estructurado con Pino/Pino HTTP.
- Trazabilidad por `requestId`.
- Métricas para scraping y análisis (`/metrics`, `/metrics/json`).

## 17) Testing y calidad

```bash
npm test
npm run test:ci
```

La suite en `tests/` cubre salud, errores, validación, métricas, integración LiveKit, sesiones de voz, moderación, resiliencia y mantenimiento.

Análisis estático: `sonar-project.properties` define `src` como fuentes, `tests` como pruebas y usa `coverage/lcov.info`.

## 18) Despliegue y notas operativas

- Entry point de ejecución: `src/index.ts` (`dist/index.js` en producción).
- Incluye manejo de señales para apagado controlado (`SIGTERM`, `SIGINT`).
- Recomendada inyección de secretos por entorno (no en código ni en VCS).
- LiveKit puede omitirse para levantar el servicio base, pero no para funcionalidades de voz.

## 19) Seguridad

- Endpoints de moderación protegidos por `INTERNAL_API_KEY`.
- Validación temprana de payloads y configuración con Zod.
- Estructura de error estandarizada para evitar exposición accidental de detalles internos.

## 20) Limitaciones actuales

- Persistencia de sesiones y políticas en memoria (no base de datos).
- Historial de acciones de moderación por sala con límite en memoria.

## 21) Contribución

1. Crea una rama de trabajo.
2. Implementa cambios con pruebas.
3. Ejecuta `npm test` y/o `npm run test:ci`.
4. Abre PR con contexto técnico y evidencia de validación.

## 22) Licencia

MIT. Consulta [LICENSE](LICENSE).
