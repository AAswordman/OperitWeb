import { isoNow } from '../shared.js';
import type { MarketMutation } from '../types.js';

interface WithdrawAndBlockAuthorInput {
  entryId: string;
  authorId: string;
  actorId: string;
  reasonCode: string;
  blockedAt?: string;
}

export function withdrawAndBlockAuthor({ entryId, authorId, actorId, reasonCode, blockedAt }: WithdrawAndBlockAuthorInput): MarketMutation {
  const time = blockedAt || isoNow();
  return {
    type: 'mutation',
    id: `mut-moderation-withdraw-block-${entryId}-${authorId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: `moderation.withdraw_and_block:${reasonCode}`,
    createdAt: time,
    objects: [
      {
        kind: 'Entry',
        operation: 'withdraw',
        id: entryId,
        patch: { stateCode: 'withdrawn', updatedAt: time },
      },
      {
        kind: 'Author',
        operation: 'update',
        id: authorId,
        patch: {
          status: 'blocked',
          blockedReasonCode: reasonCode,
          blockedAt: time,
          blockedBy: actorId,
          updatedAt: time,
        },
      },
    ],
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
      { projection: 'private.publisherShard', scope: { authorId } },
    ],
  };
}
