CREATE TABLE IF NOT EXISTS reviewer_applications (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  reason TEXT NOT NULL,
  skills TEXT NOT NULL,
  contact TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  turnstile_ok INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  granted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviewer_applications_status_created
  ON reviewer_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviewer_applications_username
  ON reviewer_applications(username);
