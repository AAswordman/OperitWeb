ALTER TABLE submissions ADD COLUMN changed_words INTEGER NOT NULL DEFAULT 0;

UPDATE submissions
SET changed_words =
  CASE
    WHEN content IS NULL OR content = '' THEN 0
    ELSE
      length(
        replace(
          replace(
            replace(
              replace(content, char(13), ''),
              char(10),
              ''
            ),
            char(9),
            ''
          ),
          ' ',
          ''
        )
      )
  END
WHERE changed_words = 0;

CREATE TABLE IF NOT EXISTS submission_leaderboard_cache (
  author_key TEXT PRIMARY KEY,
  author_name TEXT,
  author_email TEXT,
  total_changed_words INTEGER NOT NULL DEFAULT 0,
  approved_submissions INTEGER NOT NULL DEFAULT 0,
  last_approved_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_leaderboard_changed_words
  ON submission_leaderboard_cache(total_changed_words DESC, last_approved_at DESC);

DELETE FROM submission_leaderboard_cache;

INSERT INTO submission_leaderboard_cache (
  author_key,
  author_name,
  author_email,
  total_changed_words,
  approved_submissions,
  last_approved_at,
  updated_at
)
SELECT
  CASE
    WHEN trim(coalesce(author_email, '')) <> '' THEN 'email:' || lower(trim(author_email))
    ELSE 'name:' || lower(trim(coalesce(author_name, '')))
  END AS author_key,
  MAX(CASE WHEN trim(coalesce(author_name, '')) <> '' THEN trim(author_name) ELSE NULL END) AS author_name,
  MAX(CASE WHEN trim(coalesce(author_email, '')) <> '' THEN lower(trim(author_email)) ELSE NULL END) AS author_email,
  SUM(CASE WHEN changed_words > 0 THEN changed_words ELSE 0 END) AS total_changed_words,
  COUNT(*) AS approved_submissions,
  MAX(reviewed_at) AS last_approved_at,
  datetime('now') AS updated_at
FROM submissions
WHERE status = 'approved'
  AND (
    trim(coalesce(author_name, '')) <> ''
    OR trim(coalesce(author_email, '')) <> ''
  )
GROUP BY
  CASE
    WHEN trim(coalesce(author_email, '')) <> '' THEN 'email:' || lower(trim(author_email))
    ELSE 'name:' || lower(trim(coalesce(author_name, '')))
  END;
