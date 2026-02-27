import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// List conversations
router.get('/', async (req, res) => {
  try {
    const { status = 'open', search } = req.query;
    let query = `
      SELECT c.*, ct.phone, ct.name as contact_name, ct.profile_name,
             a.name as agent_name, a.color as agent_color
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN agents a ON c.assigned_agent_id = a.id
    `;
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ct.name ILIKE $${params.length} OR ct.phone ILIKE $${params.length} OR ct.profile_name ILIKE $${params.length})`);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY c.last_message_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single conversation
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, ct.phone, ct.name as contact_name, ct.profile_name,
              a.name as agent_name, a.color as agent_color
       FROM conversations c
       JOIN contacts ct ON c.contact_id = ct.id
       LEFT JOIN agents a ON c.assigned_agent_id = a.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Conversación no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign agent
router.patch('/:id/assign', async (req, res) => {
  try {
    const { agent_id } = req.body;
    const result = await pool.query(
      'UPDATE conversations SET assigned_agent_id = $1 WHERE id = $2 RETURNING *',
      [agent_id, req.params.id]
    );

    const io = req.app.get('io');
    if (io) io.emit('conversation_updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE conversations SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    const io = req.app.get('io');
    if (io) io.emit('conversation_updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark as read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE conversations SET unread_count = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
