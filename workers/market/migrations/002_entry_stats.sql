-- v2 entry statistics ledger: v1 one-shot baseline + v2 Analytics Engine aggregates

CREATE TABLE IF NOT EXISTS market_entry_stats (
  entry_id          TEXT PRIMARY KEY,
  type              TEXT NOT NULL,
  legacy_downloads  INTEGER NOT NULL DEFAULT 0,
  legacy_likes      INTEGER NOT NULL DEFAULT 0,
  cf_downloads      INTEGER NOT NULL DEFAULT 0,
  cf_likes          INTEGER NOT NULL DEFAULT 0,
  downloads_total   INTEGER NOT NULL DEFAULT 0,
  likes_total       INTEGER NOT NULL DEFAULT 0,
  last_download_at  TEXT,
  last_like_at      TEXT,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entry_stats_type ON market_entry_stats(type, downloads_total DESC, likes_total DESC);

CREATE TABLE IF NOT EXISTS market_analytics_aggregate_windows (
  id            TEXT PRIMARY KEY,
  window_start  TEXT NOT NULL,
  window_end    TEXT NOT NULL,
  downloads     INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_windows_end ON market_analytics_aggregate_windows(window_end DESC);
