CREATE TABLE IF NOT EXISTS admin_users (
  username TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_username
  ON admin_sessions(username);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
  ON admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_users_disabled
  ON admin_users(disabled_at);

