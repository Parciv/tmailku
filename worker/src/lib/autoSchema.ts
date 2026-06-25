import type { Env } from "../types";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    domain TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL DEFAULT 'routing',
    status TEXT NOT NULL DEFAULT 'active',
    verified INTEGER NOT NULL DEFAULT 0,
    is_verified INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    receive_imap_enabled INTEGER NOT NULL DEFAULT 0,
    receive_routing_enabled INTEGER NOT NULL DEFAULT 1,
    routing_status TEXT NOT NULL DEFAULT 'waiting',
    routing_last_email_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain)`,

  `CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    domain_id TEXT REFERENCES domains(id),
    owner_token TEXT NOT NULL,
    expires_at INTEGER,
    blocked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_addresses_address ON addresses(address)`,
  `CREATE INDEX IF NOT EXISTS idx_addresses_expires ON addresses(expires_at)`,

  `CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    address_id TEXT REFERENCES addresses(id),
    message_id TEXT,
    from_addr TEXT,
    from_name TEXT,
    to_addr TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    otp_code TEXT,
    has_attachment INTEGER NOT NULL DEFAULT 0,
    raw_r2_key TEXT,
    source TEXT,
    seen INTEGER NOT NULL DEFAULT 0,
    received_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emails_address ON emails(address_id, received_at)`,

  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    email_id TEXT REFERENCES emails(id),
    filename TEXT,
    content_type TEXT,
    size INTEGER,
    r2_key TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS imap_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 993,
    encryption TEXT NOT NULL DEFAULT 'ssl',
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT 'INBOX',
    polling_interval_minutes INTEGER NOT NULL DEFAULT 2,
    last_test_status TEXT,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS imap_settings (
    id TEXT PRIMARY KEY,
    domain_id TEXT UNIQUE REFERENCES domains(id),
    profile_id TEXT REFERENCES imap_profiles(id),
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 993,
    encryption TEXT NOT NULL DEFAULT 'ssl',
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT 'INBOX',
    polling_interval_minutes INTEGER NOT NULL DEFAULT 2,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_uid INTEGER NOT NULL DEFAULT 0,
    last_sync_at INTEGER,
    last_test_status TEXT,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS imap_accounts (
    id TEXT PRIMARY KEY,
    label TEXT,
    hostname TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 993,
    encryption TEXT NOT NULL DEFAULT 'ssl',
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT 'INBOX',
    poll_interval INTEGER NOT NULL DEFAULT 120,
    domain_id TEXT REFERENCES domains(id),
    last_uid INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_sync_at INTEGER,
    last_error TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL DEFAULT 'info',
    scope TEXT,
    message TEXT,
    meta TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)`,

  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    "group" TEXT,
    type TEXT,
    label TEXT,
    updated_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT,
    key_prefix TEXT,
    key_hash TEXT NOT NULL,
    scopes TEXT,
    rate_limit INTEGER DEFAULT 60,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_used_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL
  )`,

  `INSERT OR IGNORE INTO settings (key, value, "group", type, label, updated_at) VALUES
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
    ('setup_completed', 'false', 'system', 'toggle', 'Setup Completed', 0)`,
];

const MIGRATION_STATEMENTS = [
  `ALTER TABLE domains ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE domains ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE domains ADD COLUMN receive_imap_enabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE domains ADD COLUMN receive_routing_enabled INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE domains ADD COLUMN routing_status TEXT NOT NULL DEFAULT 'waiting'`,
  `ALTER TABLE domains ADD COLUMN routing_last_email_at INTEGER`,
  `ALTER TABLE imap_settings ADD COLUMN profile_id TEXT REFERENCES imap_profiles(id)`,
  `ALTER TABLE imap_settings ADD COLUMN polling_interval_minutes INTEGER NOT NULL DEFAULT 2`,
  `ALTER TABLE imap_settings ADD COLUMN last_test_status TEXT`,
  `ALTER TABLE imap_settings ADD COLUMN last_error TEXT`,
  `ALTER TABLE api_keys ADD COLUMN last_used_at INTEGER`,
  `ALTER TABLE api_keys ADD COLUMN expires_at INTEGER`,
];

let schemaReady: Promise<void> | null = null;

export function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = runSchema(env).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function runSchema(env: Env) {
  for (const sql of SCHEMA_STATEMENTS) {
    await env.DB.prepare(sql).run();
  }

  for (const sql of MIGRATION_STATEMENTS) {
    await env.DB.prepare(sql).run().catch((error: any) => {
      const msg = String(error?.message || error).toLowerCase();
      if (msg.includes("duplicate column") || msg.includes("already exists")) return;
      throw error;
    });
  }
}
