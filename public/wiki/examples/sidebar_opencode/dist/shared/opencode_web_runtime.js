"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOpenCodeWebServer = ensureOpenCodeWebServer;
const DEFAULT_PORT = 4096;
const HOST = "127.0.0.1";
const SERVER_TERMINAL_SESSION_NAME = "sidebar_opencode_web_server";
const LINUX_RUNTIME_DIR = "/root/sidebar_opencode_web";
const LINUX_LOG_PATH = `${LINUX_RUNTIME_DIR}/opencode-web.log`;
const LINUX_PID_PATH = `${LINUX_RUNTIME_DIR}/opencode-web.pid`;
const LINUX_PNPM_HOME = "/root/.local/share/pnpm";
const OPENCODE_PACKAGE_NAME = "opencode-ai";
const OPENCODE_INSTALL_COMMAND = `pnpm install -g ${OPENCODE_PACKAGE_NAME} --reporter=append-only`;
function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}
function bashCommand(script) {
    return `bash -lc ${shellQuote(script)}`;
}
function toPort(raw) {
    const value = Number(raw ?? DEFAULT_PORT);
    if (!Number.isInteger(value) || value < 1024 || value > 65535) {
        throw new Error("Port must be an integer between 1024 and 65535.");
    }
    return value;
}
function buildServerUrl(port) {
    return `http://${HOST}:${port}`;
}
function buildHealthUrl(port) {
    return `${buildServerUrl(port)}/global/health`;
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
function buildCommonEnvScript() {
    return [
        `export HOME=${shellQuote("/root")}`,
        `export PNPM_HOME=${shellQuote(LINUX_PNPM_HOME)}`,
        'export PATH="$PNPM_HOME:$PATH"',
        `export BROWSER=${shellQuote("/bin/true")}`,
        `mkdir -p ${shellQuote(LINUX_RUNTIME_DIR)}`,
        `mkdir -p ${shellQuote(LINUX_PNPM_HOME)}`,
    ].join("\n");
}
async function ensureServerTerminalSession() {
    const session = await Tools.System.terminal.create(SERVER_TERMINAL_SESSION_NAME);
    const sessionId = String(session?.sessionId || "").trim();
    if (!sessionId) {
        throw new Error("Failed to access OpenCode web server terminal session.");
    }
    return sessionId;
}
async function execServerCommand(command, timeoutMs) {
    const sessionId = await ensureServerTerminalSession();
    return await Tools.System.terminal.exec(sessionId, command, timeoutMs);
}
function normalizeProgressText(raw) {
    const text = String(raw ?? "").replace(/\r/g, "").trim();
    if (!text) {
        return null;
    }
    const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length === 0) {
        return null;
    }
    return lines[lines.length - 1] || null;
}
function reportProgress(onProgress, message, progress) {
    if (!onProgress) {
        return;
    }
    onProgress({
        message,
        progress,
    });
}
function normalizeProgressValue(value, fallback) {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
}
function createInstallProgressReporter(onProgress) {
    let currentProgress = 46;
    return (message) => {
        const normalizedMessage = normalizeProgressText(message) || "安装 OpenCode CLI";
        const lower = normalizedMessage.toLowerCase();
        let nextProgress = currentProgress;
        if (lower.includes("resolved") ||
            lower.includes("reused") ||
            lower.includes("downloaded") ||
            lower.includes("added")) {
            nextProgress = Math.min(76, currentProgress + 2);
        }
        else if (lower.includes("packages") ||
            lower.includes("progress") ||
            lower.includes("fetch") ||
            lower.includes("link")) {
            nextProgress = Math.min(74, currentProgress + 1);
        }
        else if (lower.includes("done") ||
            lower.includes("opencode") ||
            lower.includes("version")) {
            nextProgress = Math.max(currentProgress, 78);
        }
        else {
            nextProgress = Math.min(72, currentProgress + 1);
        }
        currentProgress = normalizeProgressValue(nextProgress, currentProgress);
        reportProgress(onProgress, `安装 OpenCode: ${normalizedMessage}`, currentProgress);
    };
}
async function execServerCommandStreaming(command, timeoutMs, onProgress) {
    const sessionId = await ensureServerTerminalSession();
    return await Tools.System.terminal.execStreaming(sessionId, command, {
        timeoutMs,
        onIntermediateResult: (event) => {
            if (!onProgress || !event || event.type !== "chunk") {
                return;
            }
            const nextMessage = normalizeProgressText(event.chunk);
            if (nextMessage) {
                onProgress(nextMessage);
            }
        },
    });
}
async function readLinuxLogTail() {
    try {
        const exists = await Tools.Files.exists(LINUX_LOG_PATH, "linux");
        if (!exists?.exists) {
            return null;
        }
        const result = await Tools.Files.read({
            path: LINUX_LOG_PATH,
            environment: "linux",
        });
        const content = String(result?.content || "").trim();
        if (!content) {
            return null;
        }
        const lines = content.split(/\r?\n/);
        return lines.slice(-30).join("\n");
    }
    catch (_error) {
        return null;
    }
}
async function ensureLinuxRuntime() {
    await Tools.Files.mkdir(LINUX_RUNTIME_DIR, true, "linux");
    await Tools.Files.mkdir(LINUX_PNPM_HOME, true, "linux");
}
async function ensurePnpmAndOpenCodeInstalled(onProgress) {
    const reportInstallProgress = createInstallProgressReporter(onProgress);
    const command = bashCommand([
        buildCommonEnvScript(),
        "if ! command -v node >/dev/null 2>&1; then",
        "  echo 'node is required but not found in the Linux runtime.' >&2",
        "  exit 11",
        "fi",
        "if ! command -v pnpm >/dev/null 2>&1; then",
        "  if command -v corepack >/dev/null 2>&1; then",
        "    corepack enable >/dev/null 2>&1 || true",
        "    corepack prepare pnpm@latest --activate",
        "    hash -r",
        "  else",
        "    echo 'pnpm is required but not found, and corepack is unavailable.' >&2",
        "    exit 12",
        "  fi",
        "fi",
        "if ! command -v opencode >/dev/null 2>&1; then",
        `  ${OPENCODE_INSTALL_COMMAND}`,
        "  hash -r",
        "fi",
        "if ! command -v opencode >/dev/null 2>&1; then",
        "  echo 'opencode executable is still unavailable after installation.' >&2",
        "  exit 13",
        "fi",
        "opencode --version",
    ].join("\n"));
    return await execServerCommandStreaming(command, 240000, reportInstallProgress);
}
async function stopServerIfRequested(forceRestart) {
    if (!forceRestart) {
        return;
    }
    const command = bashCommand([
        buildCommonEnvScript(),
        `if [ -f ${shellQuote(LINUX_PID_PATH)} ]; then`,
        `  pid="$(cat ${shellQuote(LINUX_PID_PATH)})"`,
        "  if [ -n \"$pid\" ] && kill -0 \"$pid\" >/dev/null 2>&1; then",
        "    kill \"$pid\" >/dev/null 2>&1 || true",
        "    sleep 1",
        "  fi",
        `  rm -f ${shellQuote(LINUX_PID_PATH)}`,
        "fi",
    ].join("\n"));
    await execServerCommand(command, 6000);
}
async function startServer(port) {
    const sessionId = await ensureServerTerminalSession();
    const command = bashCommand([
        buildCommonEnvScript(),
        `cd ${shellQuote(LINUX_RUNTIME_DIR)}`,
        `if [ -f ${shellQuote(LINUX_PID_PATH)} ]; then`,
        `  pid="$(cat ${shellQuote(LINUX_PID_PATH)})"`,
        "  if [ -n \"$pid\" ] && kill -0 \"$pid\" >/dev/null 2>&1; then",
        "    kill \"$pid\" >/dev/null 2>&1 || true",
        "    sleep 1",
        "  fi",
        `  rm -f ${shellQuote(LINUX_PID_PATH)}`,
        "fi",
        `nohup opencode web --hostname ${HOST} --port ${port} >> ${shellQuote(LINUX_LOG_PATH)} 2>&1 &`,
        `echo $! > ${shellQuote(LINUX_PID_PATH)}`,
        `cat ${shellQuote(LINUX_PID_PATH)}`,
    ].join("\n"));
    await Tools.System.terminal.exec(sessionId, command, 10000);
    return sessionId;
}
async function readHealth(port) {
    try {
        const result = await Tools.Net.httpGet(buildHealthUrl(port));
        const statusCode = Number(result?.statusCode || 0);
        if (statusCode >= 200 && statusCode < 400) {
            return {
                ok: true,
                statusCode,
                output: String(result?.content || ""),
            };
        }
        return {
            ok: false,
            statusCode,
            output: String(result?.content || ""),
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
async function waitForHealth(port, attempts = 30) {
    for (let index = 0; index < attempts; index += 1) {
        const health = await readHealth(port);
        if (health.ok) {
            return true;
        }
        await sleep(1000);
    }
    return false;
}
async function ensureOpenCodeWebServer(params) {
    const port = toPort(params?.port);
    const url = buildServerUrl(port);
    const onProgress = params?.on_progress;
    reportProgress(onProgress, "准备 OpenCode 运行目录", 8);
    await ensureLinuxRuntime();
    reportProgress(onProgress, "检查 OpenCode 服务状态", 14);
    const existing = await readHealth(port);
    if (existing.ok && !params?.force_restart) {
        return {
            success: true,
            status: "running",
            url,
            port,
            runtimeDir: LINUX_RUNTIME_DIR,
            logPath: LINUX_LOG_PATH,
            health: existing,
        };
    }
    reportProgress(onProgress, "停止旧的 OpenCode 进程", 20);
    await stopServerIfRequested(Boolean(params?.force_restart));
    let installResult = null;
    reportProgress(onProgress, "检查并准备 OpenCode CLI 运行时", 34);
    installResult = await ensurePnpmAndOpenCodeInstalled(onProgress);
    reportProgress(onProgress, "正在启动 OpenCode Web 服务", 80);
    const sessionId = await startServer(port);
    reportProgress(onProgress, "等待 OpenCode Web 服务响应", 88);
    const started = await waitForHealth(port);
    if (!started) {
        return {
            success: false,
            status: "failed",
            message: "OpenCode Web did not become reachable in time.",
            url,
            port,
            sessionId,
            runtimeDir: LINUX_RUNTIME_DIR,
            logPath: LINUX_LOG_PATH,
            installExitCode: installResult?.exitCode,
            installOutput: String(installResult?.output || ""),
            diagnostic: await readHealth(port),
            logTail: await readLinuxLogTail(),
        };
    }
    return {
        success: true,
        status: "started",
        url,
        port,
        sessionId,
        runtimeDir: LINUX_RUNTIME_DIR,
        logPath: LINUX_LOG_PATH,
        installExitCode: installResult?.exitCode,
        installOutput: String(installResult?.output || ""),
        health: await readHealth(port),
    };
}
