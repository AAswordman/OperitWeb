-- Operit Market v2 D1 schema
-- Core tables + aggregated statistics baseline

-- 5.2.1 market_meta
CREATE TABLE IF NOT EXISTS market_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 5.2.2 market_types
CREATE TABLE IF NOT EXISTS market_types (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 5.2.3 market_format_versions
CREATE TABLE IF NOT EXISTS market_format_versions (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL,
  name               TEXT NOT NULL,
  description        TEXT,
  publishable        INTEGER NOT NULL DEFAULT 1,
  legacy_importable  INTEGER NOT NULL DEFAULT 0,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  FOREIGN KEY(type) REFERENCES market_types(slug)
);
CREATE INDEX IF NOT EXISTS idx_fv_type ON market_format_versions(type, sort_order);

-- 5.2.4 market_state_codes
CREATE TABLE IF NOT EXISTS market_state_codes (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  public_listed INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- 5.2.5 market_reason_codes
CREATE TABLE IF NOT EXISTS market_reason_codes (
  code              TEXT PRIMARY KEY,
  scope             TEXT NOT NULL DEFAULT 'review',
  legacy_label      TEXT UNIQUE,
  default_state_code TEXT,
  name              TEXT NOT NULL,
  description       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

-- 5.2.6 market_authors
CREATE TABLE IF NOT EXISTS market_authors (
  id                  TEXT PRIMARY KEY,
  github_id           INTEGER NOT NULL UNIQUE,
  github_login        TEXT NOT NULL,
  owner_avatar        TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  blocked_reason_code TEXT,
  blocked_at          TEXT,
  blocked_by          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY(blocked_reason_code) REFERENCES market_reason_codes(code)
);
CREATE INDEX IF NOT EXISTS idx_authors_status ON market_authors(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_authors_login ON market_authors(github_login);

-- 5.2.8 market_entries
CREATE TABLE IF NOT EXISTS market_entries (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  detail          TEXT NOT NULL DEFAULT '',
  author_id       TEXT NOT NULL,
  publisher_id    TEXT NOT NULL,
  category_id     TEXT,
  state_code      TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_at    TEXT,
  FOREIGN KEY(type) REFERENCES market_types(slug),
  FOREIGN KEY(author_id) REFERENCES market_authors(id),
  FOREIGN KEY(publisher_id) REFERENCES market_authors(id),
  FOREIGN KEY(category_id) REFERENCES market_categories(id),
  FOREIGN KEY(state_code) REFERENCES market_state_codes(code)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_type_id ON market_entries(type, id);
CREATE INDEX IF NOT EXISTS idx_entries_public ON market_entries(type, state_code, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_author ON market_entries(author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_publisher ON market_entries(publisher_id, updated_at DESC);

-- 5.2.9 market_versions
CREATE TABLE IF NOT EXISTS market_versions (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL,
  version         TEXT NOT NULL,
  format_ver      TEXT NOT NULL,
  min_app_ver     TEXT NOT NULL,
  max_app_ver     TEXT,
  state_code      TEXT NOT NULL DEFAULT 'pending',
  changelog       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_at    TEXT,
  runtime_pkg     TEXT,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id) ON DELETE CASCADE,
  FOREIGN KEY(format_ver) REFERENCES market_format_versions(id),
  FOREIGN KEY(state_code) REFERENCES market_state_codes(code),
  UNIQUE(entry_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_entry ON market_versions(entry_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_public ON market_versions(entry_id, state_code, published_at DESC);

-- 5.2.10 market_version_reasons
CREATE TABLE IF NOT EXISTS market_version_reasons (
  version_id  TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY(version_id, reason_code),
  FOREIGN KEY(version_id) REFERENCES market_versions(id) ON DELETE CASCADE,
  FOREIGN KEY(reason_code) REFERENCES market_reason_codes(code)
);

-- 5.2.11 artifact_projects
CREATE TABLE IF NOT EXISTS artifact_projects (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL UNIQUE,
  project_key     TEXT NOT NULL,
  runtime_pkg     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_project_key ON artifact_projects(project_key);

-- 5.2.12 artifact nodes removed: artifact install versions are represented by market_versions + market_assets.

-- 5.2.14 repo_plugin_specs
CREATE TABLE IF NOT EXISTS repo_plugin_specs (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL UNIQUE,
  source_kind     TEXT NOT NULL,
  source_url      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repo_plugin_source ON repo_plugin_specs(source_url);

-- 5.2.15 repo_plugin_versions
CREATE TABLE IF NOT EXISTS repo_plugin_versions (
  id              TEXT PRIMARY KEY,
  version_id      TEXT NOT NULL UNIQUE,
  ref_type        TEXT NOT NULL,
  ref_name        TEXT NOT NULL,
  commit_sha      TEXT NOT NULL,
  subdir          TEXT,
  manifest_path   TEXT,
  install_config  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(version_id) REFERENCES market_versions(id) ON DELETE CASCADE
);

-- 5.2.16 market_assets
CREATE TABLE IF NOT EXISTS market_assets (
  id              TEXT PRIMARY KEY,
  version_id      TEXT NOT NULL,
  kind            TEXT NOT NULL,
  url             TEXT NOT NULL,
  gh_owner        TEXT,
  gh_repo         TEXT,
  gh_release_tag  TEXT,
  asset_name      TEXT,
  sha256          TEXT,
  size_bytes      INTEGER,
  content_type    TEXT,
  created_at      TEXT NOT NULL,
  FOREIGN KEY(version_id) REFERENCES market_versions(id) ON DELETE CASCADE
);

-- 5.2.17 market_categories
CREATE TABLE IF NOT EXISTS market_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- 5.2.18 market_curations
CREATE TABLE IF NOT EXISTS market_curations (
  id          TEXT PRIMARY KEY,
  list_key    TEXT NOT NULL,
  entry_id    TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  starts_at   TEXT,
  ends_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_curations_list ON market_curations(list_key, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_curations_unique ON market_curations(list_key, entry_id);

-- 5.2.19 market_comments
CREATE TABLE IF NOT EXISTS market_comments (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL,
  parent_id       TEXT,
  author_id       TEXT NOT NULL,
  body            TEXT NOT NULL,
  source          TEXT NOT NULL,
  legacy_issue    INTEGER,
  legacy_comment  INTEGER,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES market_authors(id)
);

-- 5.2.20 market_reaction_counts
CREATE TABLE IF NOT EXISTS market_reaction_counts (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL,
  reaction      TEXT NOT NULL,
  gh_count      INTEGER NOT NULL DEFAULT 0,
  cf_count      INTEGER NOT NULL DEFAULT 0,
  total_count   INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  UNIQUE(entry_id, reaction)
);

-- 5.2.21 market_entry_stats
-- v1 one-shot baseline + v2 Analytics Engine aggregates.
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

-- 5.2.22 market_analytics_aggregate_windows
-- Records each committed v2 Analytics Engine aggregate window.
CREATE TABLE IF NOT EXISTS market_analytics_aggregate_windows (
  id            TEXT PRIMARY KEY,
  window_start  TEXT NOT NULL,
  window_end    TEXT NOT NULL,
  downloads     INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_windows_end ON market_analytics_aggregate_windows(window_end DESC);

-- ===== Seed Data =====

-- market_meta
INSERT OR IGNORE INTO market_meta (key, value, updated_at) VALUES ('market_version', '2', datetime('now'));

-- market_types (4 entry types)
INSERT OR IGNORE INTO market_types (id, slug, name, description, sort_order, created_at, updated_at) VALUES
  ('script', 'script', 'Script', 'Sandbox script plugin', 0, datetime('now'), datetime('now')),
  ('package', 'package', 'Package', 'ToolPkg plugin', 1, datetime('now'), datetime('now')),
  ('skill', 'skill', 'Skill', 'GitHub repo skill plugin', 2, datetime('now'), datetime('now')),
  ('mcp', 'mcp', 'MCP', 'MCP repo plugin', 3, datetime('now'), datetime('now'));

-- market_format_versions (8 versions: v2 publishable + legacy importable)
INSERT OR IGNORE INTO market_format_versions (id, type, name, description, publishable, legacy_importable, sort_order, created_at, updated_at) VALUES
  ('script_v2', 'script', 'Script v2', 'Script v2 format', 1, 0, 0, datetime('now'), datetime('now')),
  ('toolpkg_v2', 'package', 'ToolPkg v2', 'ToolPkg v2 format', 1, 0, 1, datetime('now'), datetime('now')),
  ('skill_v2', 'skill', 'Skill v2', 'Skill v2 format', 1, 0, 2, datetime('now'), datetime('now')),
  ('mcp_v2', 'mcp', 'MCP v2', 'MCP v2 format', 1, 0, 3, datetime('now'), datetime('now')),
  ('script_legacy_issue_v1', 'script', 'Legacy Script', 'Legacy Script issue format', 0, 1, 4, datetime('now'), datetime('now')),
  ('package_legacy_issue_v1', 'package', 'Legacy Package', 'Legacy Package issue format', 0, 1, 5, datetime('now'), datetime('now')),
  ('skill_legacy_issue_v1', 'skill', 'Legacy Skill', 'Legacy Skill issue format', 0, 1, 6, datetime('now'), datetime('now')),
  ('mcp_legacy_issue_v1', 'mcp', 'Legacy MCP', 'Legacy MCP issue format', 0, 1, 7, datetime('now'), datetime('now'));

-- market_state_codes
INSERT OR IGNORE INTO market_state_codes (code, name, description, public_listed, sort_order) VALUES
  ('pending', 'Pending', 'Awaiting review', 0, 0),
  ('approved', 'Approved', 'Publicly listed', 1, 1),
  ('changes_requested', 'Changes Requested', 'Reviewer requested changes', 0, 2),
  ('rejected', 'Rejected', 'Rejected by reviewer', 0, 3),
  ('withdrawn', 'Withdrawn', 'Withdrawn by publisher', 0, 4);

-- market_reason_codes (review + author_block scopes)
INSERT OR IGNORE INTO market_reason_codes (code, scope, legacy_label, default_state_code, name, description, sort_order) VALUES
  ('metadata-incomplete', 'review', 'reason:metadata-incomplete', 'changes_requested', 'Metadata Incomplete', 'Title, description, or required fields missing', 0),
  ('install-config-invalid', 'review', 'reason:install-config-invalid', 'changes_requested', 'Install Config Invalid', 'Plugin install configuration is malformed or broken', 1),
  ('repository-unreachable', 'review', 'reason:repository-unreachable', 'changes_requested', 'Repository Unreachable', 'GitHub repo is not accessible or does not exist', 2),
  ('repository-content-invalid', 'review', 'reason:repository-content-invalid', 'changes_requested', 'Repository Content Invalid', 'Repo content does not match description or is unusable', 3),
  ('entry-unusable', 'review', 'reason:entry-unusable', 'rejected', 'Entry Unusable', 'Plugin is broken or non-functional', 4),
  ('quality-too-low', 'review', 'reason:quality-too-low', 'rejected', 'Quality Too Low', 'Does not meet quality standards', 5),
  ('ai-hallucination', 'review', 'reason:ai-hallucination', 'rejected', 'AI Hallucination', 'Misleading description or hallucinated feature claims', 6),
  ('security-risk', 'review', 'reason:security-risk', 'rejected', 'Security Risk', 'Contains security vulnerabilities or malicious code', 7),
  ('duplicate-submission', 'review', 'reason:duplicate-submission', 'rejected', 'Duplicate Submission', 'Already exists in the market', 8),
  ('policy-violation', 'review', 'reason:policy-violation', 'rejected', 'Policy Violation', 'Violates market policies', 9),
  ('author-spam', 'author_block', NULL, NULL, 'Author Spam', 'Repeated low-quality or spam submissions', 10),
  ('author-abuse', 'author_block', NULL, NULL, 'Author Abuse', 'Abusive behavior toward reviewers or community', 11),
  ('author-malicious-publish', 'author_block', NULL, NULL, 'Malicious Publishing', 'Deliberate publishing of harmful plugins', 12),
  ('author-policy-violation', 'author_block', NULL, NULL, 'Author Policy Violation', 'Repeated or severe policy violations', 13);

-- market_categories (from operit.app current categories)
INSERT OR IGNORE INTO market_categories (id, name, description, sort_order) VALUES
  ('search_research', 'Search & Research', 'Search engines, research tools, knowledge retrieval', 0),
  ('dev_code', 'Development', 'Code editors, debuggers, development tools', 1),
  ('automation_workflow', 'Automation', 'Task automation, workflow processing', 2),
  ('docs_knowledge', 'Documents & Knowledge', 'Document processing, knowledge management', 3),
  ('media_content', 'Media & Content', 'Image, video, audio processing and content creation', 4),
  ('chat_communication', 'Chat & Communication', 'Chat tools, messaging, communication integration', 5),
  ('integration_api', 'Integrations & APIs', 'Third-party service integration, API tools', 6),
  ('system_data', 'System & Data', 'File system, data management, system tools', 7),
  ('business_productivity', 'Business & Productivity', 'Business workflow, productivity enhancement', 8),
  ('life_entertainment', 'Life & Entertainment', 'Daily life tools, entertainment, fun', 9),
  ('other', 'Other', 'Uncategorized or miscellaneous', 10);

-- ===== v2.1: Mutation log + dirty projections in D1 (reduce R2 Class A) =====

CREATE TABLE IF NOT EXISTS market_mutation_log (
  id             TEXT PRIMARY KEY,
  mutation_id    TEXT NOT NULL,
  actor_id       TEXT NOT NULL,
  actor_role     TEXT NOT NULL,
  reason         TEXT NOT NULL,
  object_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mutation_log_created ON market_mutation_log(created_at DESC);

CREATE TABLE IF NOT EXISTS market_dirty_projections (
  projection     TEXT NOT NULL,
  scope_key      TEXT NOT NULL,   -- hash/stable key of the scope
  reason         TEXT NOT NULL,
  last_mutation_id TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (projection, scope_key)
);

-- ===== v2.2: Notifications =====

CREATE TABLE IF NOT EXISTS market_notifications (
  id          TEXT PRIMARY KEY,
  recipient   TEXT NOT NULL,          -- author_id (gh_xxx)
  kind        TEXT NOT NULL,          -- comment_reply | comment_new | review_approved | review_rejected | review_changes | entry_curated
  entry_id    TEXT,                   -- target entry
  comment_id  TEXT,                   -- target comment (for reply)
  actor_id    TEXT NOT NULL,          -- who triggered
  title       TEXT NOT NULL,          -- short display title (English)
  body        TEXT NOT NULL DEFAULT '',-- longer preview text
  created_at  TEXT NOT NULL,
  FOREIGN KEY(recipient) REFERENCES market_authors(id),
  FOREIGN KEY(entry_id) REFERENCES market_entries(id),
  FOREIGN KEY(comment_id) REFERENCES market_comments(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON market_notifications(recipient, created_at DESC);
