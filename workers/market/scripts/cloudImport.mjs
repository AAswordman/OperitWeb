// @ts-check
const { readFileSync } = require("node:fs");

const TOKEN = "EIGhvwpxpdqIP7quNui0ZWTMNlYvb6jCBSYOHSm1";
const ACCOUNT_ID = "c667bf70582c5ceceda8d3d183ad8e3b";
const DB_ID = "9ae3cbdc-de89-402f-81ff-6482ef0cca73";
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;

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

async function main() {
  const path = require("node:path");
  const filePath = path.join(__dirname, "..", "migration-output", "import_batch.sql");
  const content = readFileSync(filePath, "utf-8");

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

  console.log(`Found ${sections.length} sections\n`);

  for (const { table, sql } of sections) {
    if (!sql.includes("INSERT ")) continue;

    const sizeKb = (Buffer.byteLength(sql, "utf-8") / 1024).toFixed(0);
    process.stdout.write(`Importing ${table} (${sizeKb} KB)... `);

    try {
      const r = await d1Query(sql);
      if (r.success) {
        const meta = r.result?.[0]?.meta;
        console.log(`OK (rows_read=${meta?.rows_read ?? "?"})`);
      } else {
        const errMsg = r.errors?.[0]?.message ?? JSON.stringify(r.errors).slice(0, 200);
        console.log(`FAILED: ${errMsg}`);
      }
    } catch (e) {
      console.log(`ERROR: ${e.message?.slice(0, 120) ?? e}`);
    }
  }

  console.log("\nVerifying...");
  const r = await d1Query(
    "SELECT 'entries' as tbl, COUNT(*) as cnt FROM market_entries UNION ALL SELECT 'authors', COUNT(*) FROM market_authors UNION ALL SELECT 'versions', COUNT(*) FROM market_versions UNION ALL SELECT 'assets', COUNT(*) FROM market_assets"
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
