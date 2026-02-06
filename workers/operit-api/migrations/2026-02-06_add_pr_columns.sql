ALTER TABLE submissions ADD COLUMN pr_number INTEGER;
ALTER TABLE submissions ADD COLUMN pr_url TEXT;
ALTER TABLE submissions ADD COLUMN pr_branch TEXT;
ALTER TABLE submissions ADD COLUMN pr_state TEXT;
ALTER TABLE submissions ADD COLUMN pr_created_at TEXT;
ALTER TABLE submissions ADD COLUMN pr_error TEXT;
