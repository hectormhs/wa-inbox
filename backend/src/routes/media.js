import { Router } from 'express';
import axios from 'axios';
import { authMiddleware } from '../middleware/auth.js';
import pool from '../db.js';

const router = Router();

// Cache for downloaded media (in-memory, simple approach)
const mediaCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Proxy media from Meta (requires auth)
router.get('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get message from DB
    const msgRes = await pool.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    const msg = msgRes.rows[0];
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (!msg.media_url) return res.status(404).json({ error: 'Sin media' });

    // Check cache
    const cached = mediaCache.get(messageId);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'private, max-age=1800');
      return res.send(cached.data);
    }

    // If media_url is a Meta media ID (numeric), get the actual URL first
    let mediaUrl = msg.media_url;
    let contentType = msg.media_mime_type || 'application/octet-stream';

    if (/^\d+$/.test(mediaUrl)) {
      // It's a Meta media ID, get the URL
      const metaRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaUrl}`, {
        headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
      });
      mediaUrl = metaRes.data.url;
      contentType = metaRes.data.mime_type || contentType;
    }

    // Download the media
    const mediaRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const data = Buffer.from(mediaRes.data);
    const finalContentType = mediaRes.headers['content-type'] || contentType;

    // Cache it
    mediaCache.set(messageId, { data, contentType: finalContentType, time: Date.now() });

    // Clean old cache entries
    if (mediaCache.size > 200) {
      const now = Date.now();
      for (const [key, val] of mediaCache) {
        if (now - val.time > CACHE_TTL) mediaCache.delete(key);
      }
    }

    res.set('Content-Type', finalContentType);
    res.set('Cache-Control', 'private, max-age=1800');
    res.send(data);
  } catch (err) {
    console.error('❌ Media proxy error:', err.message);
    res.status(500).json({ error: 'Error descargando media' });
  }
});

export default router;
