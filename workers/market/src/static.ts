import { MarketError } from './shared.js';
import type { MarketEnv } from './types.js';

export function createStaticRoutes(): { handleStaticJson(pathname: string, env: MarketEnv): Promise<Response> } {
  return { handleStaticJson };
}

async function handleStaticJson(pathname: string, env: MarketEnv): Promise<Response> {
  const key = pathname.replace(/^\/market\/v2\//, 'market/v2/');
  const bucket = env.MARKET_STATS_BUCKET ?? env.r2;
  if (!bucket) throw new MarketError('server_error', 'R2 bucket is not configured', 500);
  const obj = await bucket.get(key);
  if (!obj) throw new MarketError('not_found', 'Static object not found', 404);
  return new Response(await obj.text(), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}
