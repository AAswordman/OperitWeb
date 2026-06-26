const fs = require('fs');
let code = fs.readFileSync('d:/Code/prog/assistance_web/workers/market/src/build.ts', 'utf8');

// 1. t0 after function decl
code = code.replace(
  'async function fullBuild(store: MarketStore): Promise<{ ok: true; materialized: number }> {',
  'async function fullBuild(store: MarketStore): Promise<{ ok: true; materialized: number }> {\n  const t0 = Date.now();'
);

// 2. log after loadBuildSnapshot
code = code.replace(
  '  const snap = await store.d1.loadBuildSnapshot();',
  '  const snap = await store.d1.loadBuildSnapshot();\n  console.log("[build] loadBuildSnapshot:", Date.now() - t0, "ms");'
);

// 3. t1 before manifest
code = code.replace(
  '  // manifest\n  await r2.writeJson(registry.keyOf("manifest", {}), {',
  '  const t1 = Date.now();\n  // manifest\n  await r2.writeJson(registry.keyOf("manifest", {}), {'
);

// 4. log after manifest count++
code = code.replace(
  '  count++;\n\n  // publisher shards',
  '  count++;\n  console.log("[build] manifest:", Date.now() - t1, "ms");\n\n  // publisher shards'
);

// 5. t2 + counters before publisher loop
code = code.replace(
  '  for (const [shard, entries] of shards) {\n    if (entries.length === 0) continue;',
  '  const t2 = Date.now(); let pubW = 0, pubS = 0;\n  for (const [shard, entries] of shards) {\n    if (entries.length === 0) { pubS++; continue; }'
);

// 6. pubW++ after publisher write
code = code.replace(
  '    });\n    count++;\n  }',
  '    });\n    pubW++; count++;\n  }'
);

// 7. log after publisher + t3 before entry
code = code.replace(
  '  count += await buildAllEntryShards(snap, r2, registry);',
  '  console.log("[build] publisherShards:", Date.now() - t2, "ms", "w=" + pubW, "sk=" + pubS);\n  const t3 = Date.now();\n  count += await buildAllEntryShards(snap, r2, registry);\n  console.log("[build] entryShards:", Date.now() - t3, "ms");'
);

// 8. t4 before list pages
code = code.replace(
  '  // list pages (updated, likes, featured)\n  count += await buildAllListPages(snap, r2, registry);',
  '  // list pages (updated, likes, featured)\n  const t4 = Date.now();\n  count += await buildAllListPages(snap, r2, registry);\n  console.log("[build] listPages:", Date.now() - t4, "ms");'
);

// 9. total log before return
code = code.replace(
  '  return { ok: true, materialized: count };',
  '  console.log("[build] TOTAL:", Date.now() - t0, "ms", "objects=" + count);\n  return { ok: true, materialized: count };'
);

fs.writeFileSync('d:/Code/prog/assistance_web/workers/market/src/build.ts', code, 'utf8');
console.log('Timing instrumentation added to build.ts');
