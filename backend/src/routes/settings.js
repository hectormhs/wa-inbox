import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Only admins can access settings
function adminOnly(req, res, next) {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
}

// ===== APP SETTINGS (stored in DB) =====

// Init settings table
export async function initSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// Get all settings
router.get('/', adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings ORDER BY key');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    // Merge with env vars (env takes precedence, but show DB values)
    // Mask tokens for display
    const meta = {
      meta_access_token: maskToken(settings.meta_access_token || process.env.META_ACCESS_TOKEN || ''),
      meta_phone_number_id: settings.meta_phone_number_id || process.env.META_PHONE_NUMBER_ID || '',
      meta_waba_id: settings.meta_waba_id || process.env.META_WABA_ID || '',
      meta_verify_token: settings.meta_verify_token || process.env.META_VERIFY_TOKEN || '',
      webhook_url: settings.webhook_url || '',
    };
    // Check if configured from env or db
    const source = {
      meta_access_token: settings.meta_access_token ? 'db' : (process.env.META_ACCESS_TOKEN && process.env.META_ACCESS_TOKEN !== 'test' ? 'env' : 'none'),
      meta_phone_number_id: settings.meta_phone_number_id ? 'db' : (process.env.META_PHONE_NUMBER_ID && process.env.META_PHONE_NUMBER_ID !== 'test' ? 'env' : 'none'),
      meta_waba_id: settings.meta_waba_id ? 'db' : (process.env.META_WABA_ID && process.env.META_WABA_ID !== 'test' ? 'env' : 'none'),
      meta_verify_token: settings.meta_verify_token ? 'db' : (process.env.META_VERIFY_TOKEN && process.env.META_VERIFY_TOKEN !== 'test' ? 'env' : 'none'),
    };
    res.json({ meta, source });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
router.put('/', adminOnly, async (req, res) => {
  try {
    const { meta_access_token, meta_phone_number_id, meta_waba_id, meta_verify_token, webhook_url } = req.body;

    const updates = [];
    if (meta_access_token && !meta_access_token.includes('***')) updates.push(['meta_access_token', meta_access_token]);
    if (meta_phone_number_id) updates.push(['meta_phone_number_id', meta_phone_number_id]);
    if (meta_waba_id) updates.push(['meta_waba_id', meta_waba_id]);
    if (meta_verify_token) updates.push(['meta_verify_token', meta_verify_token]);
    if (webhook_url !== undefined) updates.push(['webhook_url', webhook_url]);

    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }

    // Update runtime config
    for (const [key, value] of updates) {
      const envKey = key.toUpperCase();
      if (envKey === 'META_ACCESS_TOKEN' || envKey === 'META_PHONE_NUMBER_ID' || envKey === 'META_WABA_ID' || envKey === 'META_VERIFY_TOKEN') {
        process.env[envKey] = value;
      }
    }

    res.json({ ok: true, updated: updates.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== AGENT MANAGEMENT =====

// List agents
router.get('/agents', adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, color, is_online, created_at FROM agents ORDER BY created_at');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create agent
router.post('/agents', adminOnly, async (req, res) => {
  try {
    const { name, email, password, role = 'agent', color = '#3B82F6' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO agents (name, email, password, role, color) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, color, created_at',
      [name, email, hash, role, color]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ya existe un agente con ese email' });
    res.status(500).json({ error: err.message });
  }
});

// Update agent
router.put('/agents/:id', adminOnly, async (req, res) => {
  try {
    const { name, email, role, color, password } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (name) { fields.push(`name = $${i++}`); values.push(name); }
    if (email) { fields.push(`email = $${i++}`); values.push(email); }
    if (role) { fields.push(`role = $${i++}`); values.push(role); }
    if (color) { fields.push(`color = $${i++}`); values.push(color); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password = $${i++}`);
      values.push(hash);
    }

    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE agents SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, color`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete agent
router.delete('/agents/:id', adminOnly, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.agent.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await pool.query('UPDATE conversations SET assigned_agent_id = NULL WHERE assigned_agent_id = $1', [req.params.id]);
    await pool.query('DELETE FROM agents WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CONNECTION TEST =====
router.post('/test-connection', adminOnly, async (req, res) => {
  try {
    const { fetchTemplates } = await import('../meta.js');
    const templates = await fetchTemplates();

    // Auto-sync templates to DB
    let synced = 0;
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_meta_id ON templates(meta_id)').catch(() => {});
    for (const t of templates) {
      await pool.query(
        `INSERT INTO templates (meta_id, name, language, category, status, components, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (meta_id) DO UPDATE SET name = $2, status = $5, components = $6, synced_at = NOW()`,
        [t.id, t.name, t.language, t.category, t.status, JSON.stringify(t.components)]
      );
      synced++;
    }

    res.json({ ok: true, message: `Conexión exitosa. ${templates.length} templates sincronizados.` });
  } catch (err) {
    res.json({ ok: false, message: err.response?.data?.error?.message || err.message });
  }
});

function maskToken(token) {
  if (!token || token.length < 10) return token ? '***' : '';
  return token.substring(0, 6) + '***' + token.substring(token.length - 4);
}

// Load settings from DB into env on startup
export async function loadSettingsIntoEnv() {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    for (const row of result.rows) {
      const envKey = row.key.toUpperCase();
      if (['META_ACCESS_TOKEN', 'META_PHONE_NUMBER_ID', 'META_WABA_ID', 'META_VERIFY_TOKEN'].includes(envKey)) {
        if (row.value && (!process.env[envKey] || process.env[envKey] === 'test')) {
          process.env[envKey] = row.value;
        }
      }
    }
  } catch {}
}

export default router;
