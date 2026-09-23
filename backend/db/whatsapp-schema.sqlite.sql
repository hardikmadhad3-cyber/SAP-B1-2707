CREATE TABLE IF NOT EXISTS whatsapp_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  card_code TEXT,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES whatsapp_customers(id),
  status TEXT NOT NULL DEFAULT 'open',
  assigned_user_id INTEGER,
  last_message_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES whatsapp_conversations(id),
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  body TEXT,
  wamid TEXT,
  sent_by_user_id INTEGER,
  is_bot INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en_US',
  category TEXT,
  body_preview TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER REFERENCES whatsapp_templates(id),
  created_by_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_broadcast_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL REFERENCES whatsapp_broadcasts(id),
  customer_id INTEGER NOT NULL REFERENCES whatsapp_customers(id),
  status TEXT NOT NULL DEFAULT 'pending',
  error_detail TEXT,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type TEXT UNIQUE NOT NULL,
  template_body TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_customer ON whatsapp_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id);
