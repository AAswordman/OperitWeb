const { readFileSync } = require("node:fs");
const path = require("node:path");

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

// Parse INSERT with named columns, remove a column
function removeColumn(insertLine, colName) {
  const m = insertLine.match(/^INSERT OR IGNORE INTO (\S+) \(([^)]+)\) VALUES \(([^)]+)\);?\s*$/);
  if (!m) return null;
  const [, table, colsStr, valsStr] = m;
  const cols = colsStr.split(",").map(c => c.trim());
  const vals = valsStr.split(",").map(v => v.trim());
  const idx = cols.indexOf(colName);
  if (idx === -1) return insertLine; // already gone
  cols.splice(idx, 1);
  vals.splice(idx, 1);
  return `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${vals.join(", ")});`;
}

// Extract a specific column value
function getColumn(insertLine, colName) {
  const m = insertLine.match(/^INSERT OR IGNORE INTO \S+ \(([^)]+)\) VALUES \(([^)]+)\);?\s*$/);
  if (!m) return null;
  const cols = m[1].split(",").map(c => c.trim());
  const vals = m[2].split(",").map(v => v.trim().replace(/^'|'$/g, ""));
  const idx = cols.indexOf(colName);
  return idx >= 0 ? vals[idx] : null;
}

function getColVal(insertLine, colName, valName) {
  const m = insertLine.match(/^INSERT OR IGNORE INTO \S+ \(([^)]+)\) VALUES \(([^)]+)\);?\s*$/);
  if (!m) return {};
  const cols = m[1].split(",").map(c => c.trim());
  const vals = m[2].split(",").map(v => v.trim().replace(/^'|'$/g, ""));
  const result = {};
  for (let i = 0; i < cols.length; i++) result[cols[i]] = vals[i];
  return result;
}

async function main() {
  const filePath = path.join(__dirname, "..", "migration-output", "import_batch.sql");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Extract artifact_projects lines
  let apLines = [];
  let inAp = false;
  for (const line of lines) {
    if (line.startsWith("-- artifact_projects")) { inAp = true; continue; }
    if (inAp && line.startsWith("-- ")) break;
    if (inAp && line.startsWith("INSERT OR IGNORE INTO artifact_projects")) apLines.push(line);
  }

  // Test first line
  console.log("Original:", apLines[0].slice(0, 120));
  console.log("Fixed:", removeColumn(apLines[0], "root_node_id")?.slice(0, 120));

  // Step 1: Import artifact_projects WITHOUT root_node_id
  console.log(`\n=== artifact_projects (${apLines.length} rows, batch 10) ===`);
  let apOk = 0;
  for (let i = 0; i < apLines.length; i += 10) {
    const batch = apLines.slice(i, i + 10);
    const fixed = batch.map(l => removeColumn(l, "root_node_id")).filter(Boolean);
    if (fixed.length === 0) continue;
    const sql = fixed.join(";\n");
    try {
      const r = await d1Query(sql);
      if (r.success) { apOk += fixed.length; process.stdout.write("."); }
      else { 
        const errMsg = r.errors?.[0]?.message?.slice(0, 100) ?? "?";
        process.stdout.write(`\n  batch ${i}: ${errMsg}`);
      }
    } catch (e) { process.stdout.write(`\n  batch ${i}: ${e.message?.slice(0, 80)}`); }
  }
  console.log(`\n  Inserted: ${apOk}/${apLines.length}`);

  // Step 2: Import artifact_nodes
  let anLines = [];
  let inAn = false;
  for (const line of lines) {
    if (line.startsWith("-- artifact_nodes")) { inAn = true; continue; }
    if (inAn && line.startsWith("-- ")) break;
    if (inAn && line.startsWith("INSERT OR IGNORE INTO artifact_nodes")) anLines.push(line);
  }
  console.log(`\n=== artifact_nodes (${anLines.length} rows, batch 10) ===`);
  let anOk = 0;
  for (let i = 0; i < anLines.length; i += 10) {
    const sql = anLines.slice(i, i + 10).join(";\n");
    try {
      const r = await d1Query(sql);
      if (r.success) { anOk += Math.min(10, anLines.length - i); process.stdout.write("."); }
      else { process.stdout.write(`\n  batch ${i}: ${r.errors?.[0]?.message?.slice(0, 100)}`); }
    } catch (e) { process.stdout.write(`\n  batch ${i}: ${e.message?.slice(0, 80)}`); }
  }
  console.log(`\n  Inserted: ${anOk}/${anLines.length}`);

  // Step 3: Restore root_node_id
  console.log("\n=== Restore root_node_id ===");
  let restoreOk = 0;
  for (let i = 0; i < apLines.length; i += 20) {
    const batch = apLines.slice(i, i + 20);
    const updates = batch.map(l => {
      const vals = getColVal(l);
      if (!vals.id || !vals.root_node_id || vals.root_node_id === "NULL" || vals.root_node_id === "null") return null;
      return `UPDATE artifact_projects SET root_node_id = '${vals.root_node_id}' WHERE id = '${vals.id}'`;
    }).filter(Boolean);
    if (updates.length === 0) continue;
    const sql = updates.join(";\n");
    try {
      const r = await d1Query(sql);
      if (r.success) { restoreOk += updates.length; process.stdout.write("."); }
      else { process.stdout.write("x"); }
    } catch (e) { process.stdout.write("E"); }
  }
  console.log(`\n  Restored: ${restoreOk}`);

  // Verify
  console.log("\nFinal:");
  const r = await d1Query(
    "SELECT 'artifact_projects' as tbl, COUNT(*) as cnt FROM artifact_projects UNION ALL SELECT 'artifact_nodes', COUNT(*) FROM artifact_nodes"
  );
  if (r.success) {
    for (const row of r.result.flatMap((r) => r.results)) {
      console.log(`  ${row.tbl}: ${row.cnt}`);
    }
  }
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
