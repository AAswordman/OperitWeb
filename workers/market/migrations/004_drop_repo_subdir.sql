UPDATE repo_plugin_specs
SET source_url = source_url || '/tree/' || (
  SELECT rpv.ref_name
  FROM repo_plugin_versions rpv
  JOIN market_versions mv ON mv.id = rpv.version_id
  WHERE mv.entry_id = repo_plugin_specs.entry_id
    AND COALESCE(TRIM(rpv.subdir), '') <> ''
  ORDER BY COALESCE(mv.published_at, mv.updated_at, mv.created_at) DESC
  LIMIT 1
) || '/' || (
  SELECT TRIM(rpv.subdir, '/')
  FROM repo_plugin_versions rpv
  JOIN market_versions mv ON mv.id = rpv.version_id
  WHERE mv.entry_id = repo_plugin_specs.entry_id
    AND COALESCE(TRIM(rpv.subdir), '') <> ''
  ORDER BY COALESCE(mv.published_at, mv.updated_at, mv.created_at) DESC
  LIMIT 1
)
WHERE source_url NOT LIKE '%/tree/%'
  AND source_url NOT LIKE '%/blob/%'
  AND source_url NOT LIKE 'https://raw.githubusercontent.com/%'
  AND EXISTS (
    SELECT 1
    FROM repo_plugin_versions rpv
    JOIN market_versions mv ON mv.id = rpv.version_id
    WHERE mv.entry_id = repo_plugin_specs.entry_id
      AND COALESCE(TRIM(rpv.subdir), '') <> ''
  );

ALTER TABLE repo_plugin_versions DROP COLUMN subdir;
