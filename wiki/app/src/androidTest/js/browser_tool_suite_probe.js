'use strict';

const File = Java.type('java.io.File');
const FileOutputStream = Java.type('java.io.FileOutputStream');
const OutputStreamWriter = Java.type('java.io.OutputStreamWriter');
const Charset = Java.type('java.nio.charset.Charset');

const UTF8 = Charset.forName('UTF-8');
const BASE_DIR = '/sdcard/Download/Operit/browser_tool_suite_probe';
const PAGE_PATH = BASE_DIR + '/browser_tool_suite.html';
const PAGE_URL = 'file://' + PAGE_PATH;

function ensureDir(path) {
  const dir = new File(String(path));
  if (!dir.exists()) {
    dir.mkdirs();
  }
}

function writeText(path, text) {
  const file = new File(String(path));
  const parent = file.getParentFile();
  if (parent != null) {
    ensureDir(parent.getAbsolutePath());
  }
  const writer = new OutputStreamWriter(new FileOutputStream(file, false), UTF8);
  try {
    writer.write(String(text));
  } finally {
    writer.close();
  }
}

async function callTool(name, params) {
  try {
    const value = await toolCall('default', name, params || {});
    return { ok: true, value: value };
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.message ? e.message : e),
      data: e && typeof e === 'object' && 'data' in e ? e.data : null,
    };
  }
}

function makeSuiteHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <title>Browser Tool Test</title>',
    '</head>',
    '<body data-dialog="idle">',
    '  <button id="alertBtn">Alert Action</button>',
    '  <button id="fileTrigger">File Trigger</button>',
    '  <input id="fileInput" aria-label="File Input" type="file" style="position:absolute;left:-9999px;top:-9999px;" />',
    '  <script>',
    '    (function () {',
    '      const body = document.body;',
    '      const alertBtn = document.getElementById("alertBtn");',
    '      const fileTrigger = document.getElementById("fileTrigger");',
    '      const fileInput = document.getElementById("fileInput");',
    '      alertBtn.addEventListener("click", function () {',
    '        body.dataset.dialog = "opened";',
    '        alert("Browser dialog");',
    '        body.dataset.dialog = "handled";',
    '      });',
    '      fileTrigger.addEventListener("click", function () {',
    '        fileInput.click();',
    '      });',
    '    })();',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');
}

async function main(params) {
  const mode = params && params.mode ? String(params.mode) : 'run_code';
  ensureDir(BASE_DIR);
  writeText(PAGE_PATH, makeSuiteHtml());

  const out = {};
  out.navigate = await callTool('browser_navigate', { url: PAGE_URL });
  out.snapshot = await callTool('browser_snapshot', { depth: 6 });

  if (mode === 'run_code') {
    out.runCode = await callTool('browser_run_code', {
      code: 'async (page) => { return await page.title(); }',
    });
  } else if (mode === 'close') {
    out.create = await callTool('browser_tabs', { action: 'create' });
    out.select = await callTool('browser_tabs', { action: 'select', index: 1 });
    out.close = await callTool('browser_close', {});
    out.list = await callTool('browser_tabs', { action: 'list' });
  }

  return out;
}

module.exports = { main };
