import { isoNow } from "../.././shared.js";
import type { RendererContext, Row } from "../.././types.js";
import { rowText } from "./row.js";
import { scopeHash } from "../registry/ProjectionRegistry.js"; function shardOf(authorId: string): string { return scopeHash(authorId).substring(0, 2); }

export async function renderPrivateAuthorEntries({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const authorId = projectionPlan.scope.authorId || "";
  const shard = shardOf(authorId);
  const key = projectionRegistry.keyOf("private.publisherShard", { shard });
  const owned = await d1.listPublisherEntries(authorId);
  const contributed = await d1.listVersionPublisherEntries(authorId);
  const entries = mergeAuthorEntries(authorId, owned, contributed);
  const current = await r2.readJson(key);
  const authors = current && typeof current === "object" && !Array.isArray(current) && current.authors && typeof current.authors === "object" && !Array.isArray(current.authors)
    ? { ...(current.authors as Record<string, unknown>) }
    : {};
  authors[authorId] = { entries: entries.map(({ entry, relation }) => toPublisherEntrySummary(entry, relation)) };
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

function mergeAuthorEntries(authorId: string, owned: Row[], contributed: Row[]): { entry: Row; relation: "owner" | "contributor" }[] {
  const byId = new Map<string, { entry: Row; relation: "owner" | "contributor" }>();
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

function toPublisherEntrySummary(entry: Row, relation: "owner" | "contributor"): Record<string, string> {
  return {
    id: rowText(entry, "id"),
    title: rowText(entry, "title"),
    type: rowText(entry, "type"),
    relation,
    stateCode: rowText(entry, "state_code"),
    categoryId: rowText(entry, "category_id"),
    updatedAt: rowText(entry, "updated_at"),
  };
}
