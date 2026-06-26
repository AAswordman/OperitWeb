import { handleAuthGithub } from './auth.js';
import { createBuildRoutes, fullBuildIfNeeded, incrementalBuild } from './build.js';
import { createEntryRoutes } from './entry.js';
import { createInteractRoutes } from './interact.js';
import { MarketError, corsHeaders, fail, jsonResponse } from './shared.js';
import { createStaticRoutes } from './static.js';
import { createV1Routes } from './old.js';
import { createMarketStore } from './store/MarketStore.js';
import type { JsonObject, MarketEnv } from './types.js';

interface ScheduledControllerLike {}
interface ExecutionContextLike {}

const v1 = createV1Routes();

function ensureStore(env: MarketEnv): MarketEnv {
  if (!env.store) {
    // Map CF binding names to the property names expected by MarketStore/downstream
    if (!env.db && (env as Record<string, unknown>).OPERIT_MARKET_DB) {
      env.db = (env as Record<string, unknown>).OPERIT_MARKET_DB as MarketEnv['db'];
    }
    env.store = createMarketStore(env);
  }
  return env;
}

export default {
  async fetch(request: Request, env: MarketEnv): Promise<Response> {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname.startsWith('/market/v2/')) {
        const result = await routeV2(pathname, request, env);
        const response = result instanceof Response ? result : jsonResponse(result);
        for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
        return response;
      }

      const result = await v1.handleFetch(request, env);
      const response = result instanceof Response ? result : jsonResponse(result as unknown as JsonObject);
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
      return response;
    } catch (error) {
      const err = error instanceof MarketError ? error : new MarketError('server_error', error instanceof Error ? error.message : 'Unknown error', 500);
      const response = fail(err.code, err.message, err.status);
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
      return response;
    }
  },

  async scheduled(_controller: ScheduledControllerLike, env: MarketEnv, _ctx: ExecutionContextLike): Promise<void> {
    const storeEnv = ensureStore(env);
    await fullBuildIfNeeded(storeEnv);
    await incrementalBuild(storeEnv);
    await v1.handleScheduled(env);
  },
};

async function routeV2(pathname: string, request: Request, env: MarketEnv): Promise<Response | JsonObject> {
  const entries = createEntryRoutes();
  const interact = createInteractRoutes();
  const build = createBuildRoutes();
  const statics = createStaticRoutes();
  const storeEnv = ensureStore(env);

  if (pathname === '/market/v2/auth/github' && request.method === 'POST') return handleAuthGithub(request, env) as Promise<JsonObject>;
  if (pathname === '/market/v2/publish' && request.method === 'POST') return entries.publish(request, storeEnv);
  if (pathname === '/market/v2/publish/proof' && request.method === 'POST') return entries.publishProof(request, storeEnv);
  if (pathname.includes('/entries/') && pathname.includes('/versions') && request.method === 'POST') return entries.newVersion(request, storeEnv);
  if (pathname.includes('/entries/') && pathname.endsWith('/resubmit') && request.method === 'POST') return entries.resubmitEntry(request, storeEnv);
  if (pathname.includes('/versions/') && pathname.endsWith('/resubmit') && request.method === 'POST') return entries.resubmitVersion(request, storeEnv);
  if (pathname.includes('/entries/') && pathname.endsWith('/review/approve') && request.method === 'POST') return entries.reviewApprove(request, storeEnv);
  if (pathname.includes('/entries/') && pathname.endsWith('/review/reject') && request.method === 'POST') return entries.reviewReject(request, storeEnv);
  if (pathname.includes('/entries/') && pathname.endsWith('/review/changes') && request.method === 'POST') return entries.reviewRequestChanges(request, storeEnv);
  if (pathname.includes('/entries/') && pathname.endsWith('/curation') && request.method === 'POST') return entries.curationSet(request, storeEnv);
  if (pathname === '/market/v2/my/entries' && request.method === 'GET') return entries.myEntries(request, storeEnv);
  if (pathname.startsWith('/market/v2/my/entries/') && request.method === 'GET') return entries.myEntryDetail(request, storeEnv);
  if (pathname.includes('/entries/') && request.method === 'PATCH') return entries.updateEntry(request, storeEnv);
  if (pathname.includes('/entries/') && request.method === 'DELETE') return entries.deleteEntry(request, storeEnv);
  if (pathname.includes('/versions/') && request.method === 'DELETE') return entries.deleteVersion(request, storeEnv);
  if (pathname.includes('/comments') && request.method === 'POST') return interact.addComment(request, storeEnv);
  if (pathname.includes('/comments/') && request.method === 'PATCH') return interact.editComment(request, storeEnv);
  if (pathname.includes('/comments/') && request.method === 'DELETE') return interact.deleteComment(request, storeEnv);
  if (pathname.includes('/reactions') && request.method === 'POST') return interact.reactToEntry(request, storeEnv);
  if (pathname.includes('/assets/') && pathname.endsWith('/download')) return interact.downloadAsset(request, storeEnv);
  if (pathname === '/market/v2/notifications' && request.method === 'GET') return interact.listNotifications(request, storeEnv);
  if (pathname === '/market/v2/build' && request.method === 'POST') return build.buildR2(storeEnv);
  if (pathname === '/market/v2/admin/v1-rebuild' && request.method === 'POST') {
    await v1.handleScheduled(env);
    return { ok: true, message: 'v1 R2 regeneration triggered' };
  }
  if (request.method === 'GET') return statics.handleStaticJson(pathname, storeEnv);
  throw new MarketError('not_found', 'Not found', 404);
}
