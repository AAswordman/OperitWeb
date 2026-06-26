const fs = require("fs");
const path = require("path");
const file = "d:/Code/prog/assistance_web/workers/market/src/build.ts";
let code = fs.readFileSync(file, "utf8");

// 1. After "async function fullBuild" line, add t0
code = code.replace(
  "async function fullBuild(store: MarketStore): Promise<{ ok: true; materialized: number }> {",
  "async function fullBuild(store: MarketStore): Promise<{ ok: true; materialized: number }> {\n  const t0 = Date.now();"
);

// 2. After "const snap = await store.d1.loadBuildSnapshot();" add log
code = code.replace(
  "const snap = await store.d1.loadBuildSnapshot();",
  "const snap = await store.d1.loadBuildSnapshot();\n  console.log('[build] loadBuildSnapshot:', Date.now() - t0, 'ms');"
);

// 3. Before manifest write, add t1
code = code.replace(
  "  // manifest\n  await r2.writeJson(registry.keyOf(\"manifest\", {}), {",
  "  const t1 = Date.now();\n  // manifest\n  await r2.writeJson(registry.keyOf(\"manifest\", {}), {"
);

// 4. After manifest count++ add log
code = code.replace(
  "  count++;\n\n  // publisher shards",
  "  count++;\n  console.log('[build] manifest:', Date.now() - t1, 'ms');\n\n  // publisher shards"
);

// 5. Before publisher shards for loop, add t2 + counters
code = code.replace(
  "  for (const [shard, entries] of shards) {\n    if (entries.length === 0) continue;",
  "  const t2 = Date.now();\n  let pubWritten = 0, pubSkipped = 0;\n  for (const [shard, entries] of shards) {\n    if (entries.length === 0) { pubSkipped++; continue; }"
);

// 6. After await r2.writeJson in publisher loop, add pubWritten++
code = code.replace(
  "    await r2.writeJson(key, {\n      ok: true, marketVersion: 2, generatedAt: isoNow(), shard,\n      entries,\n    });\n    count++;",
  "    await r2.writeJson(key, {\n      ok: true, marketVersion: 2, generatedAt: isoNow(), shard,\n      entries,\n    });\n    pubWritten++;\n    count++;"
);

// 7. After publisher loop, add log
code = code.replace(
  "  count += await buildAllEntryShards(snap, r2, registry);",
  "  console.log('[build] publisherShards:', Date.now() - t2, 'ms', 'w=' + pubWritten, 'sk=' + pubSkipped);\n\n  const t3 = Date.now();\n  count += await buildAllEntryShards(snap, r2, registry);\n  console.log('[build] entryShards:', Date.now() - t3, 'ms');"
);

// 8. Before list pages, add t4
code = code.replace(
  "  // list pages (updated, likes, featured)\n  count += await buildAllListPages(snap, r2, registry);",
  "  // list pages (updated, likes, featured)\n  const t4 = Date.now();\n  count += await buildAllListPages(snap, r2, registry);\n  console.log('[build] listPages:', Date.now() - t4, 'ms');"
);

// 9. Before return, add total log
code = code.replace(
  "  return { ok: true, materialized: count };",
  "  console.log('[build] TOTAL:', Date.now() - t0, 'ms', 'objects=' + count);\n  return { ok: true, materialized: count };"
);

fs.writeFileSync(file, code, "utf8");
console.log("Timing instrumentation added");
