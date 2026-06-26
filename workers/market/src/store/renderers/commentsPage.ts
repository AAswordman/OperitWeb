import { isoNow } from '../../shared.js';
import type { RendererContext, Row } from '../../types.js';

export async function renderCommentsPage({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const { entryId, page } = projectionPlan.scope;
  if (!entryId) throw new Error('entryId is required for comments.page');
  const pageSize = Number(projectionPlan.pageSize ?? 50);
  const pageNum = Number(page ?? 1);
  const comments: Row[] = await d1.listActiveComments(entryId, pageNum, pageSize);
  const total = await d1.countActiveComments(entryId);
  const key = projectionRegistry.keyOf('comments.page', { entryId, page: pageNum });
  await r2.writeJson(key, {
    ok: true,
    marketVersion: 2,
    entryId,
    page: Number(page),
    pageSize,
    total,
    items: comments.map((c: Row) => ({
      id: c.id,
      entryId: c.entry_id,
      parentId: c.parent_id ?? null,
      author: {
        id: c.author_id,
        githubId: c.github_id,
        login: c.github_login,
        avatar: c.owner_avatar,
        status: c.author_status,
      },
      body: c.body,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
    generatedAt: isoNow(),
  });
  return { written: [key] };
}


