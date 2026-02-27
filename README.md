# 📱 WA Inbox

Inbox de WhatsApp propio conectado a la **API oficial de Meta** (WhatsApp Cloud API).  
Sin Chatwoot, sin Evolution API, sin intermediarios.

## Funcionalidades

- 💬 **Chat en tiempo real** — Enviar y recibir mensajes de WhatsApp
- 👥 **Multi-agente** — Varios agentes con asignación de conversaciones
- 📋 **Templates** — Sincronizar y enviar templates aprobados de Meta
- 📝 **Notas internas** — Notas visibles solo para el equipo
- 🔄 **WebSocket** — Actualización en tiempo real sin recargar
- 📊 **Estados** — Conversaciones abiertas, pendientes, resueltas
- 🔍 **Búsqueda** — Buscar conversaciones por nombre o teléfono
- ✅ **Confirmaciones** — Checks de enviado, entregado y leído

## Requisitos

- Docker y Docker Compose
- Cuenta de Meta Business verificada
- App de WhatsApp Business en Meta Developers
- Número de teléfono registrado en WhatsApp Cloud API

## Instalación

### 1. Clonar y configurar

```bash
git clone <tu-repo>
cd wa-inbox
cp .env.example .env
```

Edita `.env` con tus datos de Meta:

```env
META_ACCESS_TOKEN=EAAxxxxxxx          # Token permanente
META_PHONE_NUMBER_ID=123456789        # ID del número
META_WABA_ID=123456789                # ID del WABA
META_VERIFY_TOKEN=mi-token-secreto    # Para verificar webhook
ADMIN_PASSWORD=tu-password-seguro     # Contraseña del admin
JWT_SECRET=algo-aleatorio-y-largo     # Secreto JWT
```

### 2. Levantar

```bash
docker compose up -d --build
```

La app estará en `http://tu-servidor:8080`

### 3. Configurar webhook en Meta

Ve a **Meta Developers** > Tu App > WhatsApp > Configuration:

- **Callback URL**: `https://tu-dominio.com/webhook`
- **Verify token**: El mismo que pusiste en `META_VERIFY_TOKEN`
- **Subscribed fields**: `messages`

### 4. Acceder

- **Email**: `admin@inbox.local`
- **Contraseña**: La que pusiste en `ADMIN_PASSWORD` (por defecto: `admin123`)

## Despliegue en EasyPanel

1. Crea un nuevo proyecto en EasyPanel
2. Añade un servicio **PostgreSQL** (o usa el docker-compose)
3. Añade el servicio del **backend** (apunta al Dockerfile de `./backend`)
4. Añade el servicio del **frontend** (apunta al Dockerfile de `./frontend`)
5. Configura las variables de entorno del backend
6. En el frontend, configura el proxy a backend en la configuración de nginx

O simplemente sube el docker-compose.yml entero.

## Crear agentes

Una vez dentro como admin, usa la API:

```bash
curl -X POST https://tu-dominio.com/api/auth/register \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alberto","email":"alberto@tuempresa.com","password":"1234","role":"agent"}'
```

## Arquitectura

```
Meta Cloud API ←webhook→ Backend (Node.js + Express + Socket.io)
                                ↕
                          PostgreSQL
                                ↕
                     Frontend (React + Tailwind)
```

Sin intermediarios. Tu app habla directamente con Meta.

## Stack

- **Backend**: Node.js, Express, Socket.io, PostgreSQL
- **Frontend**: React, Tailwind CSS, Socket.io Client
- **Infra**: Docker, Nginx

## Licencia

MIT — Haz lo que quieras con esto.
