import { isoNow } from "../.././shared.js";
import type { RendererContext } from "../.././types.js";
import { rowText } from "./row.js";
import { scopeHash } from "../registry/ProjectionRegistry.js"; function shardOf(authorId: string): string { return scopeHash(authorId).substring(0, 2); }

export async function renderPrivateAuthorEntries({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const authorId = projectionPlan.scope.authorId || "";
  const shard = shardOf(authorId);
  const key = projectionRegistry.keyOf("private.publisherShard", { shard });
  const entries = await d1.listShardPublisherEntries(shard);
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), shard, entries: entries.map((e) => ({ id: rowText(e, "id"), title: rowText(e, "title"), stateCode: rowText(e, "state_code"), updatedAt: rowText(e, "updated_at") })) });
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