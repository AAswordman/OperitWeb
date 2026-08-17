CREATE TABLE IF NOT EXISTS market_reviewer_agent_keys (
  username TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT NOT NULL
);
