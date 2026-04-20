CREATE TABLE IF NOT EXISTS market_entry_stats (
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  installs INTEGER NOT NULL DEFAULT 0,
  last_download_at TEXT,
  last_install_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (type, id)
);

CREATE INDEX IF NOT EXISTS idx_market_entry_stats_type_downloads
ON market_entry_stats (type, downloads DESC);

CREATE INDEX IF NOT EXISTS idx_market_entry_stats_type_installs
ON market_entry_stats (type, installs DESC);

CREATE INDEX IF NOT EXISTS idx_market_entry_stats_type_updated
ON market_entry_stats (type, updated_at DESC);
