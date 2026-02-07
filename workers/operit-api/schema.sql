CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  language TEXT NOT NULL,
  target_path TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_words INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS submission_leaderboard_cache (
  author_key TEXT PRIMARY KEY,
  author_name TEXT,
  author_email TEXT,
  total_changed_words INTEGER NOT NULL DEFAULT 0,
  approved_submissions INTEGER NOT NULL DEFAULT 0,
  last_approved_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_leaderboard_changed_words
  ON submission_leaderboard_cache(total_changed_words DESC, last_approved_at DESC);

CREATE TABLE IF NOT EXISTS submission_assets (
  submission_id TEXT NOT NULL,
  id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT,
  tmp_key TEXT,
  temp_url TEXT,
  repo_path TEXT,
  public_path TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  uploaded_at TEXT,
  migrated_at TEXT,
  deleted_at TEXT,
  PRIMARY KEY (submission_id, id)
);

CREATE INDEX IF NOT EXISTS idx_submission_assets_status_created
  ON submission_assets(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_assets_deleted
  ON submission_assets(deleted_at, created_at DESC);

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
