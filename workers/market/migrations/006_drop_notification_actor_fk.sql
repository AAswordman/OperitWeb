-- Drop market_notifications.actor_id -> market_authors(id) FK
-- actor_id is a descriptive field ("who triggered"), not a reference constraint.
-- The recipient FK already ensures delivery to a valid author.

CREATE TABLE IF NOT EXISTS market_notifications_new (
  id          TEXT PRIMARY KEY,
  recipient   TEXT NOT NULL,
  kind        TEXT NOT NULL,
  entry_id    TEXT,
  comment_id  TEXT,
  actor_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  FOREIGN KEY(recipient) REFERENCES market_authors(id),
  FOREIGN KEY(entry_id) REFERENCES market_entries(id),
  FOREIGN KEY(comment_id) REFERENCES market_comments(id)
);

INSERT OR IGNORE INTO market_notifications_new (id, recipient, kind, entry_id, comment_id, actor_id, title, body, created_at)
SELECT id, recipient, kind, entry_id, comment_id, actor_id, title, body, created_at
FROM market_notifications;

DROP TABLE market_notifications;
ALTER TABLE market_notifications_new RENAME TO market_notifications;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON market_notifications(recipient, created_at DESC);
