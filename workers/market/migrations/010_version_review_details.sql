-- Human-readable, version-level feedback attached to a review decision.
-- Existing databases already have market_versions from 001_init.sql.
CREATE TABLE IF NOT EXISTS market_version_review_details (
  version_id   TEXT PRIMARY KEY,
  detail       TEXT NOT NULL,
  reviewer_id  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY(version_id) REFERENCES market_versions(id) ON DELETE CASCADE
);
