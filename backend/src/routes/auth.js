import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM agents WHERE email = $1', [email]);
    const agent = result.rows[0];
    if (!agent) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, agent.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    await pool.query('UPDATE agents SET is_online = true WHERE id = $1', [agent.id]);
    const token = generateToken(agent);
    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, color: agent.color } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', authMiddleware, async (req, res) => {
  try {
    if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Solo admin puede crear agentes' });
    const { name, email, password, role = 'agent', color = '#3B82F6' } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO agents (name, email, password, role, color) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, color',
      [name, email, hash, role, color]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT id, name, email, role, color, is_online FROM agents WHERE id = $1', [req.agent.id]);
  res.json(result.rows[0]);
});

export default router;
