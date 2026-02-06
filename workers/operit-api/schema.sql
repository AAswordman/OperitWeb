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
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions(status, created_at DESC);
