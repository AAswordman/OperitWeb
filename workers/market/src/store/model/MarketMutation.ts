import { MarketError, isoNow } from '../../shared.js';
import type { MarketActor, MarketMutation, MarketObjectChange, MarketObjectOperation, NormalizedMarketMutation, ObjectRegistry, ProjectionRegistry } from '../../types.js';

const OPERATIONS = new Set<MarketObjectOperation>([
  'create', 'update', 'hide', 'withdraw', 'approve', 'reject', 'request_changes', 'aggregate',
]);

export function validateMutation(input: MarketMutation, objectRegistry: ObjectRegistry, projectionRegistry: ProjectionRegistry): NormalizedMarketMutation {
  if (!input || typeof input !== 'object') throw new MarketError('validation_failed', 'mutation is required');
  if (input.type !== 'mutation') throw new MarketError('validation_failed', 'mutation.type must be mutation');
  const id = requireText(input.id, 'mutation.id');
  const actor = validateActor(input.actor);
  const reason = requireText(input.reason, 'mutation.reason');
  const createdAt = input.createdAt || isoNow();
  if (!input.objects.length) throw new MarketError('validation_failed', 'mutation.objects is empty');
  for (const object of input.objects) validateObjectChange(object, objectRegistry);
  for (const effect of input.effects) projectionRegistry.assertAllowed(effect.projection, effect.scope);
  return { ...input, id, actor, reason, createdAt };
}

function validateActor(input: MarketActor): MarketActor {
  if (!input || typeof input !== 'object') throw new MarketError('validation_failed', 'mutation.actor is required');
  return { authorId: requireText(input.authorId, 'mutation.actor.authorId'), role: requireText(input.role, 'mutation.actor.role') };
}

function validateObjectChange(change: MarketObjectChange, objectRegistry: ObjectRegistry): void {
  if (!change || typeof change !== 'object') throw new MarketError('validation_failed', 'mutation object change is required');
  const kind = requireText(change.kind, 'object.kind');
  const operation = requireText(change.operation, 'object.operation') as MarketObjectOperation;
  if (!OPERATIONS.has(operation)) throw new MarketError('validation_failed', `Invalid object operation: ${operation}`);
  requireText(change.id, 'object.id');
  objectRegistry.assertAllowed(kind, operation, change.value || {}, change.patch || {});
}

function requireText(value: unknown, field: string): string {
  const text = String(value || '').trim();
  if (!text) throw new MarketError('validation_failed', `${field} is required`);
  return text;
}
