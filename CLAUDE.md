# WA Inbox — Claude Code Agent Instructions

## Project Overview

WA Inbox is a custom WhatsApp team inbox built for **Juan Serrano Abogados**, a Spanish law firm with 4 sales agents. It connects directly to Meta's official WhatsApp Cloud API (no intermediaries like Evolution API or Chatwoot).

**Live URL**: https://inbox.flowmatic.es
**Repo**: https://github.com/hectormhs/wa-inbox

## Architecture

```
Frontend (React + Vite + Tailwind)  →  Nginx reverse proxy  →  Backend (Node.js + Express + Socket.io)  →  PostgreSQL
                                                                       ↕
                                                              Meta WhatsApp Cloud API
```

### Stack
- **Backend**: Node.js 20, Express, Socket.io, pg (PostgreSQL), axios, bcryptjs, jsonwebtoken
- **Frontend**: React 18, Vite, Tailwind CSS, Socket.io-client
- **Database**: PostgreSQL 16
- **Deployment**: Docker containers on EasyPanel (VPS)
- **Language**: ESM (`"type": "module"` in package.json)

### Project Structure
```
wa-inbox/
├── CLAUDE.md                 # This file
├── docker-compose.yml        # Local dev (3 services: db, backend, frontend)
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js          # Express + Socket.io server setup
│       ├── db.js             # PostgreSQL pool + schema init + seed
│       ├── meta.js           # Meta WhatsApp Cloud API functions
│       ├── middleware/
│       │   └── auth.js       # JWT auth middleware
│       └── routes/
│           ├── auth.js       # Login, register, me
│           ├── agents.js     # List agents
│           ├── conversations.js # CRUD conversations
│           ├── messages.js   # Send/receive messages, notes, templates
│           ├── templates.js  # List/sync templates
│           ├── webhook.js    # Meta webhook verification + incoming messages
│           ├── media.js      # Proxy for Meta media downloads
│           └── settings.js   # Runtime config + agent management
└── frontend/
    ├── Dockerfile            # Multi-stage: Vite build → Nginx serve
    ├── nginx.conf            # Reverse proxy to backend
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── index.css         # Tailwind + custom CSS
        ├── api.js            # API client layer
        ├── App.jsx           # Main app: routing, state, socket
        ├── hooks/
        │   └── useSocket.js  # Socket.io hook
        └── components/
            ├── Login.jsx
            ├── ConversationList.jsx  # Sidebar
            ├── ChatWindow.jsx        # Main chat area
            ├── MessageBubble.jsx     # Individual message rendering
            ├── NewConversation.jsx   # New conversation modal
            └── Settings.jsx          # Config panel (API, agents, webhook)
```

## Database Schema

```sql
-- Agents (users of the inbox)
agents: id, name, email, password, role('admin'|'agent'), is_online, color, created_at

-- WhatsApp contacts
contacts: id, phone (unique), name, profile_name, created_at

-- Conversations (one per contact)
conversations: id, contact_id (FK), assigned_agent_id (FK), status('open'|'pending'|'resolved'),
               last_message_at, last_message_preview, unread_count, created_at

-- Messages
messages: id, conversation_id (FK), sender_type('contact'|'agent'|'system'), sender_id,
          content, message_type('text'|'image'|'audio'|'video'|'document'|'sticker'|'location'|'reaction'|'template'),
          media_url, media_mime_type, meta_message_id, is_note, status('sent'|'delivered'|'read'|'failed'), created_at

-- WhatsApp message templates
templates: id, meta_id, name, language, category, status, components (JSONB), synced_at

-- Runtime settings (Meta credentials stored here, override env vars)
settings: key (PK), value, updated_at
```

## Meta WhatsApp Cloud API Integration

### Credentials (stored in `settings` table, configurable from UI)
- `META_ACCESS_TOKEN` — System user token from Meta Business Suite
- `META_PHONE_NUMBER_ID` — WhatsApp phone number ID (e.g., `968293823034296`)
- `META_WABA_ID` — WhatsApp Business Account ID (e.g., `749405587764082`)
- `META_VERIFY_TOKEN` — Webhook verification token

### API Base
```
https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
```

### Sending Messages (current: text + templates only)

**Text message:**
```json
POST /{PHONE_NUMBER_ID}/messages
{ "messaging_product": "whatsapp", "to": "34612345678", "type": "text", "text": { "body": "Hello" } }
```

**Template message:**
```json
{ "messaging_product": "whatsapp", "to": "34612345678", "type": "template",
  "template": { "name": "template_name", "language": { "code": "es" }, "components": [...] } }
```

**Image message (TO IMPLEMENT):**
```json
{ "messaging_product": "whatsapp", "to": "34612345678", "type": "image",
  "image": { "id": "<MEDIA_ID>", "caption": "optional caption" } }
```

**Document message (TO IMPLEMENT):**
```json
{ "messaging_product": "whatsapp", "to": "34612345678", "type": "document",
  "document": { "id": "<MEDIA_ID>", "caption": "optional", "filename": "file.pdf" } }
```

**Audio message (TO IMPLEMENT):**
```json
{ "messaging_product": "whatsapp", "to": "34612345678", "type": "audio",
  "audio": { "id": "<MEDIA_ID>" } }
```

**Video message (TO IMPLEMENT):**
```json
{ "messaging_product": "whatsapp", "to": "34612345678", "type": "video",
  "video": { "id": "<MEDIA_ID>", "caption": "optional" } }
```

### Uploading Media to Meta
Before sending media, you must upload it:
```
POST /{PHONE_NUMBER_ID}/media
Content-Type: multipart/form-data
- file: <binary>
- type: image/jpeg
- messaging_product: whatsapp
```
Returns: `{ "id": "<MEDIA_ID>" }`

### Receiving Messages (Webhook)
- `GET /webhook` — Meta verification (challenge-response)
- `POST /webhook` — Incoming messages, status updates

Incoming message types to handle: text, image, document, audio, video, sticker, location, reaction, contacts, interactive (button replies, list replies)

### Media URLs
Meta media URLs are **temporary** (5 min) and **require authentication** (Bearer token). The `/api/media/:messageId` endpoint proxies downloads through our backend.

### 24-Hour Window Rule
- You can only send FREE-FORM messages within 24 hours of the customer's last message
- Outside the window, you MUST use an approved template to re-initiate conversation
- The UI should show when the window closes and block free-form messages after expiry

## Deployment

### EasyPanel (Production)
- **Project name**: `wa-inbox`
- **Services**: `postgres`, `backend`, `frontend`
- Backend hostname: `wa-inbox-backend` (used in nginx.conf)
- Frontend domain: `inbox.flowmatic.es`
- Environment variables are set in EasyPanel, NOT in code

### Update Workflow
```bash
# Make changes locally, test with Docker
docker compose up -d --build

# Push to GitHub
git add .
git commit -m "feat: description"
git push

# Then in EasyPanel: Redeploy backend and/or frontend
```

### Local Development
```bash
docker compose up -d --build
# Frontend: http://localhost:8080
# Default login: admin@inbox.local / admin123
```

## Design System

- **Theme**: Dark (#0B141A background, WhatsApp-inspired)
- **Primary color**: #25D366 (WhatsApp green)
- **Tailwind custom colors** (see tailwind.config.js):
  - `wa-dark`: #0B141A (main bg)
  - `wa-panel`: #202C33 (sidebars, cards)
  - `wa-input`: #2A3942 (input fields)
  - `wa-bubble`: #005C4B (outgoing message bubbles)
  - `wa-green`: #25D366 (buttons, accents)
  - `wa-light`: #E9EDEF (primary text)
  - `wa-muted`: #8696A0 (secondary text)
- **Font sizes**: 13.5px for messages, 11px for metadata
- **No emojis in UI chrome** (buttons, headers) — keep professional

## Coding Patterns

### Backend
- ESM imports (`import/export`)
- Express Router per resource
- `pool.query()` for DB (pg library)
- JWT auth middleware on all `/api/*` except `/api/auth/login` and `/webhook`
- `adminOnly` middleware for settings routes
- Socket.io for real-time: emit `new_message`, `message_status`, `conversation_updated`
- Error handling: try/catch with `res.status(500).json({ error: message })`

### Frontend
- Functional components with hooks
- State managed in App.jsx (lifted state)
- `api.js` as centralized API layer — add new endpoints here
- Socket events handled in App.jsx via useSocket hook
- Tailwind for all styling (no CSS modules)
- Spanish UI text throughout

### Important Rules
1. **Routes with params must come AFTER static routes** in Express (e.g., `/new/template` before `/:conversationId`)
2. **bcryptjs ESM import** requires: `const bcryptModule = await import('bcryptjs'); const bcrypt = bcryptModule.default;`
3. **Nginx hostname in production** is `wa-inbox-backend`, NOT `backend`
4. **After sending a message, reload messages from DB** (socket is unreliable through EasyPanel proxy): `const msgs = await api.getMessages(convId); setMessages(msgs);`
5. **Meta media URLs expire** — always proxy through `/api/media/:messageId`
6. **Settings table overrides env vars** — check DB first, fall back to process.env

---

## FEATURE ROADMAP

Below is the prioritized list of features needed for production use by 4 sales agents. Items marked ✅ are done, ⚠️ are partial, ❌ are not started.

### P0 — Critical (Must Have for Launch)

#### 1. ✅ Basic Messaging
- ✅ Send text messages
- ✅ Receive text messages (webhook)
- ✅ Message status indicators (sent ✓, delivered ✓✓, read ✓✓ blue)
- ✅ Internal notes (not sent to WhatsApp)
- ✅ Template sending (with parameters)
- ✅ New conversation initiation (template required)

#### 2. ⚠️ Multimedia Support
- ✅ Receive and display: images, audio, video, documents, stickers, locations
- ✅ Media proxy for Meta's temporary URLs
- ❌ **Send images** (file upload from agent → Meta upload → send)
- ❌ **Send documents** (PDF, Word, etc.)
- ❌ **Send audio** (record voice note or upload)
- ❌ **Send video**
- ❌ **File upload UI** (drag & drop + file picker + preview before send)
- ❌ **Upload to Meta** endpoint (`POST /{phone_id}/media` with multipart/form-data)

#### 3. ✅ Conversation Management
- ✅ List conversations with filters (open/pending/resolved)
- ✅ Assign agent to conversation
- ✅ Change conversation status
- ✅ Unread count
- ✅ Search conversations
- ⚠️ **Mark as read on open** (needs to also call Meta's markAsRead API)

#### 4. ✅ Agent System
- ✅ Login/auth with JWT
- ✅ Admin + agent roles
- ✅ Create/delete agents from Settings UI
- ✅ Agent color for messages
- ❌ **Agent online/offline status** (show in sidebar, auto-set on login/logout)

#### 5. ❌ 24-Hour Window Management
- ❌ Track when last customer message was received per conversation
- ❌ Show countdown/indicator of window expiry in chat header
- ❌ Block free-form message input when window is closed
- ❌ Show "Send template to re-open" prompt when window expired
- ❌ Visual indicator in conversation list (window open/closed)

### P1 — High Priority (Week 1-2)

#### 6. ❌ Labels / Tags
- ❌ Create labels with name + color (admin)
- ❌ Assign multiple labels to conversations
- ❌ Filter conversations by label
- ❌ Show label chips in conversation list
- ❌ DB: `labels` table (id, name, color) + `conversation_labels` junction table

#### 7. ❌ Quick Replies / Canned Responses
- ❌ Create reusable text snippets (admin + agents)
- ❌ Shortcut key or `/` command in message input to search and insert
- ❌ Category grouping (greeting, follow-up, closing, etc.)
- ❌ DB: `quick_replies` table (id, shortcut, title, content, category, agent_id nullable)

#### 8. ❌ Notifications
- ❌ Browser notification on new incoming message (Notification API + permission request)
- ❌ Sound alert on new message
- ❌ Unread badge in browser tab title
- ❌ Per-agent notification preferences
- ❌ Only notify if conversation is assigned to this agent (or unassigned)

#### 9. ❌ Contact Management
- ❌ Contact detail panel (right sidebar in chat)
- ❌ Edit contact name, add custom notes
- ❌ Contact fields: email, city, source, custom fields (JSONB)
- ❌ Conversation history per contact
- ❌ DB: Add columns to `contacts` or create `contact_fields` table

### P2 — Medium Priority (Week 2-4)

#### 10. ❌ Quoted Replies
- ❌ Reply to a specific message (swipe or click to reply)
- ❌ Show quoted message preview above input
- ❌ Send with `context.message_id` in Meta API
- ❌ Display quoted messages in chat (reference original message)

#### 11. ❌ Auto-Assignment
- ❌ Round-robin assignment of new conversations to online agents
- ❌ Max conversations per agent limit
- ❌ Assignment rules configurable in Settings
- ❌ Option: assign only during business hours

#### 12. ❌ Business Hours
- ❌ Configure working hours per day (Settings UI)
- ❌ Auto-response outside business hours (template)
- ❌ Show "outside hours" indicator
- ❌ DB: `business_hours` table or JSON in settings

#### 13. ❌ Conversation Transfer
- ❌ Transfer conversation to another agent with optional note
- ❌ Transfer history visible in chat
- ❌ System message: "Conversation transferred from X to Y"

#### 14. ❌ Search Messages
- ❌ Full-text search across all messages
- ❌ Search within current conversation (Ctrl+F style)
- ❌ Jump to message in chat when clicking search result

### P3 — Nice to Have (Month 2+)

#### 15. ❌ Basic Analytics Dashboard
- ❌ Total conversations (open/resolved) per period
- ❌ Messages sent/received per day
- ❌ Average response time per agent
- ❌ Conversations per agent
- ❌ Simple charts (can use Recharts or Chart.js)

#### 16. ❌ Bulk Template Sending
- ❌ Select multiple contacts / upload CSV
- ❌ Choose template + fill parameters
- ❌ Send with rate limiting (respect Meta limits)
- ❌ Progress indicator

#### 17. ❌ Webhook for External Integrations
- ❌ Emit events (new_message, conversation_assigned, etc.) to configurable URL
- ❌ Useful for n8n workflows, Pipedrive sync, etc.
- ❌ Configurable in Settings

#### 18. ❌ Message Reactions
- ❌ React to customer messages with emoji
- ❌ Display reactions on messages

#### 19. ❌ Read Receipts Control
- ❌ Option to disable sending read receipts to customers
- ❌ Per-agent or global setting

#### 20. ❌ Mobile Responsive
- ❌ Responsive layout for tablet/mobile
- ❌ Collapsible sidebar
- ❌ Touch-friendly message actions

---

## Implementation Guidelines

### When Adding a New Feature

1. **Database changes**: Add migrations to `db.js` in the `initDB()` function (use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for safety)
2. **Backend route**: Create new route file in `backend/src/routes/` if needed, register in `index.js`
3. **API client**: Add endpoint to `frontend/src/api.js`
4. **Frontend component**: Create in `frontend/src/components/`, import in App.jsx or parent component
5. **Socket events**: If real-time needed, emit from backend route, handle in `App.jsx`

### When Modifying Existing Features

1. Always check the DB schema in `db.js` first
2. Check `api.js` for existing endpoint patterns
3. Follow existing component patterns (state in App.jsx, props down to children)
4. Test locally with `docker compose up -d --build` before pushing

### Testing

- **Local**: `docker compose up -d --build` → localhost:8080
- **Quick API test**: `curl http://localhost:3000/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@inbox.local","password":"admin123"}'`
- **Webhook test**: Use ngrok for local testing, or test on production directly
- **Media test**: Send yourself a WhatsApp message with an image/doc and verify it displays

### Security Notes
- Never commit `.env` or credentials
- Meta tokens are stored encrypted-at-rest in PostgreSQL (EasyPanel manages this)
- JWT secret must be strong in production
- Admin routes are protected by `adminOnly` middleware
- Webhook has no auth (Meta's design) but validates message structure

---

## Current Known Issues

1. **Socket.io through EasyPanel proxy is unreliable** — Messages don't always appear in real-time. Workaround: reload messages after each send. Need to investigate WebSocket transport through EasyPanel's proxy.
2. **No media sending** — Agents can only send text and templates. Priority fix.
3. **No 24h window tracking** — Agents don't know when they can send free-form vs template-only. Risk of API errors.
4. **No labels/tags** — No way to categorize leads (new, qualified, follow-up, etc.)
5. **No browser notifications** — Agents miss new messages if tab is in background.

---

## Quick Reference: Meta Cloud API Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Send message | POST | `/{phone_id}/messages` |
| Upload media | POST | `/{phone_id}/media` |
| Get media URL | GET | `/{media_id}` |
| Download media | GET | `{url from above}` (with Bearer token) |
| Mark as read | POST | `/{phone_id}/messages` with `{"messaging_product":"whatsapp","status":"read","message_id":"xxx"}` |
| Get templates | GET | `/{waba_id}/message_templates` |
| Verify webhook | GET | `/webhook` (challenge response) |
| Receive updates | POST | `/webhook` |

All endpoints use base: `https://graph.facebook.com/v21.0/`
Auth header: `Authorization: Bearer {META_ACCESS_TOKEN}`