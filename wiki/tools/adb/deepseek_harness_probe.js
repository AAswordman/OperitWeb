'use strict';

function shellQuote(value) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

async function main() {
  const session = await Tools.System.terminal.create('deepseek_harness_runtime_probe');
  const script = [
    'set +e',
    'export HOME=/root',
    'export PNPM_HOME=/root/.local/share/pnpm',
    'export PATH="$PNPM_HOME:$PATH"',
    'PID_FILE=/root/sidebar_deepseek_harness/deepseek-harness-web.pid',
    'LOG_FILE=/root/sidebar_deepseek_harness/deepseek-harness-web.log',
    'echo "== PID file =="',
    'if [ -f "$PID_FILE" ]; then cat "$PID_FILE"; else echo MISSING; fi',
    'PID="$(cat "$PID_FILE" 2>/dev/null)"',
    'echo "== PID state =="',
    'if [ -n "$PID" ] && kill -0 "$PID" >/dev/null 2>&1; then echo "RUNNING:$PID"; ps -o pid=,ppid=,stat=,etime=,args= -p "$PID"; else echo "NOT_RUNNING:${PID:-MISSING}"; fi',
    'echo "== DeepSeek processes =="',
    "ps -eo pid,ppid,stat,etime,args | grep -E 'deepseek|dsh' | grep -v grep || true",
    'echo "== Port 3081 listeners =="',
    "grep '0100007F:0C09' /proc/net/tcp || true",
    "grep '00000000000000000000000000000000:0C09' /proc/net/tcp6 || true",
    'echo "== Node HTTP probe =="',
    'if command -v node >/dev/null 2>&1; then',
    "  node -e 'const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000); (async () => { try { const response = await fetch(\"http://127.0.0.1:3081\", { signal: controller.signal }); const content = await response.text(); console.log(\"HTTP_STATUS=\" + response.status); console.log(\"HTTP_CONTENT_TYPE=\" + (response.headers.get(\"content-type\") || \"\")); console.log(\"HTTP_BODY_PREFIX=\" + content.slice(0, 240).replace(/\\r?\\n/g, \" \") ); } catch (error) { console.log(\"HTTP_ERROR=\" + error.name + \": \" + error.message); } finally { clearTimeout(timer); } })();'",
    'else',
    '  echo NODE_NOT_FOUND',
    'fi',
    'echo "== Runtime log tail =="',
    'if [ -f "$LOG_FILE" ]; then tail -n 60 "$LOG_FILE"; else echo MISSING; fi',
    'exit 0',
  ].join('\n');

  // Probe the actual Linux runtime so a UI timeout is not mistaken for an HTTP timeout.
  const result = await Tools.System.terminal.exec(
    session.sessionId,
    `bash -lc ${shellQuote(script)}`,
    45000
  );

  return {
    exitCode: result.exitCode,
    output: result.output,
    timedOut: result.timedOut === true,
  };
}

exports.main = main;
