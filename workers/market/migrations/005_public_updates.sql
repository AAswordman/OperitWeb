ALTER TABLE market_entries ADD COLUMN allow_public_updates INTEGER NOT NULL DEFAULT 1;
ALTER TABLE market_versions ADD COLUMN publisher_id TEXT REFERENCES market_authors(id);

UPDATE market_entries SET allow_public_updates = 1 WHERE allow_public_updates IS NULL;
UPDATE market_versions
SET publisher_id = (
  SELECT publisher_id
  FROM market_entries
  WHERE market_entries.id = market_versions.entry_id
)
WHERE publisher_id IS NULL OR publisher_id = '';
