CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  language TEXT NOT NULL,
  target_path TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  client_ip_hash TEXT,
  user_agent TEXT,
  turnstile_ok INTEGER,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer TEXT,
  review_notes TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  pr_branch TEXT,
  pr_state TEXT,
  pr_created_at TEXT,
  pr_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ip_bans (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  banned_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_ip_bans_expires
  ON ip_bans(expires_at);

CREATE INDEX IF NOT EXISTS idx_ip_bans_created
  ON ip_bans(created_at DESC);
