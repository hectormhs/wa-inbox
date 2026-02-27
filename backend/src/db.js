import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/wa_inbox',
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'agent',
      is_online BOOLEAN DEFAULT false,
      color VARCHAR(7) DEFAULT '#10B981',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100),
      profile_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES contacts(id),
      assigned_agent_id INTEGER REFERENCES agents(id),
      status VARCHAR(20) DEFAULT 'open',
      last_message_at TIMESTAMP DEFAULT NOW(),
      last_message_preview TEXT,
      unread_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      sender_type VARCHAR(10) NOT NULL,
      sender_id INTEGER,
      content TEXT,
      message_type VARCHAR(20) DEFAULT 'text',
      media_url TEXT,
      media_mime_type VARCHAR(50),
      meta_message_id VARCHAR(100),
      is_note BOOLEAN DEFAULT false,
      status VARCHAR(20) DEFAULT 'sent',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      meta_id VARCHAR(100),
      name VARCHAR(100) NOT NULL,
      language VARCHAR(10) DEFAULT 'es',
      category VARCHAR(50),
      status VARCHAR(20) DEFAULT 'APPROVED',
      components JSONB,
      synced_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
    CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
  `);

  // Create default admin if not exists
  const adminExists = await pool.query("SELECT id FROM agents WHERE email = 'admin@inbox.local'");
  if (adminExists.rows.length === 0) {
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default;
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await pool.query(
      "INSERT INTO agents (name, email, password, role, color) VALUES ('Admin', 'admin@inbox.local', $1, 'admin', '#10B981')",
      [hash]
    );
    console.log('✅ Default admin created: admin@inbox.local / admin123');
  }
}

export default pool;
