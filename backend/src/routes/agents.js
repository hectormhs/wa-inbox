import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, color, is_online FROM agents ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await pool.query('UPDATE conversations SET assigned_agent_id = NULL WHERE assigned_agent_id = $1', [req.params.id]);
    await pool.query('DELETE FROM agents WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
