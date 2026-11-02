'use strict';

const File = Java.type('java.io.File');
const FileOutputStream = Java.type('java.io.FileOutputStream');
const OutputStreamWriter = Java.type('java.io.OutputStreamWriter');
const Charset = Java.type('java.nio.charset.Charset');

const UTF8 = Charset.forName('UTF-8');
const BASE_DIR = '/sdcard/Download/Operit/browser_tool_smoke';
const PAGE_PATH = BASE_DIR + '/smoke.html';
const PAGE_URL = 'file://' + PAGE_PATH;
const UPLOAD_PATH = BASE_DIR + '/upload.txt';

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

function countTabs(output) {
  const matches = String(output || '').match(/^- \[\d+\]/gm);
  return matches ? matches.length : 0;
}

function findRef(snapshot, marker) {
  const lines = String(snapshot || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].indexOf(marker) >= 0) {
      const match = lines[i].match(/\[ref=([^\]]+)\]/);
      if (match) {
        return match[1];
      }
    }
  }
  return null;
}

async function tryCleanup() {
  await callTool('browser_handle_dialog', { accept: true });
  await callTool('browser_file_upload', {});
  await callTool('browser_close_all', {});
}

function html() {
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8" /><title>Smoke Browser</title></head>',
    '<body>',
    '<button id="alertBtn">Alert Action</button>',
    '<button id="fileTrigger">File Trigger</button>',
    '<button id="dragSrc" draggable="true">Drag Source</button>',
    '<button id="dragDst">Drag Target</button>',
    '<input id="fileInput" aria-label="File Input" type="file" style="position:absolute;left:-9999px;top:-9999px;" />',
    '<script>',
    '  const body = document.body;',
    '  const alertBtn = document.getElementById("alertBtn");',
    '  const fileTrigger = document.getElementById("fileTrigger");',
    '  const fileInput = document.getElementById("fileInput");',
    '  const dragSrc = document.getElementById("dragSrc");',
    '  const dragDst = document.getElementById("dragDst");',
    '  alertBtn.addEventListener("click", function () { body.dataset.dialog = "opened"; alert("Smoke dialog"); body.dataset.dialog = "handled"; });',
    '  fileTrigger.addEventListener("click", function () { fileInput.click(); });',
    '  fileInput.addEventListener("change", function () { body.dataset.upload = Array.prototype.map.call(fileInput.files || [], function (file) { return file.name; }).join(","); });',
    '  dragSrc.addEventListener("dragstart", function (event) { if (event.dataTransfer) { event.dataTransfer.setData("text/plain", "drag-source"); } });',
    '  dragDst.addEventListener("dragover", function (event) { event.preventDefault(); });',
    '  dragDst.addEventListener("drop", function (event) { event.preventDefault(); body.dataset.dropped = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "missing"; });',
    '</script>',
    '</body></html>',
  ].join('\n');
}

async function setupPage() {
  ensureDir(BASE_DIR);
  writeText(PAGE_PATH, html());
  writeText(UPLOAD_PATH, 'smoke upload');
  await tryCleanup();
  const navigate = await callTool('browser_navigate', { url: PAGE_URL });
  const snapshot = await callTool('browser_snapshot', { depth: 6 });
  return { navigate, snapshot };
}

async function main(params) {
  const mode = params && params.mode ? String(params.mode) : 'snapshot';
  const out = {
    mode: mode,
    setup: await setupPage(),
  };

  if (out.setup.snapshot.ok) {
    out.refs = {
      alertBtn: findRef(out.setup.snapshot.value, 'Alert Action'),
      fileTrigger: findRef(out.setup.snapshot.value, 'File Trigger'),
      dragSrc: findRef(out.setup.snapshot.value, 'Drag Source'),
      dragDst: findRef(out.setup.snapshot.value, 'Drag Target'),
    };
  }

  if (mode === 'handle_dialog') {
    out.click = await callTool('browser_click', { ref: out.refs.alertBtn });
    out.handle = await callTool('browser_handle_dialog', { accept: true });
    out.state = await callTool('browser_evaluate', { function: '() => document.body.dataset.dialog' });
  } else if (mode === 'file_upload') {
    out.click = await callTool('browser_click', { ref: out.refs.fileTrigger });
    out.upload = await callTool('browser_file_upload', { paths: [UPLOAD_PATH] });
    out.state = await callTool('browser_evaluate', { function: '() => document.body.dataset.upload' });
  } else if (mode === 'resize') {
    out.resize = await callTool('browser_resize', { width: 720, height: 1280 });
  } else if (mode === 'tabs') {
    out.list = await callTool('browser_tabs', { action: 'list' });
    out.create = await callTool('browser_tabs', { action: 'create' });
    out.select = await callTool('browser_tabs', { action: 'select', index: 0 });
  } else if (mode === 'close') {
    await callTool('browser_tabs', { action: 'create' });
    await callTool('browser_tabs', { action: 'select', index: 1 });
    out.close = await callTool('browser_close', {});
    out.list = await callTool('browser_tabs', { action: 'list' });
  } else if (mode === 'close_all') {
    await callTool('browser_tabs', { action: 'create' });
    await callTool('browser_tabs', { action: 'create' });
    out.closeAll = await callTool('browser_close_all', {});
    out.list = await callTool('browser_tabs', { action: 'list' });
  } else if (mode === 'run_code') {
    out.runCode = await callTool('browser_run_code', { code: 'async (page) => { return await page.title(); }' });
  }

  return out;
}

module.exports = { main };
