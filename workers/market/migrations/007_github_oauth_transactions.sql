CREATE TABLE IF NOT EXISTS github_oauth_transactions (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  delivery_secret_hash TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  status TEXT NOT NULL,
  encrypted_payload TEXT,
  payload_iv TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  client_ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_github_oauth_transactions_expiry
  ON github_oauth_transactions(expires_at);

CREATE INDEX IF NOT EXISTS idx_github_oauth_transactions_rate_limit
  ON github_oauth_transactions(client_ip_hash, created_at);
