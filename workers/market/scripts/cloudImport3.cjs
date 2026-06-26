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

function extractInsertValues(fullSql, tableName) {
  const prefix = `INSERT OR IGNORE INTO ${tableName} (`;
  const idx = fullSql.indexOf(prefix);
  if (idx === -1) return { cols: "", values: [] };
  const after = fullSql.slice(idx + prefix.length);
  const colEnd = after.indexOf(") VALUES");
  if (colEnd === -1) return { cols: "", values: [] };
  const cols = after.slice(0, colEnd);
  const valStart = colEnd + ") VALUES".length;
  const valSection = after.slice(valStart).trim();
  // Split by "),(" pattern
  const values = valSection.split(/\),\s*\(/).map(v => {
    v = v.replace(/^\(/, "").replace(/\);?\s*$/, "").replace(/;\s*$/, "");
    return v;
  }).filter(v => v.trim());
  return { cols, values };
}

async function main() {
  const filePath = path.join(__dirname, "..", "migration-output", "import_batch.sql");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Extract table SQLs
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

  // Step 1: Import artifact_projects with NULL root_node_id (to break FK cycle)
  console.log("=== artifact_projects (NULL root_node_id) ===");
  const { cols: apCols, values: apValues } = extractInsertValues(tables["artifact_projects"], "artifact_projects");
  // Rebuild cols without root_node_id
  const colsArr = apCols.split(",").map(c => c.trim());
  const rootNodeIdx = colsArr.indexOf("root_node_id");
  const colsNoRoot = colsArr.filter(c => c !== "root_node_id").join(", ");
  console.log(`Columns: ${colsNoRoot}`);
  console.log(`Total rows: ${apValues.length}`);

  // Insert in batches of 20
  let totalOk = 0;
  for (let i = 0; i < apValues.length; i += 20) {
    const batch = apValues.slice(i, i + 20);
    const vals = batch.map(v => {
      const parts = v.split(",").map(p => p.trim());
      // Remove root_node_id column (nullable)
      parts.splice(rootNodeIdx, 1);
      return `(${parts.join(", ")})`;
    }).join(",\n");
    const sql = `INSERT OR IGNORE INTO artifact_projects (${colsNoRoot}) VALUES ${vals}`;
    try {
      const r = await d1Query(sql);
      if (r.success) {
        totalOk += batch.length;
        process.stdout.write(".");
      } else {
        const errMsg = r.errors?.[0]?.message?.slice(0, 80) ?? "?";
        process.stdout.write(`\n  batch ${i}: ${errMsg}`);
      }
    } catch (e) {
      process.stdout.write(`\n  batch ${i}: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`\n  Inserted: ${totalOk}/${apValues.length}`);

  // Step 2: Import artifact_nodes
  console.log("\n=== artifact_nodes ===");
  const { cols: anCols, values: anValues } = extractInsertValues(tables["artifact_nodes"], "artifact_nodes");
  console.log(`Total rows: ${anValues.length}`);

  let nodesOk = 0;
  for (let i = 0; i < anValues.length; i += 20) {
    const batch = anValues.slice(i, i + 20);
    const vals = batch.map(v => `(${v})`).join(",\n");
    const sql = `INSERT OR IGNORE INTO artifact_nodes (${anCols}) VALUES ${vals}`;
    try {
      const r = await d1Query(sql);
      if (r.success) {
        nodesOk += batch.length;
        process.stdout.write(".");
      } else {
        const errMsg = r.errors?.[0]?.message?.slice(0, 80) ?? "?";
        process.stdout.write(`\n  batch ${i}: ${errMsg}`);
      }
    } catch (e) {
      process.stdout.write(`\n  batch ${i}: ${e.message?.slice(0, 80)}`);
    }
  }
  console.log(`\n  Inserted: ${nodesOk}/${anValues.length}`);

  // Step 3: Restore root_node_id with UPDATE
  console.log("\n=== UPDATE artifact_projects.root_node_id ===");
  let updateOk = 0;
  for (let i = 0; i < apValues.length; i += 20) {
    const batch = apValues.slice(i, i + 20);
    const updates = [];
    for (const v of batch) {
      const parts = v.split(",").map(p => p.trim().replace(/^'|'$/g, ""));
      const id = parts[0];
      const rootNode = parts[rootNodeIdx];
      if (rootNode && rootNode !== "NULL" && rootNode !== "null") {
        updates.push(`UPDATE artifact_projects SET root_node_id = '${rootNode}' WHERE id = '${id}'`);
      }
    }
    if (updates.length > 0) {
      const sql = updates.join(";\n");
      try {
        const r = await d1Query(sql);
        if (r.success) {
          updateOk += updates.length;
          process.stdout.write(".");
        } else {
          process.stdout.write("x");
        }
      } catch (e) {
        process.stdout.write("E");
      }
    }
  }
  console.log(`\n  Updated: ${updateOk}`);

  // Verify
  console.log("\nFinal:");
  const r = await d1Query(
    "SELECT 'artifact_projects' as tbl, COUNT(*) as cnt FROM artifact_projects UNION ALL SELECT 'artifact_nodes', COUNT(*) FROM artifact_nodes UNION ALL SELECT 'repo_plugin_specs', COUNT(*) FROM repo_plugin_specs UNION ALL SELECT 'repo_plugin_versions', COUNT(*) FROM repo_plugin_versions"
  );
  if (r.success) {
    for (const row of r.result.flatMap((r) => r.results)) {
      console.log(`  ${row.tbl}: ${row.cnt}`);
    }
  }
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
