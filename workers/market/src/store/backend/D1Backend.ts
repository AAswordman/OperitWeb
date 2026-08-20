import { MarketError } from '../../shared.js';
import type { D1Backend, D1DatabaseLike, Row, SqlParam } from '../../types.js';

export function createD1Backend(db: D1DatabaseLike): D1Backend {
  if (!db) throw new MarketError('server_error', 'D1 database is not configured', 500);
  const stats = { reads: 0, writes: 0 };

  // D1 billing counts rows scanned, not returned. In production meta.rows_read comes
  // from CF. For local sql.js we approximate: full scan = returned rows, WHERE = rows.
  function readRows<T extends Row>(sql: string, rows: T[]): T[] {
    const upper = sql.toUpperCase();
    if (upper.includes('COUNT(')) { stats.reads += 1; }
    else if (upper.includes('JOIN')) { stats.reads += Math.max(rows.length, 1) * 2; }
    else { stats.reads += Math.max(rows.length, 1); }
    return rows;
  }
  function readRow<T extends Row>(sql: string, row: T | null): T | null {
    stats.reads += row ? 1 : 1; // still scans one index lookup even if not found
    return row;
  }

  function normalizeListScopes(scopes: Array<{ type?: string; categoryId?: string }>): Array<{ type?: string; categoryId?: string }> {
    const seen = new Set<string>();
    const result: Array<{ type?: string; categoryId?: string }> = [];
    for (const scope of scopes) {
      const normalized = {
        ...(scope.type ? { type: String(scope.type) } : {}),
        ...(scope.categoryId ? { categoryId: String(scope.categoryId) } : {}),
      };
      const key = JSON.stringify(normalized, Object.keys(normalized).sort());
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(normalized);
      if (!normalized.type && !normalized.categoryId) return [{}];
    }
    return result;
  }

  function publicListScopeWhere(scopes: Array<{ type?: string; categoryId?: string }>, params: SqlParam[]): string {
    const normalized = normalizeListScopes(scopes);
    if (normalized.length === 0 || normalized.some((scope) => !scope.type && !scope.categoryId)) return '';
    const clauses: string[] = [];
    for (const scope of normalized) {
      const parts: string[] = [];
      if (scope.type) {
        parts.push('e.type = ?');
        params.push(scope.type);
      }
      if (scope.categoryId) {
        parts.push('e.category_id = ?');
        params.push(scope.categoryId);
      }
      if (parts.length > 0) clauses.push(`(${parts.join(' AND ')})`);
    }
    return clauses.length > 0 ? ` AND (${clauses.join(' OR ')})` : '';
  }

  function compactStrings(values: unknown[]): string[] {
    return [...new Set(values.map((value) => String(value || '')).filter(Boolean))];
  }

  async function readRowsByIds(
    sqlBeforeIn: string,
    ids: string[],
    sqlAfterIn = '',
    beforeParams: SqlParam[] = [],
  ): Promise<Row[]> {
    const uniqueIds = compactStrings(ids);
    if (uniqueIds.length === 0) return [];
    const rows: Row[] = [];
    const chunkSize = 90;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const sql = `${sqlBeforeIn} (${placeholders}) ${sqlAfterIn}`;
      rows.push(...readRows(sql, await all(db, sql, [...beforeParams, ...chunk])));
    }
    return rows;
  }

  return {
    stats,

    async createComment(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_comments (id, entry_id, parent_id, author_id, body, source, legacy_issue, legacy_comment, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.entryId, value.parentId ?? null, value.authorId, value.body,
        value.source || 'cf', null, null, value.status || 'active', value.createdAt, value.updatedAt,
      ]);
    },
    async updateComment(id, patch) {
      stats.writes++;
      return run(db, 'UPDATE market_comments SET body = COALESCE(?, body), status = COALESCE(?, status), updated_at = ? WHERE id = ?', [
        patch.body ?? null, patch.status ?? null, patch.updatedAt, id,
      ]);
    },
    async updateAuthor(id, patch) {
      stats.writes++;
      return run(db, `UPDATE market_authors SET
          status = COALESCE(?, status),
          blocked_reason_code = COALESCE(?, blocked_reason_code),
          blocked_at = COALESCE(?, blocked_at),
          blocked_by = COALESCE(?, blocked_by),
          updated_at = ?
        WHERE id = ?`, [
        patch.status ?? null,
        patch.blockedReasonCode ?? null,
        patch.blockedAt ?? null,
        patch.blockedBy ?? null,
        patch.updatedAt,
        id,
      ]);
    },
    async createEntry(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_entries (id, type, title, description, detail, author_id, publisher_id, allow_public_updates, category_id, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.type, value.title, value.description, value.detail || '', value.authorId, value.publisherId,
        boolParam(value.allowPublicUpdates, true), value.categoryId || null, value.stateCode || 'pending', value.createdAt, value.updatedAt, value.publishedAt || null,
      ]);
    },
    async updateEntry(id, patch) {
      stats.writes++;
      await run(db, `UPDATE market_entries SET title = COALESCE(?, title), description = COALESCE(?, description), detail = COALESCE(?, detail), category_id = COALESCE(?, category_id), allow_public_updates = COALESCE(?, allow_public_updates), state_code = COALESCE(?, state_code), published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ?`, [
        patch.title ?? null, patch.description ?? null, patch.detail ?? null, patch.categoryId ?? null,
        patch.allowPublicUpdates === undefined ? null : boolParam(patch.allowPublicUpdates, true),
        patch.stateCode ?? null, patch.publishedAt ?? null, patch.updatedAt, id,
      ]);
    },
    async createVersion(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_versions (id, entry_id, version, format_ver, publisher_id, min_app_ver, max_app_ver, state_code, changelog, entry_patch, created_at, updated_at, published_at, runtime_pkg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.entryId, value.version, value.formatVer, value.publisherId || null, value.minAppVer, value.maxAppVer || null,
        value.stateCode || 'pending', value.changelog || null, value.entryPatch || null, value.createdAt, value.updatedAt, value.publishedAt || null, value.runtimePkg || value.runtimePackageId || null,
      ]);
    },
    async updateVersion(id, patch) {
      stats.writes++;
      await run(db, `UPDATE market_versions SET state_code = COALESCE(?, state_code), min_app_ver = COALESCE(?, min_app_ver), max_app_ver = COALESCE(?, max_app_ver), entry_patch = COALESCE(?, entry_patch), published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ?`, [
        patch.stateCode ?? null, patch.minAppVer ?? null, patch.maxAppVer ?? null, patch.entryPatch ?? null, patch.publishedAt ?? null, patch.updatedAt, id,
      ]);
    },
    async createRepoSource(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO repo_plugin_specs (id, entry_id, source_kind, source_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        value.id, value.entryId, 'github_repo', value.sourceUrl, value.createdAt, value.updatedAt,
      ]);
    },
    async createRepoVersion(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO repo_plugin_versions (id, version_id, ref_type, ref_name, commit_sha, install_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.versionId, value.refType, value.refName, value.commitSha,
        value.installConfig || null, value.createdAt, value.updatedAt,
      ]);
    },
    async updateRepoSource(id, patch) {
      stats.writes++;
      return run(db, 'UPDATE repo_plugin_specs SET updated_at = ? WHERE id = ?', [patch.updatedAt, id]);
    },
    async createReviewReason(value) {
      stats.writes++;
      if (!value.versionId) throw new MarketError('validation_failed', 'Review reason requires versionId');
      return run(db, 'INSERT OR IGNORE INTO market_version_reasons (version_id, reason_code, created_at) VALUES (?, ?, ?)', [value.versionId, value.reasonCode, value.createdAt]);
    },
    async upsertReviewDetail(value) {
      stats.writes++;
      if (!value.versionId) throw new MarketError('validation_failed', 'Review detail requires versionId');
      return run(db, `INSERT INTO market_version_review_details (version_id, detail, reviewer_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(version_id) DO UPDATE SET detail = excluded.detail, reviewer_id = excluded.reviewer_id, updated_at = excluded.updated_at`, [
        value.versionId, value.detail, value.reviewerId, value.createdAt, value.updatedAt,
      ]);
    },
    async createCuration(value) {
      stats.writes++;
      return run(db, 'INSERT OR REPLACE INTO market_curations (id, list_key, entry_id, position, note, starts_at, ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.listKey, value.entryId, value.position || 0, value.note || null,
        value.startsAt || null, value.endsAt || null, value.createdAt, value.updatedAt,
      ]);
    },
    async hideCuration(id, _patch) {
      stats.writes++;
      return run(db, 'DELETE FROM market_curations WHERE id = ?', [id]);
    },
    async aggregateReaction(value) {
      stats.writes++;
      return run(db, 'INSERT OR REPLACE INTO market_reaction_counts (id, entry_id, reaction, gh_count, cf_count, total_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.entryId, value.reaction, value.ghCount || 0, value.cfCount || 0,
        value.totalCount ?? (Number(value.ghCount || 0) + Number(value.cfCount || 0)), value.updatedAt,
      ]);
    },
    async upsertEntryStats(value) {
      stats.writes++;
      const legacyDownloads = numberParam(value.legacyDownloads);
      const legacyLikes = numberParam(value.legacyLikes);
      const cfDownloads = numberParam(value.cfDownloads);
      const cfLikes = numberParam(value.cfLikes);
      return run(db, `
        INSERT INTO market_entry_stats (
          entry_id, type, legacy_downloads, legacy_likes, cf_downloads, cf_likes,
          downloads_total, likes_total, last_download_at, last_like_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entry_id) DO UPDATE SET
          type = excluded.type,
          legacy_downloads = excluded.legacy_downloads,
          legacy_likes = excluded.legacy_likes,
          cf_downloads = excluded.cf_downloads,
          cf_likes = excluded.cf_likes,
          downloads_total = excluded.downloads_total,
          likes_total = excluded.likes_total,
          last_download_at = excluded.last_download_at,
          last_like_at = excluded.last_like_at,
          updated_at = excluded.updated_at
      `, [
        value.entryId, value.type, legacyDownloads, legacyLikes, cfDownloads, cfLikes,
        legacyDownloads + cfDownloads, legacyLikes + cfLikes,
        value.lastDownloadAt ?? null, value.lastLikeAt ?? null, value.updatedAt,
      ]);
    },
    async incrementEntryStats(value) {
      stats.writes++;
      const downloadDelta = numberParam(value.downloadDelta);
      const likeDelta = numberParam(value.likeDelta);
      return run(db, `
        INSERT INTO market_entry_stats (
          entry_id, type, legacy_downloads, legacy_likes, cf_downloads, cf_likes,
          downloads_total, likes_total, last_download_at, last_like_at, updated_at
        ) VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entry_id) DO UPDATE SET
          type = excluded.type,
          cf_downloads = market_entry_stats.cf_downloads + excluded.cf_downloads,
          cf_likes = market_entry_stats.cf_likes + excluded.cf_likes,
          downloads_total = market_entry_stats.legacy_downloads + market_entry_stats.cf_downloads + excluded.cf_downloads,
          likes_total = market_entry_stats.legacy_likes + market_entry_stats.cf_likes + excluded.cf_likes,
          last_download_at = CASE
            WHEN excluded.last_download_at IS NOT NULL
             AND (market_entry_stats.last_download_at IS NULL OR excluded.last_download_at > market_entry_stats.last_download_at)
            THEN excluded.last_download_at ELSE market_entry_stats.last_download_at END,
          last_like_at = CASE
            WHEN excluded.last_like_at IS NOT NULL
             AND (market_entry_stats.last_like_at IS NULL OR excluded.last_like_at > market_entry_stats.last_like_at)
            THEN excluded.last_like_at ELSE market_entry_stats.last_like_at END,
          updated_at = excluded.updated_at
      `, [
        value.entryId, value.type, downloadDelta, likeDelta, downloadDelta, likeDelta,
        value.lastDownloadAt ?? null, value.lastLikeAt ?? null, value.updatedAt,
      ]);
    },
    async recordAnalyticsAggregateWindow(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_analytics_aggregate_windows (id, window_start, window_end, downloads, likes, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        value.id, value.windowStart, value.windowEnd, numberParam(value.downloads), numberParam(value.likes), value.createdAt,
      ]);
    },
    async createAsset(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_assets (id, version_id, kind, url, gh_owner, gh_repo, gh_release_tag, sha256, asset_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.versionId, value.kind, value.url, value.ghOwner, value.ghRepo, value.ghReleaseTag, value.sha256, value.assetName || value.name || null, value.createdAt,
      ]);
    },
    async createArtifactProject(value) {
      stats.writes++;
      return run(db, 'INSERT INTO artifact_projects (id, entry_id, project_key, runtime_pkg, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        value.id, value.entryId, value.projectKey, value.runtimePkg || null, value.createdAt, value.updatedAt,
      ]);
    },

    // --- Read methods ---

    async getEntry(entryId) {
      const sql = 'SELECT * FROM market_entries WHERE id = ?';
      return readRow(sql, await first(db, sql, [entryId]));
    },
    async getAuthor(authorId) {
      const sql = 'SELECT id, github_id, github_login, owner_avatar, status, blocked_reason_code, blocked_at, blocked_by FROM market_authors WHERE id = ?';
      return readRow(sql, await first(db, sql, [authorId]));
    },
    async getComment(commentId) {
      const sql = 'SELECT * FROM market_comments WHERE id = ?';
      return readRow(sql, await first(db, sql, [commentId]));
    },
    async getRepoSpecByEntry(entryId) {
      const sql = 'SELECT * FROM repo_plugin_specs WHERE entry_id = ?';
      return readRow(sql, await first(db, sql, [entryId]));
    },
    async getRepoVersion(versionId) {
      const sql = 'SELECT * FROM repo_plugin_versions WHERE version_id = ?';
      return readRow(sql, await first(db, sql, [versionId]));
    },
    async getCategories() {
      const sql = 'SELECT * FROM market_categories ORDER BY sort_order';
      return readRows(sql, await all(db, sql, []));
    },
    async getTypes() {
      const sql = 'SELECT * FROM market_types ORDER BY sort_order';
      return readRows(sql, await all(db, sql, []));
    },
    async getFormatVersions() {
      const sql = 'SELECT * FROM market_format_versions ORDER BY sort_order';
      return readRows(sql, await all(db, sql, []));
    },
    async getStateCodes() {
      const sql = 'SELECT * FROM market_state_codes ORDER BY sort_order';
      return readRows(sql, await all(db, sql, []));
    },
    async listVersionReasons(versionId) {
      const sql = 'SELECT reason_code FROM market_version_reasons WHERE version_id = ? ORDER BY reason_code';
      return readRows(sql, await all(db, sql, [versionId]));
    },
    async getVersionReviewDetail(versionId) {
      const sql = 'SELECT version_id, detail, reviewer_id, created_at, updated_at FROM market_version_review_details WHERE version_id = ?';
      return readRow(sql, await first(db, sql, [versionId]));
    },
    async listVersionReviewDetails(versionIds) {
      return readRowsByIds('SELECT version_id, detail, reviewer_id, created_at, updated_at FROM market_version_review_details WHERE version_id IN', versionIds);
    },
    async listAuthorEntryVersions(authorId, entryId) {
      const sql = 'SELECT * FROM market_versions WHERE publisher_id = ? AND entry_id = ? ORDER BY updated_at DESC, created_at DESC';
      return readRows(sql, await all(db, sql, [authorId, entryId]));
    },
    async listPublisherEntries(publisherId) {
      const sql = 'SELECT * FROM market_entries WHERE publisher_id = ? ORDER BY updated_at DESC';
      return readRows(sql, await all(db, sql, [publisherId]));
    },
    async listVersionPublisherEntries(publisherId) {
      const sql = 'SELECT DISTINCT e.* FROM market_entries e JOIN market_versions v ON v.entry_id = e.id WHERE v.publisher_id = ? ORDER BY e.updated_at DESC';
      return readRows(sql, await all(db, sql, [publisherId]));
    },
    async listShardPublisherEntries(shard) {
      const sql = 'SELECT * FROM market_entries WHERE lower(substr(publisher_id,1,2)) = ? ORDER BY updated_at DESC';
      return readRows(sql, await all(db, sql, [shard]));
    },
    async listReviewVersions(stateCode, limit, offset) {
      const pageSize = Math.max(1, Math.min(Number(limit) || 50, 100));
      const start = Math.max(0, Number(offset) || 0);
      const base = `SELECT
          e.id, e.type, e.title, e.description, e.detail, e.author_id, e.publisher_id, e.allow_public_updates,
          e.category_id, e.state_code, e.created_at, e.updated_at, e.published_at,
          v.id AS version_id, v.version, v.format_ver, v.publisher_id AS version_publisher_id,
          v.min_app_ver, v.max_app_ver, v.runtime_pkg, v.state_code AS version_state_code,
          v.changelog, v.entry_patch, v.created_at AS version_created_at, v.updated_at AS version_updated_at,
          v.published_at AS version_published_at,
          a.github_login AS author_login, a.owner_avatar AS author_avatar,
          p.github_login AS publisher_login, p.owner_avatar AS publisher_avatar,
          vp.github_login AS version_publisher_login, vp.owner_avatar AS version_publisher_avatar
        FROM market_versions v
        JOIN market_entries e ON e.id = v.entry_id
        LEFT JOIN market_authors a ON a.id = e.author_id
        LEFT JOIN market_authors p ON p.id = e.publisher_id
        LEFT JOIN market_authors vp ON vp.id = v.publisher_id`;
      if (stateCode) {
        const sql = `${base} WHERE v.state_code = ? ORDER BY v.updated_at DESC, v.id DESC LIMIT ? OFFSET ?`;
        return readRows(sql, await all(db, sql, [stateCode, pageSize, start]));
      }
      const sql = `${base} WHERE v.state_code NOT IN ('approved','withdrawn') ORDER BY v.updated_at DESC, v.id DESC LIMIT ? OFFSET ?`;
      return readRows(sql, await all(db, sql, [pageSize, start]));
    },
    async listAllEntries() {
      const sql = 'SELECT * FROM market_entries ORDER BY updated_at DESC';
      return readRows(sql, await all(db, sql, []));
    },
    async listVersionsForEntry(entryId) {
      const sql = 'SELECT * FROM market_versions WHERE entry_id = ?';
      return readRows(sql, await all(db, sql, [entryId]));
    },
    async listVersionsForArtifactProjectKey(projectKey) {
      const sql = 'SELECT v.* FROM market_versions v JOIN artifact_projects p ON p.entry_id = v.entry_id WHERE p.project_key = ?';
      return readRows(sql, await all(db, sql, [projectKey]));
    },
    async getArtifactProject(entryId) {
      const sql = 'SELECT * FROM artifact_projects WHERE entry_id = ?';
      return readRow(sql, await first(db, sql, [entryId]));
    },
    async listAssets(entryId) {
      const sql = 'SELECT a.* FROM market_assets a JOIN market_versions v ON v.id = a.version_id WHERE v.entry_id = ?';
      return readRows(sql, await all(db, sql, [entryId]));
    },
    async getAssetWithEntry(assetId) {
      const sql = 'SELECT a.*, v.entry_id, v.state_code AS version_state_code, e.type, e.state_code AS entry_state_code FROM market_assets a JOIN market_versions v ON v.id = a.version_id JOIN market_entries e ON e.id = v.entry_id WHERE a.id = ?';
      return readRow(sql, await first(db, sql, [assetId]));
    },
    async getReactionCounts(entryId) {
      const sql = 'SELECT * FROM market_reaction_counts WHERE entry_id = ?';
      return readRows(sql, await all(db, sql, [entryId]));
    },
    async getEntryStats(entryId) {
      const sql = 'SELECT * FROM market_entry_stats WHERE entry_id = ?';
      return readRow(sql, await first(db, sql, [entryId]));
    },
    async listCurations(listKey) {
      const sql = 'SELECT * FROM market_curations WHERE list_key = ? ORDER BY position ASC';
      return readRows(sql, await all(db, sql, [listKey]));
    },
    async listActiveComments(entryId, page, pageSize) {
      const offset = (Number(page) - 1) * pageSize;
      const sql = 'SELECT c.*, a.github_id, a.github_login, a.owner_avatar, a.status AS author_status FROM market_comments c JOIN market_authors a ON a.id = c.author_id WHERE c.entry_id = ? AND c.status = ? ORDER BY c.created_at ASC LIMIT ? OFFSET ?';
      return readRows(sql, await all(db, sql, [entryId, 'active', pageSize, offset]));
    },
    async countActiveComments(entryId) {
      const sql = 'SELECT COUNT(*) AS count FROM market_comments WHERE entry_id = ? AND status = ?';
      const row = await first(db, sql, [entryId, 'active']);
      stats.reads += 1; // COUNT scan
      return Number(row?.count || 0);
    },
    async countActiveCommentsBefore(entryId, createdAt, commentId) {
      const sql = "SELECT COUNT(*) AS count FROM market_comments WHERE entry_id = ? AND status = ? AND (created_at < ? OR (created_at = ? AND id < ?))";
      const row = await first(db, sql, [entryId, 'active', createdAt, createdAt, commentId]);
      stats.reads += 1;
      return Number(row?.count || 0);
    },

    async writeMutationLog(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_mutation_log (id, mutation_id, actor_id, actor_role, reason, object_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        `${value.mutationId}-log`, value.mutationId, value.actorId, value.actorRole, value.reason, value.objectCount ?? 0, value.createdAt,
      ]);
    },

    async upsertDirty(projection, scopeKey, reason, mutationId, updatedAt) {
      stats.writes++;
      return run(db, 'INSERT OR REPLACE INTO market_dirty_projections (projection, scope_key, reason, last_mutation_id, updated_at) VALUES (?, ?, ?, ?, ?)', [
        projection, scopeKey, reason, mutationId, updatedAt,
      ]);
    },

    async deleteDirty(projection, scopeKey) {
      stats.writes++;
      return run(db, 'DELETE FROM market_dirty_projections WHERE projection = ? AND scope_key = ?', [projection, scopeKey]);
    },

    async listDirty(limit) {
      const sql = 'SELECT * FROM market_dirty_projections ORDER BY updated_at ASC LIMIT ?';
      const rows = await all(db, sql, [limit]);
      stats.reads += Math.max(rows.length, 1);
      return rows;
    },

    async listPublicListScopes() {
      const sql = `SELECT DISTINCT e.type, e.category_id
        FROM market_entries e
        WHERE e.state_code = ?
          AND EXISTS (SELECT 1 FROM market_versions v WHERE v.entry_id = e.id AND v.state_code = ?)`;
      const rows = readRows(sql, await all(db, sql, ['approved', 'approved']));
      const scopes: Array<{ type?: string; categoryId?: string }> = [{}];
      const types = new Set<string>();
      const categories = new Set<string>();
      const typeCategories = new Set<string>();
      for (const row of rows) {
        const type = String(row.type || '');
        const categoryId = String(row.category_id || '');
        if (type) types.add(type);
        if (categoryId) categories.add(categoryId);
        if (type && categoryId) typeCategories.add(`${type}\u0000${categoryId}`);
      }
      for (const type of [...types].sort()) scopes.push({ type });
      for (const categoryId of [...categories].sort()) scopes.push({ categoryId });
      for (const pair of [...typeCategories].sort()) {
        const [type, categoryId] = pair.split('\u0000');
        if (type && categoryId) scopes.push({ type, categoryId });
      }
      return scopes;
    },

    async loadListBuildSnapshot(lists) {
      const params: SqlParam[] = ['approved', 'approved'];
      const scopeWhere = publicListScopeWhere(lists, params);
      const entriesSql = `SELECT DISTINCT e.*
        FROM market_entries e
        WHERE e.state_code = ?
          AND EXISTS (SELECT 1 FROM market_versions v WHERE v.entry_id = e.id AND v.state_code = ?)
          ${scopeWhere}
        ORDER BY e.updated_at DESC`;
      const entries = readRows(entriesSql, await all(db, entriesSql, params));
      const entryIds = compactStrings(entries.map((entry) => entry.id));
      const versions = await readRowsByIds(
        'SELECT * FROM market_versions WHERE state_code = ? AND entry_id IN',
        entryIds,
        'ORDER BY published_at DESC',
        ['approved'],
      );
      const versionIds = compactStrings(versions.map((version) => version.id));
      const repos = await readRowsByIds('SELECT * FROM repo_plugin_specs WHERE entry_id IN', entryIds);
      const repoVersions = await readRowsByIds('SELECT * FROM repo_plugin_versions WHERE version_id IN', versionIds);
      const artifactProjects = await readRowsByIds('SELECT * FROM artifact_projects WHERE entry_id IN', entryIds);
      const assets = await readRowsByIds(
        'SELECT a.* FROM market_assets a JOIN market_versions v ON v.id = a.version_id WHERE v.state_code = ? AND v.entry_id IN',
        entryIds,
        '',
        ['approved'],
      );
      const reactions = await readRowsByIds('SELECT * FROM market_reaction_counts WHERE entry_id IN', entryIds);
      const entryStats = await readRowsByIds('SELECT * FROM market_entry_stats WHERE entry_id IN', entryIds);
      const curations = await readRowsByIds(
        'SELECT * FROM market_curations WHERE list_key = ? AND entry_id IN',
        entryIds,
        'ORDER BY position ASC',
        ['featured'],
      );
      const authorIds = compactStrings([
        ...entries.map((entry) => entry.author_id),
        ...entries.map((entry) => entry.publisher_id),
        ...versions.map((version) => version.publisher_id),
      ]);
      const authors = await readRowsByIds('SELECT id, github_id, github_login, owner_avatar FROM market_authors WHERE id IN', authorIds);
      return {
        entries,
        versions,
        repos,
        repoVersions,
        artifactProjects,
        assets,
        reactions,
        entryStats,
        categories: [],
        types: [],
        formatVersions: [],
        stateCodes: [],
        versionReasons: [],
        versionReviewDetails: [],
        curations,
        authors,
      };
    },

    // ---- Notifications ----

    async createNotification(value) {
      stats.writes++;
      return run(db, 'INSERT OR IGNORE INTO market_notifications (id, recipient, kind, entry_id, comment_id, actor_id, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        value.id, value.recipient, value.kind, value.entryId ?? null, value.commentId ?? null,
        value.actorId, value.title, value.body ?? '', value.createdAt,
      ]);
    },

    async listNotifications(recipient, limit, offset, since) {
      const sql = since
        ? 'SELECT id, kind, entry_id, comment_id, actor_id, title, body, created_at FROM market_notifications WHERE recipient = ? AND created_at > ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        : 'SELECT id, kind, entry_id, comment_id, actor_id, title, body, created_at FROM market_notifications WHERE recipient = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const params: SqlParam[] = since ? [recipient, since, limit, offset] : [recipient, limit, offset];
      return readRows(sql, await all(db, sql, params));
    },

    // ---- Bulk load for full R2 rebuild ----

    async getMeta(key: string): Promise<{ value: string; updated_at: string } | undefined> {
      const rows = await all(db, 'SELECT value, updated_at FROM market_meta WHERE key = ?', [key]);
      if (!rows.length) return undefined;
      return rows[0] as unknown as { value: string; updated_at: string };
    },
    async setMeta(key: string, value: string): Promise<void> {
      const now = new Date().toISOString();
      await db.prepare('INSERT OR REPLACE INTO market_meta (key, value, updated_at) VALUES (?, ?, ?)').bind(key, value, now).run();
    },
    async loadBuildSnapshot() {
      const [entries, versions, repos, repoVersions, artifactProjects, assets, reactions, entryStats,
        categories, types, formatVersions, stateCodes, versionReasons, versionReviewDetails, curations, authors] = await Promise.all([
        all(db, 'SELECT * FROM market_entries', []),
        all(db, 'SELECT * FROM market_versions', []),
        all(db, 'SELECT * FROM repo_plugin_specs', []),
        all(db, 'SELECT * FROM repo_plugin_versions', []),
        all(db, 'SELECT * FROM artifact_projects', []),
        all(db, 'SELECT a.* FROM market_assets a JOIN market_versions v ON v.id = a.version_id', []),
        all(db, 'SELECT * FROM market_reaction_counts', []),
        all(db, 'SELECT * FROM market_entry_stats', []),
        all(db, 'SELECT * FROM market_categories ORDER BY sort_order', []),
        all(db, 'SELECT * FROM market_types ORDER BY sort_order', []),
        all(db, 'SELECT * FROM market_format_versions ORDER BY sort_order', []),
        all(db, 'SELECT * FROM market_state_codes ORDER BY sort_order', []),
        all(db, 'SELECT * FROM market_version_reasons', []),
        all(db, 'SELECT * FROM market_version_review_details', []),
        all(db, 'SELECT * FROM market_curations', []),
        all(db, 'SELECT id, github_id, github_login, owner_avatar FROM market_authors', []),
      ]);
      const totalReads = entries.length + versions.length + repos.length + repoVersions.length + artifactProjects.length + assets.length + reactions.length + entryStats.length + categories.length + types.length + formatVersions.length + stateCodes.length + versionReasons.length + versionReviewDetails.length + curations.length + authors.length;
      stats.reads += totalReads;
      return { entries, versions, repos, repoVersions, artifactProjects, assets, reactions, entryStats, categories, types, formatVersions, stateCodes, versionReasons, versionReviewDetails, curations, authors };
    },
  };
}

function numberParam(value: unknown): number {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function boolParam(value: unknown, defaultValue = false): number {
  if (value === undefined || value === null) return defaultValue ? 1 : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' && (value === 0 || value === 1)) return value;
  throw new MarketError('validation_failed', 'Boolean fields must be boolean or 0/1');
}

async function run(db: D1DatabaseLike, sql: string, params: SqlParam[]): Promise<unknown> {
  if (typeof db.prepare === 'function') return db.prepare(sql).bind(...params).run();
  throw new MarketError('server_error', 'D1 backend requires prepare()', 500);
}
async function first<T extends Row = Row>(db: D1DatabaseLike, sql: string, params: SqlParam[]): Promise<T | null> {
  if (typeof db.prepare === 'function') return await db.prepare(sql).bind(...params).first<T>();
  throw new MarketError('server_error', 'D1 backend requires prepare()', 500);
}
async function all<T extends Row = Row>(db: D1DatabaseLike, sql: string, params: SqlParam[]): Promise<T[]> {
  if (typeof db.prepare !== 'function') throw new MarketError('server_error', 'D1 backend requires prepare()', 500);
  const result = await db.prepare(sql).bind(...params).all<T>();
  return Array.isArray(result) ? result : (result.results ?? []);
}
