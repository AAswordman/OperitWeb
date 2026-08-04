import { isoNow } from "../.././shared.js";
import type { RendererContext, Row } from "../.././types.js";
import { rowText } from "./row.js";
import { scopeHash } from "../registry/ProjectionRegistry.js"; function shardOf(authorId: string): string { return scopeHash(authorId).substring(0, 2); }

type PublisherRelation = "owner" | "contributor";

type PublisherEntrySummary = {
  id: string;
  title: string;
  type: string;
  relation: PublisherRelation;
  stateCode: string;
  categoryId: string;
  updatedAt: string;
  reasonCodes?: string[];
  reviewDetail?: string;
  reviewDetailUpdatedAt?: string;
};

export async function renderPrivateAuthorEntries({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const authorId = projectionPlan.scope.authorId || "";
  const shard = shardOf(authorId);
  const key = projectionRegistry.keyOf("private.publisherShard", { shard });
  const current = await r2.readJson(key);
  const authors = current && typeof current === "object" && !Array.isArray(current) && current.authors && typeof current.authors === "object" && !Array.isArray(current.authors)
    ? { ...(current.authors as Record<string, unknown>) }
    : {};
  const entryId = projectionPlan.scope.entryId;

  if (entryId) {
    // Entry mutations carry their ID so a publish cannot scan every historical entry for this author.
    authors[authorId] = { entries: await updateAuthorEntrySummary(d1, authorId, entryId, readAuthorEntries(authors[authorId])) };
    await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), shard, authors });
    return { written: [key] };
  }

  const owned = await d1.listPublisherEntries(authorId);
  const contributed = await d1.listVersionPublisherEntries(authorId);
  const entries = mergeAuthorEntries(authorId, owned, contributed);
  const summaries: PublisherEntrySummary[] = [];
  for (const { entry, relation } of entries) {
    const summary = await buildAuthorEntrySummary(d1, authorId, entry, relation);
    if (summary) summaries.push(summary);
  }
  authors[authorId] = { entries: summaries };
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), shard, authors });
  return { written: [key] };
}

async function updateAuthorEntrySummary(d1: RendererContext['d1'], authorId: string, entryId: string, current: PublisherEntrySummary[]): Promise<PublisherEntrySummary[]> {
  const entries = current.filter((entry) => entry.id !== entryId);
  const entry = await d1.getEntry(entryId);
  if (entry) {
    const relation: PublisherRelation = rowText(entry, 'publisher_id') === authorId ? 'owner' : 'contributor';
    const summary = await buildAuthorEntrySummary(d1, authorId, entry, relation);
    if (summary) entries.push(summary);
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function buildAuthorEntrySummary(d1: RendererContext['d1'], authorId: string, entry: Row, relation: PublisherRelation): Promise<PublisherEntrySummary | undefined> {
  const versions = await d1.listAuthorEntryVersions(authorId, rowText(entry, 'id'));
  if (relation === 'contributor' && versions.length === 0) return undefined;
  const latestVersion = versions[0];
  const reasonCodes = latestVersion
    ? (await d1.listVersionReasons(rowText(latestVersion, 'id'))).map((reason) => rowText(reason, 'reason_code')).filter(Boolean)
    : [];
  const reviewDetail = latestVersion ? await d1.getVersionReviewDetail(rowText(latestVersion, 'id')) : null;
  return toPublisherEntrySummary(entry, relation, latestVersion, reasonCodes, reviewDetail);
}

function readAuthorEntries(value: unknown): PublisherEntrySummary[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const entries = (value as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) return [];
  return entries.filter(isPublisherEntrySummary);
}

function isPublisherEntrySummary(value: unknown): value is PublisherEntrySummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && typeof entry.title === 'string'
    && typeof entry.type === 'string'
    && (entry.relation === 'owner' || entry.relation === 'contributor')
    && typeof entry.stateCode === 'string'
    && typeof entry.categoryId === 'string'
    && typeof entry.updatedAt === 'string';
}

function mergeAuthorEntries(authorId: string, owned: Row[], contributed: Row[]): { entry: Row; relation: PublisherRelation }[] {
  const byId = new Map<string, { entry: Row; relation: PublisherRelation }>();
  for (const entry of owned) {
    const entryId = rowText(entry, "id");
    if (entryId) byId.set(entryId, { entry, relation: "owner" });
  }
  for (const entry of contributed) {
    const entryId = rowText(entry, "id");
    if (!entryId || byId.has(entryId)) continue;
    byId.set(entryId, {
      entry,
      relation: rowText(entry, "publisher_id") === authorId ? "owner" : "contributor",
    });
  }
  return Array.from(byId.values()).sort((a, b) => rowText(b.entry, "updated_at").localeCompare(rowText(a.entry, "updated_at")));
}

function toPublisherEntrySummary(entry: Row, relation: PublisherRelation, latestVersion: Row | undefined, reasonCodes: string[], reviewDetail: Row | null): PublisherEntrySummary {
  const entryStateCode = rowText(entry, "state_code");
  const stateCode = entryStateCode === "withdrawn"
    ? entryStateCode
    : latestVersion ? rowText(latestVersion, "state_code") : entryStateCode;
  const updatedAt = entryStateCode === "withdrawn"
    ? rowText(entry, "updated_at")
    : latestVersion ? rowText(latestVersion, "updated_at") : rowText(entry, "updated_at");
  const summary: PublisherEntrySummary = {
    id: rowText(entry, "id"),
    title: rowText(entry, "title"),
    type: rowText(entry, "type"),
    relation,
    stateCode,
    categoryId: rowText(entry, "category_id"),
    updatedAt,
  };
  if (reasonCodes.length > 0) summary.reasonCodes = reasonCodes;
  if (reviewDetail && rowText(reviewDetail, 'detail')) {
    summary.reviewDetail = rowText(reviewDetail, 'detail');
    summary.reviewDetailUpdatedAt = rowText(reviewDetail, 'updated_at');
  }
  return summary;
}
