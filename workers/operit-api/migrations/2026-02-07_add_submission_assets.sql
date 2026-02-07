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
