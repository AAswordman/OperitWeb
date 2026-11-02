const DEFAULT_PORT = 18123;
const HOST = "127.0.0.1";
const SERVER_TERMINAL_SESSION_NAME = "sidebar_sillytavern_web_server";

const LINUX_RUNTIME_DIR = "/root/sidebar_sillytavern";
const LINUX_REPO_DIR = `${LINUX_RUNTIME_DIR}/SillyTavern`;
const LINUX_LOG_PATH = `${LINUX_RUNTIME_DIR}/sillytavern.log`;
const LINUX_PID_PATH = `${LINUX_RUNTIME_DIR}/sillytavern.pid`;
const LINUX_PNPM_HOME = "/root/.local/share/pnpm";
const SILLYTAVERN_ARCHIVE_URL =
  "https://codeload.github.com/SillyTavern/SillyTavern/zip/refs/heads/release";
const SILLYTAVERN_ARCHIVE_PATH = `${LINUX_RUNTIME_DIR}/SillyTavern-release.zip`;
const SILLYTAVERN_EXTRACT_DIR = `${LINUX_RUNTIME_DIR}/SillyTavern-release`;

export interface EnsureSillyTavernDashboardServerParams {
  force_restart?: boolean;
  port?: number;
  on_progress?: (event: EnsureSillyTavernDashboardProgressEvent) => void;
}

export interface EnsureSillyTavernDashboardProgressEvent {
  message: string;
  progress?: number;
}

export interface SillyTavernDashboardServerResult {
  success: boolean;
  status: string;
  message?: string;
  url: string;
  port: number;
  sessionId?: string;
  runtimeDir: string;
  repoDir: string;
  logPath: string;
  installExitCode?: number;
  installOutput?: string;
  health?: unknown;
  diagnostic?: unknown;
  logTail?: string | null;
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function bashCommand(script: string): string {
  return `bash -lc ${shellQuote(script)}`;
}

function toPort(raw?: number): number {
  const value = Number(raw ?? DEFAULT_PORT);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error("Port must be an integer between 1024 and 65535.");
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildServerUrl(port: number): string {
  return `http://${HOST}:${port}`;
}

function buildCommonEnvScript(): string {
  return [
    `export HOME=${shellQuote("/root")}`,
    `export PNPM_HOME=${shellQuote(LINUX_PNPM_HOME)}`,
    'export PATH="$PNPM_HOME:$PATH"',
    `export BROWSER=${shellQuote("/bin/true")}`,
    `mkdir -p ${shellQuote(LINUX_RUNTIME_DIR)}`,
    `mkdir -p ${shellQuote(LINUX_PNPM_HOME)}`,
  ].join("\n");
}

function buildStopExistingServerScript(): string {
  return [
    "for proc_dir in /proc/[0-9]*; do",
    "  [ -r \"$proc_dir/cmdline\" ] || continue",
    "  cmdline=\"$(tr '\\000' ' ' < \"$proc_dir/cmdline\" 2>/dev/null)\"",
    "  case \"$cmdline\" in",
    "    *" + LINUX_REPO_DIR + "/server.js*) kill \"${proc_dir##*/}\" >/dev/null 2>&1 || true ;;",
    "  esac",
    "done",
    `rm -f ${shellQuote(LINUX_PID_PATH)}`,
  ].join("\n");
}

function buildDownloadHelperScript(): string {
  return [
    "command_exists() { command -v \"$1\" >/dev/null 2>&1; }",
    "ensure_aria2() {",
    "  if command_exists aria2c; then return 0; fi",
    "  if command_exists apt-get; then",
    "    DEBIAN_FRONTEND=noninteractive apt-get update >/dev/null 2>&1 || apt-get update",
    "    DEBIAN_FRONTEND=noninteractive apt-get install -y aria2",
    "    return 0",
    "  fi",
    "  echo 'aria2c is required but apt-get is unavailable.' >&2",
    "  exit 24",
    "}",
    "download_file() {",
    "  local url=\"$1\"",
    "  local dest=\"$2\"",
    "  aria2c --allow-overwrite=true --continue=true --max-connection-per-server=16 --split=16 --min-split-size=1M --connect-timeout=30 --timeout=120 --max-tries=3 --retry-wait=3 --async-dns=false --disable-ipv6=true --file-allocation=none --summary-interval=0 --console-log-level=warn --out \"$(basename \"$dest\")\" --dir \"$(dirname \"$dest\")\" \"$url\"",
    "}",
  ].join("\n");
}

async function ensureServerTerminalSession(): Promise<string> {
  const session = await Tools.System.terminal.create(SERVER_TERMINAL_SESSION_NAME);
  const sessionId = String(session?.sessionId || "").trim();
  if (!sessionId) {
    throw new Error("Failed to access SillyTavern web server terminal session.");
  }
  return sessionId;
}

async function execServerCommand(command: string, timeoutMs: number): Promise<any> {
  const sessionId = await ensureServerTerminalSession();
  return await Tools.System.terminal.exec(sessionId, command, timeoutMs);
}

function normalizeProgressText(raw: unknown): string | null {
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

function reportProgress(
  onProgress: EnsureSillyTavernDashboardServerParams["on_progress"],
  message: string,
  progress?: number
): void {
  if (!onProgress) {
    return;
  }
  onProgress({
    message,
    progress,
  });
}

async function execServerCommandStreaming(
  command: string,
  timeoutMs: number,
  onProgress?: (message: string) => void
): Promise<any> {
  const sessionId = await ensureServerTerminalSession();
  return await Tools.System.terminal.execStreaming(sessionId, command, {
    timeoutMs,
    onIntermediateResult: (event: any) => {
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

async function ensureLinuxRuntime(): Promise<void> {
  await Tools.Files.mkdir(LINUX_RUNTIME_DIR, true, "linux");
  await Tools.Files.mkdir(LINUX_PNPM_HOME, true, "linux");
}

async function deleteLinuxPathIfExists(path: string): Promise<void> {
  const exists = await Tools.Files.exists(path, "linux");
  if (exists?.exists) {
    await Tools.Files.deleteFile(path, true, "linux");
  }
}

async function replaceLinuxPath(sourcePath: string, destinationPath: string): Promise<void> {
  await deleteLinuxPathIfExists(destinationPath);
  await Tools.Files.move(sourcePath, destinationPath, "linux");
}

async function prepareRepoFromArchive(): Promise<void> {
  await deleteLinuxPathIfExists(LINUX_REPO_DIR);
  await deleteLinuxPathIfExists(SILLYTAVERN_EXTRACT_DIR);
  await Tools.Files.mkdir(LINUX_RUNTIME_DIR, true, "linux");
  await Tools.Files.unzip(SILLYTAVERN_ARCHIVE_PATH, LINUX_RUNTIME_DIR, "linux");

  const extractedExists = await Tools.Files.exists(SILLYTAVERN_EXTRACT_DIR, "linux");
  if (!extractedExists?.exists) {
    throw new Error(
      `SillyTavern extracted directory is missing after zip extraction: ${SILLYTAVERN_EXTRACT_DIR}`
    );
  }

  await replaceLinuxPath(SILLYTAVERN_EXTRACT_DIR, LINUX_REPO_DIR);
}

async function repoPackageExists(): Promise<boolean> {
  const repoExists = await Tools.Files.exists(`${LINUX_REPO_DIR}/package.json`, "linux");
  return Boolean(repoExists?.exists);
}

async function repoDependenciesInstalled(): Promise<boolean> {
  const nodeModulesExists = await Tools.Files.exists(`${LINUX_REPO_DIR}/node_modules`, "linux");
  return Boolean(nodeModulesExists?.exists);
}

async function readLinuxLogTail(): Promise<string | null> {
  try {
    const exists = await Tools.Files.exists(LINUX_LOG_PATH, "linux");
    if (!exists?.exists) {
      return null;
    }
    const result = await Tools.Files.read({ path: LINUX_LOG_PATH, environment: "linux" });
    const content = String(result?.content || "").trim();
    if (!content) {
      return null;
    }
    const lines = content.split(/\r?\n/);
    return lines.slice(-20).join("\n");
  } catch (_error) {
    return null;
  }
}

async function ensureRepoArchiveDownloaded(onProgress?: (message: string) => void): Promise<any> {
  const command = bashCommand([
    buildCommonEnvScript(),
    buildDownloadHelperScript(),
    "if ! command -v node >/dev/null 2>&1; then",
    "  echo 'node is required but not found in the Linux runtime.' >&2",
    "  exit 21",
    "fi",
    "if ! command -v curl >/dev/null 2>&1; then",
    "  echo 'curl is required but not found in the Linux runtime.' >&2",
    "  exit 22",
    "fi",
    "if ! command -v pnpm >/dev/null 2>&1; then",
    "  if command -v corepack >/dev/null 2>&1; then",
    "    corepack enable >/dev/null 2>&1 || true",
    "    corepack prepare pnpm@latest --activate",
    "    hash -r",
    "  else",
    "    echo 'pnpm is required but not found, and corepack is unavailable.' >&2",
    "    exit 23",
    "  fi",
    "fi",
    "ensure_aria2",
    `if [ ! -f ${shellQuote(`${LINUX_REPO_DIR}/package.json`)} ]; then`,
    `  rm -rf ${shellQuote(LINUX_REPO_DIR)} ${shellQuote(SILLYTAVERN_EXTRACT_DIR)} ${shellQuote(SILLYTAVERN_ARCHIVE_PATH)}`,
    `  download_file ${shellQuote(SILLYTAVERN_ARCHIVE_URL)} ${shellQuote(SILLYTAVERN_ARCHIVE_PATH)}`,
    "fi",
  ].join("\n"));
  return await execServerCommandStreaming(command, 240000, onProgress);
}

async function installRepoDependencies(onProgress?: (message: string) => void): Promise<any> {
  const command = bashCommand([
    buildCommonEnvScript(),
    "if ! command -v pnpm >/dev/null 2>&1; then",
    "  if command -v corepack >/dev/null 2>&1; then",
    "    corepack enable >/dev/null 2>&1 || true",
    "    corepack prepare pnpm@latest --activate",
    "    hash -r",
    "  else",
    "    echo 'pnpm is required but not found, and corepack is unavailable.' >&2",
    "    exit 23",
    "  fi",
    "fi",
    `cd ${shellQuote(LINUX_REPO_DIR)}`,
    "pnpm install --reporter=append-only",
  ].join("\n"));
  return await execServerCommandStreaming(command, 240000, onProgress);
}

async function readHealth(port: number) {
  try {
    const result = await Tools.Net.httpGet(buildServerUrl(port));
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitForHealth(port: number, attempts = 60): Promise<boolean> {
  for (let index = 0; index < attempts; index += 1) {
    const health = await readHealth(port);
    if (health.ok) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

async function stopServerIfRequested(forceRestart: boolean): Promise<void> {
  if (!forceRestart) {
    return;
  }
  const command = bashCommand([
    buildCommonEnvScript(),
    buildStopExistingServerScript(),
  ].join("\n"));
  await execServerCommand(command, 4000);
  await sleep(500);
}

async function startServer(port: number): Promise<string> {
  const sessionId = await ensureServerTerminalSession();
  await execServerCommand(
    bashCommand([
      buildCommonEnvScript(),
      `cd ${shellQuote(LINUX_REPO_DIR)}`,
      buildStopExistingServerScript(),
    ].join("\n")),
    15000
  );
  await execServerCommand(`cd ${LINUX_REPO_DIR}`, 4000);
  await execServerCommand(
    `export HOME=/root && export PNPM_HOME=${LINUX_PNPM_HOME} && export PATH="$PNPM_HOME:$PATH" && export BROWSER=/bin/true`,
    4000
  );
  await execServerCommand(`node server.js --port ${port} --listen=false --browserLaunchEnabled=false >> ${LINUX_LOG_PATH} 2>&1 &`, 4000);
  const pidResult = await execServerCommand(`echo $! > ${LINUX_PID_PATH} && cat ${LINUX_PID_PATH}`, 4000);
  if (!String(pidResult?.output || "").trim()) {
    throw new Error("Failed to capture SillyTavern server pid.");
  }
  return sessionId;
}

export async function ensureSillyTavernDashboardServer(
  params?: EnsureSillyTavernDashboardServerParams
): Promise<SillyTavernDashboardServerResult> {
  const port = toPort(params?.port);
  const url = buildServerUrl(port);
  const onProgress = params?.on_progress;

  if (!params?.force_restart) {
    reportProgress(onProgress, "检查 SillyTavern 服务状态", 6);
    const health = await readHealth(port);
    if (health.ok) {
      return {
        success: true,
        status: "running",
        url,
        port,
        runtimeDir: LINUX_RUNTIME_DIR,
        repoDir: LINUX_REPO_DIR,
        logPath: LINUX_LOG_PATH,
        health,
      };
    }
  }

  reportProgress(onProgress, "准备 SillyTavern 运行目录", 10);
  await stopServerIfRequested(Boolean(params?.force_restart));
  await ensureLinuxRuntime();
  let downloadResult: any = null;
  let installResult: any = null;

  const hasRepoPackage = await repoPackageExists();
  if (!hasRepoPackage) {
    reportProgress(onProgress, "正在下载 SillyTavern 源码", 18);
    downloadResult = await ensureRepoArchiveDownloaded((message) => {
      reportProgress(onProgress, `下载 SillyTavern: ${message}`, 26);
    });
    reportProgress(onProgress, "正在解压 SillyTavern 源码", 38);
    await prepareRepoFromArchive();
  }

  const hasDependencies = await repoDependenciesInstalled();
  if (!hasDependencies) {
    reportProgress(onProgress, "正在安装 SillyTavern 依赖", 52);
    installResult = await installRepoDependencies((message) => {
      reportProgress(onProgress, `安装依赖: ${message}`, 64);
    });
  }

  reportProgress(onProgress, "正在启动 SillyTavern 服务", 80);
  const sessionId = await startServer(port);
  reportProgress(onProgress, "等待 SillyTavern 服务响应", 88);
  const started = await waitForHealth(port);

  if (!started) {
    return {
      success: false,
      status: "failed",
      message: "SillyTavern did not become reachable in time.",
      url,
      port,
      sessionId,
      runtimeDir: LINUX_RUNTIME_DIR,
      repoDir: LINUX_REPO_DIR,
      logPath: LINUX_LOG_PATH,
      installExitCode: installResult?.exitCode ?? downloadResult?.exitCode,
      installOutput: [String(downloadResult?.output || ""), String(installResult?.output || "")]
        .filter(Boolean)
        .join("\n"),
      logTail: await readLinuxLogTail(),
    };
  }

  const health = await readHealth(port);
  return {
    success: true,
    status: "started",
    url,
    port,
    sessionId,
    runtimeDir: LINUX_RUNTIME_DIR,
    repoDir: LINUX_REPO_DIR,
    logPath: LINUX_LOG_PATH,
    installExitCode: installResult?.exitCode ?? downloadResult?.exitCode,
    installOutput: [String(downloadResult?.output || ""), String(installResult?.output || "")]
      .filter(Boolean)
      .join("\n"),
    health: health.ok ? health : null,
  };
}
