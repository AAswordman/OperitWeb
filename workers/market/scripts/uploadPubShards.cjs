const fs = require('node:fs');
const path = require('node:path');
const uploaderUrl = "https://operit-market-r2-uploader.1002153674.workers.dev";
const uploadToken = "a24860cc-8da3-4253-9e1e-a6d38b186928b3387496-4199-44d6-9784-90220353e62e";
const pubDir = "C:/Users/12809/AppData/Local/Temp/operit-market-test-r2-dbd59c59f991/market/v2/private/publishers";
const files = fs.readdirSync(pubDir).filter(f => f.endsWith('.json')).map(name => ({ name, key: 'market/v2/private/publishers/' + name }));
async function runPool(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}
async function upload(item) {
  const body = fs.readFileSync(path.join(pubDir, item.name));
  const encoded = item.key.split('/').map(encodeURIComponent).join('/');
  const url = uploaderUrl + '/' + encoded;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json; charset=utf-8', 'x-upload-token': uploadToken }, body, signal: AbortSignal.timeout(120000) });
    if (resp.ok) return;
    const text = await resp.text().catch(() => '');
    if (attempt === 4) throw new Error(item.key + ': HTTP ' + resp.status + ' ' + text.slice(0, 200));
    await new Promise(resolve => setTimeout(resolve, 250 * attempt));
  }
}
(async () => {
  console.log("Uploading " + files.length + " publisher shards...");
  let done = 0;
  const start = Date.now();
  await runPool(files, 20, async item => {
    try {
      await upload(item);
      done++;
      if (done % 10 === 0 || done === files.length) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        process.stdout.write("\rUploaded " + done + "/" + files.length + " (" + elapsed + "s)");
      }
    } catch(e) {
      console.log("\nFAILED " + item.key + ": " + e.message);
    }
  });
  console.log("\nDone! " + done + "/" + files.length + " in " + ((Date.now()-start)/1000).toFixed(1) + "s");
})();

