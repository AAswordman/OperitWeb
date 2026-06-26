const { readFileSync } = require("node:fs");
const path = require("node:path");

const TOKEN = "EIGhvwpxpdqIP7quNui0ZWTMNlYvb6jCBSYOHSm1";
const ACCOUNT_ID = "c667bf70582c5ceceda8d3d183ad8e3b";
const DB_ID = "9ae3cbdc-de89-402f-81ff-6482ef0cca73";
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;
const MAX_CHUNK_SIZE = 90000; // bytes, under 100KB limit

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
  // Split by INSERT statements, group into chunks under maxBytes
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
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }
  return chunks;
}

async function main() {
  const filePath = path.join(__dirname, "..", "migration-output", "import_batch.sql");
  const content = readFileSync(filePath, "utf-8");

  // Parse sections by -- table_name comments
  const lines = content.split("\n");
  let sections = [];
  let currentTable = "preamble";
  let currentLines = [];

  for (const line of lines) {
    if (line.startsWith("-- ") && !line.startsWith("-- Operit") && !line.startsWith("-- Generated")) {
      if (currentLines.length > 0) {
        sections.push({ table: currentTable, sql: currentLines.join("\n") });
        currentLines = [];
      }
      currentTable = line.slice(3).trim();
    }
    currentLines.push(line);
  }
  if (currentLines.length > 0) {
    sections.push({ table: currentTable, sql: currentLines.join("\n") });
  }

  // Dependency order
  const tableOrder = [
    "market_authors", "market_entries", "market_entry_reasons",
    "market_versions", "market_version_reasons",
    "artifact_projects", "artifact_nodes",
    "repo_plugin_specs", "repo_plugin_versions",
    "market_assets", "market_curations"
  ];

  // Filter and order sections
  let ordered = [];
  for (const tbl of tableOrder) {
    const sec = sections.find(s => s.table === tbl);
    if (sec) ordered.push(sec);
  }

  console.log(`Found ${ordered.length} table sections to import\n`);

  let totalChunks = 0;
  let okChunks = 0;
  let failChunks = 0;

  for (const { table, sql } of ordered) {
    const prfx = "PRAGMA defer_foreign_keys = 1;\n";
    const chunks = splitIntoSqlChunks(prfx + sql, MAX_CHUNK_SIZE);
    totalChunks += chunks.length;

    process.stdout.write(`${table}: ${chunks.length} chunks `);

    let tableOk = 0;
    for (let i = 0; i < chunks.length; i++) {
      const sizeKb = (Buffer.byteLength(chunks[i], "utf-8") / 1024).toFixed(0);
      try {
        const r = await d1Query(chunks[i]);
        if (r.success) {
          tableOk++;
          okChunks++;
          process.stdout.write(".");
        } else {
          const errMsg = r.errors?.[0]?.message?.slice(0, 80) ?? "?";
          process.stdout.write(`\n  chunk ${i}: ${errMsg}`);
          failChunks++;
        }
      } catch (e) {
        process.stdout.write(`\n  chunk ${i}: ${e.message?.slice(0, 80)}`);
        failChunks++;
      }
    }
    console.log(`  ${tableOk}/${chunks.length} OK`);
  }

  console.log(`\nTotal: ${okChunks}/${totalChunks} OK, ${failChunks} failed`);

  // Verify
  console.log("\nVerifying counts...");
  const r = await d1Query(
    "SELECT 'entries' as tbl, COUNT(*) as cnt FROM market_entries UNION ALL SELECT 'authors', COUNT(*) FROM market_authors UNION ALL SELECT 'versions', COUNT(*) FROM market_versions UNION ALL SELECT 'assets', COUNT(*) FROM market_assets UNION ALL SELECT 'state_codes', COUNT(*) FROM market_state_codes"
  );
  if (r.success) {
    for (const row of r.result.flatMap((r) => r.results)) {
      console.log(`  ${row.tbl}: ${row.cnt}`);
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
