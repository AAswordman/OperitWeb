import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileSqlite, FileR2, rows } from './helpers.js';
import { createMarketStore } from '../dist/store/MarketStore.js';
import { incrementalBuild } from '../dist/build.js';
import worker from '../dist/index.js';

async function fixture() {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
  const now = '2026-11-08T00:00:00.000Z';
  db.sqlite.run('INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['gh_1', 1, 'alice', '', 'active', now, now]);
  db.sqlite.run('INSERT INTO market_entries (id, type, title, description, author_id, publisher_id, category_id, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ['entry', 'package', 'Example', 'Description', 'gh_1', 'gh_1', 'dev_code', 'approved', now, now, now]);
  db.sqlite.run('INSERT INTO market_versions (id, entry_id, version, format_ver, min_app_ver, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ['entry-v1', 'entry', '1.0.0', 'toolpkg', '1.0.0', 'approved', now, now, now]);
  return {db,r2,store};
}

test('entry category change dirties all sorts for old and new filtered scopes', async () => {
  const {db,r2,store}=await fixture();
  try {
    await store.apply({type:'mutation',id:'move',actor:{authorId:'gh_1',role:'publisher'},reason:'entry.updated',createdAt:'2026-11-08T01:00:00.000Z',objects:[{kind:'Entry',operation:'update',id:'entry',patch:{categoryId:'system_data',updatedAt:'2026-11-08T01:00:00.000Z'}}],effects:[{projection:'entry.shard',scope:{entryId:'entry'}},{projection:'list.page',scope:{list:{},sort:'updated',page:1}}]});
    const dirty=rows(db,"SELECT scope_key FROM market_dirty_projections WHERE projection='list.page'").map(x=>x.scope_key);
    for(const list of [{},{type:'package'},{categoryId:'dev_code'},{type:'package',categoryId:'dev_code'},{categoryId:'system_data'},{type:'package',categoryId:'system_data'}]) for(const sort of ['updated','likes','downloads']) {
      assert.ok(dirty.includes(store.projectionRegistry.scopeKeyOf({list,sort,page:1})),JSON.stringify({list,sort}));
    }
    for(let i=0;i<20 && rows(db,'SELECT COUNT(*) AS n FROM market_dirty_projections')[0].n;i++) await incrementalBuild({store});
    assert.equal(rows(db,'SELECT COUNT(*) AS n FROM market_dirty_projections')[0].n,0);
    for(const [key,total] of [['market/v2/lists/type/package/category/dev_code/updated/page-1.json',0],['market/v2/lists/type/package/category/system_data/updated/page-1.json',1],['market/v2/lists/type/package/likes/page-1.json',1]]) {
      assert.equal(JSON.parse(readFileSync(join(r2.dir,key),'utf8')).total,total,key);
    }
  } finally {r2.destroy();db.destroy();}
});

test('admin can rebuild one filtered list and unauthenticated requests are denied', async () => {
  const {db,r2,store}=await fixture();
  try {
    const env={store,OPERIT_OWNER_TOKEN:'local-test-admin'};
    const request=token=>new Request('https://example.test/market/v2/admin/rebuild-list',{method:'POST',headers:{'content-type':'application/json',...(token?{'x-operit-admin-token':token}:{})},body:JSON.stringify({list:{type:'package',categoryId:'dev_code'},sort:'updated'})});
    assert.equal((await worker.fetch(request(''),env,{})).status,401);
    const response=await worker.fetch(request('local-test-admin'),env,{});
    assert.equal(response.status,200);
    assert.equal((await response.json()).materialized,1);
    assert.equal(JSON.parse(readFileSync(join(r2.dir,'market/v2/lists/type/package/category/dev_code/updated/page-1.json'),'utf8')).items[0].id,'entry');
    const invalid=new Request('https://example.test/market/v2/admin/rebuild-list',{method:'POST',headers:{'content-type':'application/json','x-operit-admin-token':'local-test-admin'},body:JSON.stringify({list:{type:'../../bad'},sort:'updated'})});
    assert.equal((await worker.fetch(invalid,env,{})).status,400);
  } finally {r2.destroy();db.destroy();}
});

test('a list dirtied again during a build stays queued', async () => {
  const {db,r2,store}=await fixture();
  try {
    const key=store.projectionRegistry.scopeKeyOf({list:{type:'package'},sort:'updated',page:1});
    await store.d1.upsertDirty('list.page',key,'first','first','2026-11-08T01:00:00.000Z');
    const write=store.r2.writeJson.bind(store.r2);
    let injected=false;
    store.r2.writeJson=async (...args)=>{
      if(!injected){injected=true;await store.d1.upsertDirty('list.page',key,'second','second','2026-11-08T02:00:00.000Z');}
      return write(...args);
    };
    await incrementalBuild({store});
    assert.equal(rows(db,"SELECT last_mutation_id FROM market_dirty_projections WHERE projection='list.page' AND scope_key=?",[key])[0].last_mutation_id,'second');
    await incrementalBuild({store});
    assert.equal(rows(db,"SELECT COUNT(*) AS n FROM market_dirty_projections WHERE projection='list.page' AND scope_key=?",[key])[0].n,0);
  } finally {r2.destroy();db.destroy();}
});

test('five-minute schedule only processes incremental projections', async () => {
  const {db,r2,store}=await fixture();
  try {
    const key=store.projectionRegistry.scopeKeyOf({list:{type:'package'},sort:'updated',page:1});
    await store.d1.upsertDirty('list.page',key,'test','scheduled','2026-11-08T01:00:00.000Z');
    await worker.scheduled({cron:'*/5 * * * *',scheduledTime:Date.parse('2026-11-08T00:05:00Z')}, {store,MARKET_STATS_BUCKET:r2}, {});
    const log=JSON.parse(readFileSync(join(r2.dir,'market/v2/debug/cron/latest.json'),'utf8'));
    assert.deepEqual(log.steps.map(step=>step.name),['incrementalBuild']);
    assert.equal(rows(db,'SELECT COUNT(*) AS n FROM market_dirty_projections')[0].n,0);
    assert.equal(JSON.parse(readFileSync(join(r2.dir,'market/v2/lists/type/package/updated/page-1.json'),'utf8')).total,1);
  } finally {r2.destroy();db.destroy();}
});

test('concurrent projection builds are rejected and the lock is released', async () => {
  const {db,r2,store}=await fixture();
  try {
    const key=store.projectionRegistry.scopeKeyOf({list:{type:'package'},sort:'updated',page:1});
    await store.d1.upsertDirty('list.page',key,'test','first','2026-11-08T01:00:00.000Z');
    const write=store.r2.writeJson.bind(store.r2);
    let proceed, started;
    const pending=new Promise(resolve=>{proceed=resolve;});
    const entered=new Promise(resolve=>{started=resolve;});
    store.r2.writeJson=async (...args)=>{started();await pending;return write(...args);};
    const first=incrementalBuild({store});
    await entered;
    await assert.rejects(incrementalBuild({store}), /Another projection build/);
    proceed();
    await first;
    await incrementalBuild({store});
  } finally {r2.destroy();db.destroy();}
});
