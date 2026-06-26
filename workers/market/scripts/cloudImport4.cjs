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

async function main() {
  const filePath = path.join(__dirname, "..", "migration-output", "import_batch.sql");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Step 1: Import artifact_projects - each INSERT is one line, batch 15 per request
  console.log("=== artifact_projects ===");
  let apLines = [];
  let inAp = false;
  for (const line of lines) {
    if (line.startsWith("-- artifact_projects")) { inAp = true; continue; }
    if (inAp && line.startsWith("-- ")) break;
    if (inAp && line.startsWith("INSERT OR IGNORE INTO artifact_projects")) apLines.push(line);
  }
  console.log(`Found ${apLines.length} INSERT lines`);

  let apOk = 0;
  const BATCH = 15;
  for (let i = 0; i < apLines.length; i += BATCH) {
    const batch = apLines.slice(i, i + BATCH);
    // Remove root_node_id from each INSERT to break FK cycle with artifact_nodes
    const fixed = batch.map(l => {
      return l.replace(/,\s*'[^']*project-node[^']*'\)/, ")").replace(/,\s*'[a-f0-9-]+'\)/, function(m) {
        // Only nuke the last optional arg if it's root_node_id (heuristic: looks like a UUID before closing paren)
        if (m.match(/,'[a-f0-9-]{36}'\)/)) return ")";
        return m;
      });
    });
    const sql = fixed.join(";\n");
    try {
      const r = await d1Query(sql);
      if (r.success) { apOk += batch.length; process.stdout.write("."); }
      else { process.stdout.write("x"); }
    } catch (e) { process.stdout.write("E"); }
  }
  console.log(`\n  Inserted: ${apOk}/${apLines.length}`);

  // Step 2: Import artifact_nodes
  console.log("\n=== artifact_nodes ===");
  let anLines = [];
  let inAn = false;
  for (const line of lines) {
    if (line.startsWith("-- artifact_nodes")) { inAn = true; continue; }
    if (inAn && line.startsWith("-- ")) break;
    if (inAn && line.startsWith("INSERT OR IGNORE INTO artifact_nodes")) anLines.push(line);
  }
  console.log(`Found ${anLines.length} INSERT lines`);

  let anOk = 0;
  for (let i = 0; i < anLines.length; i += BATCH) {
    const sql = anLines.slice(i, i + BATCH).join(";\n");
    try {
      const r = await d1Query(sql);
      if (r.success) { anOk += BATCH > anLines.length - i ? anLines.length - i : BATCH; process.stdout.write("."); }
      else { process.stdout.write("x"); }
    } catch (e) { process.stdout.write("E"); }
  }
  console.log(`\n  Inserted: ${anOk}/${anLines.length}`);

  // Step 3: Restore root_node_id from import_batch.sql
  console.log("\n=== Restore root_node_id ===");
  let restoreOk = 0;
  for (let i = 0; i < apLines.length; i += BATCH) {
    const batch = apLines.slice(i, i + BATCH);
    const updates = batch.map(l => {
      const m = l.match(/INSERT OR IGNORE INTO artifact_projects \(([^)]+)\) VALUES \(([^)]+)\)/);
      if (!m) return null;
      const cols = m[1].split(",").map(c => c.trim());
      const vals = m[2].split(",").map(v => v.trim().replace(/^'|'$/g, ""));
      const rootIdx = cols.indexOf("root_node_id");
      const idIdx = cols.indexOf("id");
      if (rootIdx === -1 || idIdx === -1) return null;
      const nodeId = vals[rootIdx];
      const projId = vals[idIdx];
      if (!nodeId || nodeId === "NULL") return null;
      return `UPDATE artifact_projects SET root_node_id = '${nodeId}' WHERE id = '${projId}'`;
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
