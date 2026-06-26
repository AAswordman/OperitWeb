const { readFileSync } = require("node:fs");
const path = require("node:path");

const TOKEN = "EIGhvwpxpdqIP7quNui0ZWTMNlYvb6jCBSYOHSm1";
const ACCOUNT_ID = "c667bf70582c5ceceda8d3d183ad8e3b";
const WORKER = "market-v2";

async function main() {
  const bundlePath = path.join(__dirname, "..", "dist", "bundle.js");
  const scriptContent = readFileSync(bundlePath, "utf-8");

  const metadata = {
    main_module: "bundle.js",
    compatibility_date: "2026-06-25",
    bindings: [
      { type: "r2_bucket", name: "MARKET_STATS_BUCKET", bucket_name: "operit-market-stats-static" },
      { type: "d1", name: "OPERIT_MARKET_DB", database_id: "9ae3cbdc-de89-402f-81ff-6482ef0cca73" },
      { type: "d1", name: "OPERIT_SUBMISSION_DB", database_id: "094b2ad8-0bd2-478b-be7c-ecbde87c2e2c" }
    ],
    vars: {
      MARKET_ROUTE_PREFIX: "",
      MARKET_STATIC_OBJECT_PREFIX: "market-stats",
      MARKET_ALLOWED_ORIGINS: "*",
      MARKET_ALLOWED_DOWNLOAD_HOSTS: "github.com,objects.githubusercontent.com,release-assets.githubusercontent.com,raw.githubusercontent.com",
      MARKET_SUPPORTED_TYPES: "script,package,skill,mcp",
      MARKET_RANK_PAGE_SIZE: "20",
      MARKET_RANK_MAX_PAGES: "0",
      MARKET_JSON_CACHE_MAX_AGE: "300",
      MARKET_SESSION_TTL_SECONDS: "604800"
    },
    triggers: { crons: ["0 */6 * * *"] }
  };

  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const metaStr = JSON.stringify(metadata);
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="metadata"; filename="metadata.json"`,
    `Content-Type: application/json`,
    ``,
    metaStr,
    `--${boundary}`,
    `Content-Disposition: form-data; name="bundle.js"; filename="bundle.js"`,
    `Content-Type: application/javascript+module`,
    ``,
    scriptContent,
    `--${boundary}--`,
  ].join("\r\n");

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER}`;
  console.log(`Uploading ${scriptContent.length} bytes script + ${metaStr.length} bytes metadata...`);

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    signal: AbortSignal.timeout(120000),
  });

  const result = await resp.text();
  console.log(`Status: ${resp.status}`);
  console.log(result.slice(0, 500));
}

main().catch(e => { console.error(e.message); process.exit(1); });
