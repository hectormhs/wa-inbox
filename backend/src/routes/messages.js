import { Router } from 'express';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { sendTextMessage, sendTemplateMessage, sendMediaMessage, uploadMediaToMeta } from '../meta.js';

const uploadsDir = path.join(process.cwd(), 'uploads');
mkdir(uploadsDir, { recursive: true }).catch(() => {});

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});

// Get messages for a conversation
router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;

    let query = 'SELECT m.*, a.name as agent_name, a.color as agent_color FROM messages m LEFT JOIN agents a ON m.sender_id = a.id WHERE m.conversation_id = $1';
    const params = [conversationId];

    if (before) {
      params.push(before);
      query += ` AND m.created_at < $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a text message
router.post('/:conversationId/send', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    // Get the contact phone
    const conv = await pool.query(
      'SELECT ct.phone FROM conversations c JOIN contacts ct ON c.contact_id = ct.id WHERE c.id = $1',
      [conversationId]
    );
    if (!conv.rows[0]) return res.status(404).json({ error: 'Conversación no encontrada' });

    const phone = conv.rows[0].phone;

    // Send via Meta API
    const metaRes = await sendTextMessage(phone, content);
    const metaMessageId = metaRes.messages?.[0]?.id;

    // Save to DB
    const msgRes = await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, meta_message_id, status)
       VALUES ($1, 'agent', $2, $3, 'text', $4, 'sent')
       RETURNING *`,
      [conversationId, req.agent.id, content, metaMessageId]
    );

    // Update conversation
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), last_message_preview = $1, unread_count = 0 WHERE id = $2',
      [content.substring(0, 100), conversationId]
    );

    const message = { ...msgRes.rows[0], agent_name: req.agent.name || 'Agent', agent_color: req.agent.color };

    const io = req.app.get('io');
    if (io) io.emit('new_message', { message, conversation_id: parseInt(conversationId) });

    res.json(message);
  } catch (err) {
    console.error('❌ Send error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Send a template message
router.post('/:conversationId/template', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { template_name, language = 'es', components = [] } = req.body;

    const conv = await pool.query(
      'SELECT ct.phone FROM conversations c JOIN contacts ct ON c.contact_id = ct.id WHERE c.id = $1',
      [conversationId]
    );
    if (!conv.rows[0]) return res.status(404).json({ error: 'Conversación no encontrada' });

    const phone = conv.rows[0].phone;
    const metaRes = await sendTemplateMessage(phone, template_name, language, components);
    const metaMessageId = metaRes.messages?.[0]?.id;

    const content = `📋 Template: ${template_name}`;
    const msgRes = await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, meta_message_id, status)
       VALUES ($1, 'agent', $2, $3, 'template', $4, 'sent')
       RETURNING *`,
      [conversationId, req.agent.id, content, metaMessageId]
    );

    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), last_message_preview = $1 WHERE id = $2',
      [content, conversationId]
    );

    const message = { ...msgRes.rows[0], agent_name: req.agent.name, agent_color: req.agent.color };
    const io = req.app.get('io');
    if (io) io.emit('new_message', { message, conversation_id: parseInt(conversationId) });

    res.json(message);
  } catch (err) {
    console.error('❌ Template error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Send a template to a NEW number (creates conversation)
router.post('/new/template', async (req, res) => {
  try {
    const { phone, template_name, language = 'es', components = [], contact_name } = req.body;

    // Send via Meta
    const metaRes = await sendTemplateMessage(phone, template_name, language, components);
    const metaMessageId = metaRes.messages?.[0]?.id;

    // Upsert contact
    const contactRes = await pool.query(
      `INSERT INTO contacts (phone, name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = COALESCE(NULLIF($2, ''), contacts.name)
       RETURNING id`,
      [phone, contact_name || phone]
    );

    // Create conversation
    const convRes = await pool.query(
      'INSERT INTO conversations (contact_id, assigned_agent_id, last_message_at, last_message_preview) VALUES ($1, $2, NOW(), $3) RETURNING id',
      [contactRes.rows[0].id, req.agent.id, `📋 Template: ${template_name}`]
    );

    // Save message
    const content = `📋 Template: ${template_name}`;
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, meta_message_id, status)
       VALUES ($1, 'agent', $2, $3, 'template', $4, 'sent')`,
      [convRes.rows[0].id, req.agent.id, content, metaMessageId]
    );

    const io = req.app.get('io');
    if (io) io.emit('conversation_created', { conversation_id: convRes.rows[0].id });

    res.json({ conversation_id: convRes.rows[0].id, meta_message_id: metaMessageId });
  } catch (err) {
    console.error('❌ New template error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Add internal note
router.post('/:conversationId/note', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    const msgRes = await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, is_note, status)
       VALUES ($1, 'agent', $2, $3, 'text', true, 'sent')
       RETURNING *`,
      [conversationId, req.agent.id, content]
    );

    const message = { ...msgRes.rows[0], agent_name: req.agent.name, agent_color: req.agent.color };
    const io = req.app.get('io');
    if (io) io.emit('new_message', { message, conversation_id: parseInt(conversationId) });

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send media message
router.post('/:conversationId/media', upload.single('file'), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { caption } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No se adjuntó ningún archivo' });

    // Get the contact phone
    const conv = await pool.query(
      'SELECT ct.phone FROM conversations c JOIN contacts ct ON c.contact_id = ct.id WHERE c.id = $1',
      [conversationId]
    );
    if (!conv.rows[0]) return res.status(404).json({ error: 'Conversación no encontrada' });

    const phone = conv.rows[0].phone;

    // Determine media type from mime
    const mime = file.mimetype;
    let mediaType = 'document';
    if (mime.startsWith('image/')) mediaType = 'image';
    else if (mime.startsWith('video/')) mediaType = 'video';
    else if (mime.startsWith('audio/')) mediaType = 'audio';

    // Upload to Meta
    const mediaId = await uploadMediaToMeta(file.buffer, mime, file.originalname);

    // Send via Meta API
    const metaRes = await sendMediaMessage(phone, mediaType, mediaId, caption, file.originalname);
    const metaMessageId = metaRes.messages?.[0]?.id;

    // Preview text for conversation list
    const previewMap = { image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento' };
    const preview = caption || previewMap[mediaType] || 'Archivo';

    // Save to DB
    const msgRes = await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, media_url, media_mime_type, meta_message_id, status)
       VALUES ($1, 'agent', $2, $3, $4, $5, $6, $7, 'sent')
       RETURNING *`,
      [conversationId, req.agent.id, caption || '', mediaType, mediaId, mime, metaMessageId]
    );

    // Save file locally for display (Meta upload IDs are not retrievable)
    await writeFile(path.join(uploadsDir, String(msgRes.rows[0].id)), file.buffer);

    // Update conversation
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), last_message_preview = $1, unread_count = 0 WHERE id = $2',
      [preview.substring(0, 100), conversationId]
    );

    const message = { ...msgRes.rows[0], agent_name: req.agent.name || 'Agent', agent_color: req.agent.color };

    const io = req.app.get('io');
    if (io) io.emit('new_message', { message, conversation_id: parseInt(conversationId) });

    res.json(message);
  } catch (err) {
    console.error('Send media error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

export default router;
