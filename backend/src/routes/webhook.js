import { Router } from 'express';
import pool from '../db.js';
import { markAsRead, getMediaUrl } from '../meta.js';

const router = Router();

// Webhook verification (Meta sends GET to verify)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Receive messages
router.post('/', async (req, res) => {
  // Always respond 200 quickly to Meta
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body.object || body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // Handle status updates (sent, delivered, read)
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }

        // Handle incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            const contact = value.contacts?.[0];
            await handleIncomingMessage(message, contact);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Webhook error:', err);
  }
});

async function handleIncomingMessage(message, contactInfo) {
  const phone = message.from;
  const profileName = contactInfo?.profile?.name || null;

  // Upsert contact
  const contactRes = await pool.query(
    `INSERT INTO contacts (phone, name, profile_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET profile_name = COALESCE($3, contacts.profile_name)
     RETURNING id`,
    [phone, profileName || phone, profileName]
  );
  const contactId = contactRes.rows[0].id;

  // Get or create conversation
  let convRes = await pool.query(
    "SELECT id FROM conversations WHERE contact_id = $1 AND status != 'resolved' ORDER BY created_at DESC LIMIT 1",
    [contactId]
  );

  let conversationId;
  if (convRes.rows.length === 0) {
    const newConv = await pool.query(
      'INSERT INTO conversations (contact_id, last_message_at) VALUES ($1, NOW()) RETURNING id',
      [contactId]
    );
    conversationId = newConv.rows[0].id;
  } else {
    conversationId = convRes.rows[0].id;
  }

  // Parse message content
  let content = '';
  let messageType = 'text';
  let mediaUrl = null;
  let mediaMime = null;

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;
    case 'image':
      messageType = 'image';
      content = message.image?.caption || '';
      mediaUrl = message.image?.id || null;
      mediaMime = message.image?.mime_type;
      break;
    case 'document':
      messageType = 'document';
      content = message.document?.caption || message.document?.filename || 'Documento';
      mediaUrl = message.document?.id || null;
      mediaMime = message.document?.mime_type;
      break;
    case 'audio':
      messageType = 'audio';
      content = 'Audio';
      mediaUrl = message.audio?.id || null;
      mediaMime = message.audio?.mime_type;
      break;
    case 'video':
      messageType = 'video';
      content = message.video?.caption || 'Video';
      mediaUrl = message.video?.id || null;
      mediaMime = message.video?.mime_type;
      break;
    case 'sticker':
      messageType = 'sticker';
      content = 'Sticker';
      mediaUrl = message.sticker?.id || null;
      mediaMime = message.sticker?.mime_type;
      break;
    case 'location':
      messageType = 'location';
      content = JSON.stringify({ lat: message.location?.latitude, lng: message.location?.longitude, name: message.location?.name });
      break;
    case 'reaction':
      messageType = 'reaction';
      content = message.reaction?.emoji || '';
      break;
    default:
      content = `[${message.type}]`;
  }

  // Save message
  const msgRes = await pool.query(
    `INSERT INTO messages (conversation_id, sender_type, content, message_type, media_url, media_mime_type, meta_message_id, status)
     VALUES ($1, 'contact', $2, $3, $4, $5, $6, 'received')
     RETURNING *`,
    [conversationId, content, messageType, mediaUrl, mediaMime, message.id]
  );

  // Update conversation
  const preview = content.substring(0, 100) || `[${messageType}]`;
  await pool.query(
    'UPDATE conversations SET last_message_at = NOW(), last_message_preview = $1, unread_count = unread_count + 1 WHERE id = $2',
    [preview, conversationId]
  );

  // Mark as read in WhatsApp
  try {
    await markAsRead(message.id);
  } catch {}

  // Emit via Socket.io
  const io = req.app?.get?.('io') || global.io;
  if (io) {
    const fullMsg = msgRes.rows[0];
    const convData = await getConversationData(conversationId);
    io.emit('new_message', { message: fullMsg, conversation: convData });
  }
}

async function handleStatusUpdate(status) {
  const statusMap = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
  const newStatus = statusMap[status.status];
  if (!newStatus) return;

  await pool.query(
    'UPDATE messages SET status = $1 WHERE meta_message_id = $2',
    [newStatus, status.id]
  );

  const io = global.io;
  if (io) {
    io.emit('message_status', { meta_message_id: status.id, status: newStatus });
  }
}

async function getConversationData(conversationId) {
  const res = await pool.query(
    `SELECT c.*, ct.phone, ct.name as contact_name, ct.profile_name,
            a.name as agent_name, a.color as agent_color
     FROM conversations c
     JOIN contacts ct ON c.contact_id = ct.id
     LEFT JOIN agents a ON c.assigned_agent_id = a.id
     WHERE c.id = $1`,
    [conversationId]
  );
  return res.rows[0];
}

async function getMediaUrlSafe(mediaId) {
  try {
    return await getMediaUrl(mediaId);
  } catch {
    return null;
  }
}

// Make io accessible in the webhook handler
router.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

export default router;
