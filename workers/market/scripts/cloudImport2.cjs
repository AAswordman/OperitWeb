const { readFileSync } = require("node:fs");
const path = require("node:path");

const TOKEN = "EIGhvwpxpdqIP7quNui0ZWTMNlYvb6jCBSYOHSm1";
const ACCOUNT_ID = "c667bf70582c5ceceda8d3d183ad8e3b";
const DB_ID = "9ae3cbdc-de89-402f-81ff-6482ef0cca73";
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;
const MAX_CHUNK_SIZE = 90000;

async function d1Query(sql) {
  const body = JSON.stringify({ sql });
  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(60000),
  });
  return resp.json();
}

function splitIntoSqlChunks(sql, maxBytes) {
  const lines = sql.split("\n");
  let chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  for (const line of lines) {
    const lineSize = Buffer.byteLength(line + "\n", "utf-8");
    if (currentSize + lineSize > maxBytes && currentChunk.length > 0 && line.startsWith("INSERT ")) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(line);
    currentSize += lineSize;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join("\n"));
  return chunks;
}

async function main() {
  const filePath = path.join(__dirname, "..", "migration-output", "import_batch.sql");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Extract artifact_projects + artifact_nodes sections
  let tables = {};
  let currentTable = "";
  let currentLines = [];
  for (const line of lines) {
    if (line.startsWith("-- ") && !line.startsWith("-- Operit") && !line.startsWith("-- Generated")) {
      if (currentLines.length > 0 && currentTable) {
        tables[currentTable] = currentLines.join("\n");
        currentLines = [];
      }
      currentTable = line.slice(3).trim();
    }
    currentLines.push(line);
  }
  if (currentLines.length > 0 && currentTable) tables[currentTable] = currentLines.join("\n");

  const toImport = ["artifact_projects", "artifact_nodes"];
  for (const tbl of toImport) {
    const sql = tables[tbl];
    if (!sql) { console.log(`${tbl}: NOT FOUND`); continue; }
    const prfx = "PRAGMA defer_foreign_keys = 1;\n";
    const chunks = splitIntoSqlChunks(prfx + sql, MAX_CHUNK_SIZE);
    process.stdout.write(`${tbl}: ${chunks.length} chunks `);
    let ok = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const r = await d1Query(chunks[i]);
        if (r.success) { ok++; process.stdout.write("."); }
        else {
          const errMsg = r.errors?.[0]?.message?.slice(0, 120) ?? "?";
          process.stdout.write(`\n  chunk ${i}: ${errMsg}`);
        }
      } catch (e) {
        process.stdout.write(`\n  chunk ${i}: ${e.message?.slice(0, 80)}`);
      }
    }
    console.log(`  ${ok}/${chunks.length} OK`);
  }

  console.log("\nFinal verify:");
  const r = await d1Query(
    "SELECT 'artifact_projects' as tbl, COUNT(*) as cnt FROM artifact_projects UNION ALL SELECT 'artifact_nodes', COUNT(*) FROM artifact_nodes UNION ALL SELECT 'repo_plugin_specs', COUNT(*) FROM repo_plugin_specs UNION ALL SELECT 'repo_plugin_versions', COUNT(*) FROM repo_plugin_versions"
  );
  if (r.success) {
    for (const row of r.result.flatMap((r) => r.results)) {
      console.log(`  ${row.tbl}: ${row.cnt}`);
    }
  } else {
    console.log(r.errors);
  }
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
