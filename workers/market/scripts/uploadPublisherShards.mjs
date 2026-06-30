import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WORKSPACE = join(__dirname, "..", "..", "..");
const PUB_DIR = "C:/Users/12809/AppData/Local/Temp/operit-market-test-r2-5925d674a9d6/market/v2/private/publishers";
const CONCURRENCY = 10;
const BUCKET = "operit-market-stats-static";
const CONFIG = join(WORKSPACE, "workers", "market", "wrangler.toml");

async function uploadOne(file) {
  const key = 'market/v2/private/publishers/' + file;
  const filePath = join(PUB_DIR, file);
  return new Promise((resolve) => {
    const proc = spawn("pnpm", [
      "exec", "--", "wrangler", "r2", "object", "put",
      BUCKET + '/' + key,
      "--file", filePath,
      "--remote",
      "--config", CONFIG,
    ], {
      cwd: WORKSPACE,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("exit", (code) => {
      resolve({ file, code, stderr: stderr.trim() });
    });
    proc.on("error", (e) => {
      resolve({ file, code: -1, stderr: e.message });
    });
  });
}

async function main() {
  const files = readdirSync(PUB_DIR).filter(f => f.endsWith(".json"));
  console.log("Uploading " + files.length + " publisher shard files...");

  let done = 0;
  const start = Date.now();

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(uploadOne));
    for (const r of results) {
      done++;
      if (r.code === 0) {
        process.stdout.write("\r\u2713 " + done + "/" + files.length + " (" + Math.round((Date.now()-start)/1000) + "s)");
      } else {
        console.log("\n\u2717 " + r.file + " exit=" + r.code + " " + r.stderr.slice(0, 100));
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("\nDone! " + done + "/" + files.length + " files in " + elapsed + "s");
}

main().catch(console.error);
