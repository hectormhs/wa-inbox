import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDB } from './db.js';
import { verifyToken } from './middleware/auth.js';
import pool from './db.js';

import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import agentRoutes from './routes/agents.js';
import templateRoutes from './routes/templates.js';
import settingsRoutes, { initSettingsTable, loadSettingsIntoEnv } from './routes/settings.js';
import mediaRoutes from './routes/media.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Make io globally available for webhook handler
global.io = io;
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/media', mediaRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Socket.io auth
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Auth required'));
  const agent = verifyToken(token);
  if (!agent) return next(new Error('Invalid token'));
  socket.agent = agent;
  next();
});

io.on('connection', async (socket) => {
  console.log(`🟢 Agent connected: ${socket.agent.email}`);
  await pool.query('UPDATE agents SET is_online = true WHERE id = $1', [socket.agent.id]);
  io.emit('agent_status', { agent_id: socket.agent.id, is_online: true });

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', { ...data, agent_id: socket.agent.id, agent_name: socket.agent.name });
  });

  socket.on('disconnect', async () => {
    console.log(`🔴 Agent disconnected: ${socket.agent.email}`);
    await pool.query('UPDATE agents SET is_online = false WHERE id = $1', [socket.agent.id]);
    io.emit('agent_status', { agent_id: socket.agent.id, is_online: false });
  });
});

// Start
const PORT = process.env.PORT || 3000;

async function start() {
  await initDB();
  await initSettingsTable();
  await loadSettingsIntoEnv();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WA Inbox API running on port ${PORT}`);
    console.log(`📡 Webhook URL: /webhook`);
  });
}

start().catch(console.error);
