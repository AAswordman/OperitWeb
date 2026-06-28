import { isoNow } from "../.././shared.js";
import type { RendererContext, Row } from "../.././types.js";
import { rowText } from "./row.js";
import { scopeHash } from "../registry/ProjectionRegistry.js"; function shardOf(authorId: string): string { return scopeHash(authorId).substring(0, 2); }

export async function renderPrivateAuthorEntries({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const authorId = projectionPlan.scope.authorId || "";
  const shard = shardOf(authorId);
  const key = projectionRegistry.keyOf("private.publisherShard", { shard });
  const entries = await d1.listPublisherEntries(authorId);
  const current = await r2.readJson(key);
  const authors = current && typeof current === "object" && !Array.isArray(current) && current.authors && typeof current.authors === "object" && !Array.isArray(current.authors)
    ? { ...(current.authors as Record<string, unknown>) }
    : {};
  authors[authorId] = { entries: entries.map(toPublisherEntrySummary) };
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), shard, authors });
  return { written: [key] };
}

export async function renderPrivateAuthorEntry({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const authorId = projectionPlan.scope.authorId || "";
  const entryId = projectionPlan.scope.entryId || "";
  const key = projectionRegistry.keyOf("private.publisherEntry", { authorId, entryId });
  const entry = await d1.getEntry(entryId);
  if (!entry || rowText(entry, "publisher_id") !== authorId) return { written: [] };
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), entryId, versions: await d1.listVersionsForEntry(entryId) });
  return { written: [key] };
}

function toPublisherEntrySummary(entry: Row): Record<string, string> {
  return {
    id: rowText(entry, "id"),
    title: rowText(entry, "title"),
    type: rowText(entry, "type"),
    stateCode: rowText(entry, "state_code"),
    categoryId: rowText(entry, "category_id"),
    updatedAt: rowText(entry, "updated_at"),
  };
}
