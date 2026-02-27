import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { fetchTemplates } from '../meta.js';

const router = Router();
router.use(authMiddleware);

// List templates from DB
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM templates WHERE status = 'APPROVED' ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync templates from Meta
router.post('/sync', async (req, res) => {
  try {
    const templates = await fetchTemplates();
    let synced = 0;

    for (const t of templates) {
      await pool.query(
        `INSERT INTO templates (meta_id, name, language, category, status, components, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (meta_id) DO UPDATE SET name = $2, status = $5, components = $6, synced_at = NOW()`,
        [t.id, t.name, t.language, t.category, t.status, JSON.stringify(t.components)]
      );
      synced++;
    }

    // Add unique constraint if not exists
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_meta_id ON templates(meta_id)').catch(() => {});

    res.json({ synced, total: templates.length });
  } catch (err) {
    console.error('❌ Sync error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

export default router;
