-- ============ TMailku D1 schema ============

-- Domain yang dikelola
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'routing',   -- 'routing' | 'imap' | 'both'
  status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'disabled'
  verified INTEGER NOT NULL DEFAULT 0,       -- hasil cek MX/routing
  created_at INTEGER NOT NULL
);

-- Alamat temporary yang aktif
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,              -- user@domain
  domain_id TEXT REFERENCES domains(id),
  owner_token TEXT NOT NULL,                 -- token anonim pemilik inbox
  expires_at INTEGER,                        -- TTL auto-delete
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_addresses_address ON addresses(address);
CREATE INDEX IF NOT EXISTS idx_addresses_expires ON addresses(expires_at);

-- Email yang diterima
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  address_id TEXT REFERENCES addresses(id),
  message_id TEXT,
  from_addr TEXT,
  from_name TEXT,
  to_addr TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  otp_code TEXT,                             -- hasil auto-detect OTP
  has_attachment INTEGER NOT NULL DEFAULT 0,
  raw_r2_key TEXT,
  source TEXT,                               -- 'routing' | 'imap'
  seen INTEGER NOT NULL DEFAULT 0,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emails_address ON emails(address_id, received_at);

-- Lampiran (pointer ke R2)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT REFERENCES emails(id),
  filename TEXT,
  content_type TEXT,
  size INTEGER,
  r2_key TEXT
);

-- Konfigurasi sumber IMAP eksternal
CREATE TABLE IF NOT EXISTS imap_accounts (
  id TEXT PRIMARY KEY,
  label TEXT,
  hostname TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 993,
  encryption TEXT NOT NULL DEFAULT 'ssl',    -- 'ssl' | 'starttls' | 'none'
  username TEXT NOT NULL,
  password TEXT NOT NULL,                     -- plaintext (gunakan App Password)
  folder TEXT NOT NULL DEFAULT 'INBOX',
  poll_interval INTEGER NOT NULL DEFAULT 120, -- detik
  domain_id TEXT REFERENCES domains(id),
  last_uid INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at INTEGER,
  last_error TEXT
);

-- Admin
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Log aktivitas (untuk activity feed + panel terminal di Overview)
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  scope TEXT,
  message TEXT,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

-- Pengaturan global (branding/security/api/system/integrations) key/value
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  "group" TEXT,                              -- 'branding'|'security'|'api'|'system'|'integrations'
  type TEXT,                                  -- 'text'|'color'|'image'|'toggle'|'number'|'password'
  label TEXT,
  updated_at INTEGER
);

-- API keys untuk akses API publik
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT,
  key_prefix TEXT,
  key_hash TEXT NOT NULL,
  scopes TEXT,                                -- JSON array
  rate_limit INTEGER DEFAULT 60,              -- req/menit
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

-- Seed default settings
INSERT OR IGNORE INTO settings (key, value, "group", type, label, updated_at) VALUES
  ('app_name', 'TMailku', 'branding', 'text', 'App Name', 0),
  ('logo_url', '', 'branding', 'image', 'Logo', 0),
  ('favicon_url', '', 'branding', 'image', 'Favicon', 0),
  ('hero_title', 'Email Sementara, Instan & Privat', 'branding', 'text', 'Hero Title', 0),
  ('hero_subtitle', 'Terima email tanpa registrasi. Auto-hapus otomatis.', 'branding', 'text', 'Hero Subtitle', 0),
  ('default_theme', 'dark', 'branding', 'text', 'Default Theme', 0),
  ('default_lang', 'id', 'branding', 'text', 'Default Language', 0),
  ('site_locked', 'false', 'security', 'toggle', 'Lock Website', 0),
  ('site_lock_password_hash', '', 'security', 'password', 'Lock Password', 0),
  ('api_enabled', 'true', 'api', 'toggle', 'Enable Public API', 0),
  ('ttl_minutes', '60', 'system', 'number', 'TTL Default (menit)', 0),
  ('max_attachment_mb', '10', 'system', 'number', 'Batas Attachment (MB)', 0),
  ('blocklist_senders', '', 'system', 'text', 'Blocklist Pengirim', 0),
  ('address_format', 'word+num', 'system', 'text', 'Format Alamat Random', 0),
  ('global_rate_limit', '120', 'system', 'number', 'Rate Limit Global (req/menit)', 0),
  ('telegram_bot_token', '', 'integrations', 'password', 'Telegram Bot Token', 0),
  ('telegram_chat_id', '', 'integrations', 'text', 'Telegram Chat ID', 0),
  ('webhook_url', '', 'integrations', 'text', 'Webhook URL', 0),
  ('webhook_enabled', 'false', 'integrations', 'toggle', 'Enable Webhook', 0),
  ('setup_completed', 'false', 'system', 'toggle', 'Setup Completed', 0);
