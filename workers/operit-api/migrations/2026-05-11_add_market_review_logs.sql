CREATE TABLE IF NOT EXISTS market_review_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_type TEXT NOT NULL,
  repo TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  issue_title TEXT,
  action TEXT NOT NULL,
  reason_codes_json TEXT,
  previous_review_state TEXT,
  next_review_state TEXT,
  actor_username TEXT,
  actor_display_name TEXT,
  actor_role TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_review_logs_issue
  ON market_review_logs(market_type, issue_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_review_logs_created
  ON market_review_logs(created_at DESC);
