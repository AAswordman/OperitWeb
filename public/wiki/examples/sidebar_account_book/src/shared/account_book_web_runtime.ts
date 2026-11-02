import {
  ACCOUNT_BOOK_DATA_DIR,
  ACCOUNT_BOOK_DATA_FILE,
} from "./account_book_storage.js";

const WEB_ASSET_RESOURCE_KEY = "account_book_web_assets";
const SERVER_RUNTIME_RESOURCE_KEY = "account_book_web_server_runtime";
const DEFAULT_PORT = 39321;
const HOST = "127.0.0.1";
const SERVER_TERMINAL_SESSION_NAME = "sidebar_account_book_web_server";

const LINUX_RUNTIME_DIR = "/root/sidebar_account_book_web";
const LINUX_PUBLIC_DIR = `${LINUX_RUNTIME_DIR}/public`;
const LINUX_LOG_PATH = `${LINUX_RUNTIME_DIR}/server.log`;
const LINUX_PID_PATH = `${LINUX_RUNTIME_DIR}/server.pid`;
const LINUX_PACKAGE_JSON_PATH = `${LINUX_RUNTIME_DIR}/package.json`;
const LINUX_SERVER_SCRIPT_PATH = `${LINUX_RUNTIME_DIR}/server.cjs`;
const LINUX_INDEX_HTML_PATH = `${LINUX_PUBLIC_DIR}/index.html`;
const LINUX_WEB_ASSET_ZIP_PATH = "/root/sidebar_account_book_web_assets.zip";
const LINUX_SERVER_RUNTIME_ZIP_PATH = "/root/sidebar_account_book_server_runtime.zip";
const LINUX_WEB_STAGE_DIR = "/root/sidebar_account_book_web_assets_unpack";
const LINUX_SERVER_STAGE_DIR = "/root/sidebar_account_book_server_runtime_unpack";
const LINUX_WEB_STAGE_EXTRACTED_DIR = `${LINUX_WEB_STAGE_DIR}/webapp`;
const LINUX_SERVER_STAGE_EXTRACTED_DIR = `${LINUX_SERVER_STAGE_DIR}/server_runtime`;

export interface EnsureAccountBookWebServerParams {
  force_restart?: boolean;
  port?: number;
  on_progress?: (event: AccountBookWebServerProgressEvent) => void;
}

export interface AccountBookWebServerProgressEvent {
  message: string;
  progress?: number;
}

export interface AccountBookWebServerResult {
  success: boolean;
  status: string;
  message?: string;
  url: string;
  port: number;
  sessionId?: string;
  runtimeDir: string;
  logPath: string;
  dataFile: string;
  packageJson: string;
  installExitCode?: number;
  installOutput?: string;
  missingDependencies?: string[];
  webAssetZip?: string;
  serverRuntimeZip?: string;
  health?: unknown;
  diagnostic?: unknown;
  logTail?: string | null;
}

interface RuntimeDependencyState {
  missing: Array<{ name: string; version: string }>;
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

async function ensureServerTerminalSession(): Promise<string> {
  const session = await Tools.System.terminal.create(SERVER_TERMINAL_SESSION_NAME);
  const sessionId = String(session?.sessionId || "").trim();
  if (!sessionId) {
    throw new Error("Failed to access server terminal session for account book web server.");
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
  onProgress: EnsureAccountBookWebServerParams["on_progress"],
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

async function resolveResourceZip(resourceKey: string, outputName: string): Promise<string> {
  const resourcePath = await ToolPkg.readResource(resourceKey, outputName);
  const normalized = String(resourcePath || "").trim();
  if (!normalized) {
    throw new Error(`Missing bundled resource: ${resourceKey}`);
  }
  return normalized;
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

async function prepareLinuxRuntime(
  onProgress?: EnsureAccountBookWebServerParams["on_progress"]
): Promise<{ webAssetZip: string; serverRuntimeZip: string }> {
  reportProgress(onProgress, "正在读取记账本内置资源", 18);
  const webAssetZip = await resolveResourceZip(WEB_ASSET_RESOURCE_KEY, "sidebar_account_book_web_assets.zip");
  const serverRuntimeZip = await resolveResourceZip(SERVER_RUNTIME_RESOURCE_KEY, "sidebar_account_book_server_runtime.zip");

  reportProgress(onProgress, "正在复制网页与服务资源", 26);
  await Tools.Files.copy(webAssetZip, LINUX_WEB_ASSET_ZIP_PATH, false, "android", "linux");
  await Tools.Files.copy(serverRuntimeZip, LINUX_SERVER_RUNTIME_ZIP_PATH, false, "android", "linux");
  await deleteLinuxPathIfExists(LINUX_WEB_STAGE_DIR);
  await deleteLinuxPathIfExists(LINUX_SERVER_STAGE_DIR);
  await Tools.Files.mkdir(LINUX_WEB_STAGE_DIR, true, "linux");
  await Tools.Files.mkdir(LINUX_SERVER_STAGE_DIR, true, "linux");
  await Tools.Files.mkdir(LINUX_RUNTIME_DIR, true, "linux");
  await Tools.Files.mkdir(ACCOUNT_BOOK_DATA_DIR, true, "linux");
  reportProgress(onProgress, "正在解压记账本运行资源", 38);
  await Tools.Files.unzip(LINUX_SERVER_RUNTIME_ZIP_PATH, LINUX_SERVER_STAGE_DIR, "linux");
  await Tools.Files.unzip(LINUX_WEB_ASSET_ZIP_PATH, LINUX_WEB_STAGE_DIR, "linux");
  reportProgress(onProgress, "正在部署记账本网页与服务文件", 48);
  await replaceLinuxPath(
    `${LINUX_SERVER_STAGE_EXTRACTED_DIR}/package.json`,
    LINUX_PACKAGE_JSON_PATH
  );
  await replaceLinuxPath(
    `${LINUX_SERVER_STAGE_EXTRACTED_DIR}/server.cjs`,
    LINUX_SERVER_SCRIPT_PATH
  );
  await replaceLinuxPath(LINUX_WEB_STAGE_EXTRACTED_DIR, LINUX_PUBLIC_DIR);
  const exists = await Tools.Files.exists(ACCOUNT_BOOK_DATA_FILE, "linux");
  if (!exists?.exists) {
    await Tools.Files.write(ACCOUNT_BOOK_DATA_FILE, "[]", false, "linux");
  }
  await deleteLinuxPathIfExists(LINUX_WEB_STAGE_DIR);
  await deleteLinuxPathIfExists(LINUX_SERVER_STAGE_DIR);

  return { webAssetZip, serverRuntimeZip };
}

async function verifyLinuxRuntimeLayout(): Promise<void> {
  const packageJsonExists = await Tools.Files.exists(LINUX_PACKAGE_JSON_PATH, "linux");
  if (!packageJsonExists?.exists) {
    throw new Error(`Linux runtime package.json is missing: ${LINUX_PACKAGE_JSON_PATH}`);
  }
  const serverScriptExists = await Tools.Files.exists(LINUX_SERVER_SCRIPT_PATH, "linux");
  if (!serverScriptExists?.exists) {
    throw new Error(`Linux runtime server.cjs is missing: ${LINUX_SERVER_SCRIPT_PATH}`);
  }
  const indexExists = await Tools.Files.exists(LINUX_INDEX_HTML_PATH, "linux");
  if (!indexExists?.exists) {
    throw new Error(`Linux runtime index.html is missing: ${LINUX_INDEX_HTML_PATH}`);
  }
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

async function readRuntimeDependencyState(): Promise<RuntimeDependencyState> {
  const packageJsonResult = await Tools.Files.read({
    path: LINUX_PACKAGE_JSON_PATH,
    environment: "linux",
  });
  const packageJsonText = String(packageJsonResult?.content || "").trim();
  if (!packageJsonText) {
    throw new Error(`Linux runtime package.json is empty: ${LINUX_PACKAGE_JSON_PATH}`);
  }

  let packageJson: unknown;
  try {
    packageJson = JSON.parse(packageJsonText);
  } catch (error) {
    throw new Error(
      `Linux runtime package.json is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const dependenciesRaw =
    packageJson && typeof packageJson === "object"
      ? (packageJson as Record<string, unknown>).dependencies
      : undefined;
  const dependencies =
    dependenciesRaw && typeof dependenciesRaw === "object"
      ? Object.entries(dependenciesRaw as Record<string, unknown>)
          .map(([name, version]) => ({
            name: String(name || "").trim(),
            version: String(version || "").trim(),
          }))
          .filter((dependency) => dependency.name && dependency.version)
      : [];

  const missing: Array<{ name: string; version: string }> = [];
  for (const dependency of dependencies) {
    const installed = await Tools.Files.exists(
      `${LINUX_RUNTIME_DIR}/node_modules/${dependency.name}/package.json`,
      "linux"
    );
    if (!installed?.exists) {
      missing.push(dependency);
    }
  }

  return { missing };
}

async function installRuntimeDependencies(
  onProgress?: EnsureAccountBookWebServerParams["on_progress"]
): Promise<any> {
  const dependencyState = await readRuntimeDependencyState();
  if (dependencyState.missing.length === 0) {
    return {
      exitCode: 0,
      output: "All production dependencies are already installed.",
      missingDependencies: [],
      skipped: true,
    };
  }
  const command = bashCommand([
    `cd ${shellQuote(LINUX_RUNTIME_DIR)}`,
    [
      "pnpm add --prod --reporter=append-only",
      ...dependencyState.missing.map((dependency) =>
        shellQuote(`${dependency.name}@${dependency.version}`)
      ),
    ].join(" "),
  ].join("\n"));
  const result = await execServerCommandStreaming(command, 120000, (message) => {
    reportProgress(onProgress, `安装依赖: ${message}`, 64);
  });
  return {
    ...result,
    missingDependencies: dependencyState.missing.map((dependency) => dependency.name),
    skipped: false,
  };
}

async function readHealth(port: number) {
  try {
    const result = await Tools.Net.httpGet(`${buildServerUrl(port)}/api/health`);
    const parsed = JSON.parse(String(result?.content || "{}"));
    if (result?.statusCode >= 200 && result?.statusCode < 300 && parsed?.ok) {
      return {
        ok: true,
        data: parsed,
        statusCode: result?.statusCode,
      };
    }
    return {
      ok: false,
      data: parsed,
      statusCode: result?.statusCode,
      output: String(result?.content || ""),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitForHealth(port: number, attempts = 20): Promise<boolean> {
  for (let index = 0; index < attempts; index += 1) {
    const health = await readHealth(port);
    if (health.ok) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function stopServerIfRequested(forceRestart: boolean): Promise<void> {
  if (!forceRestart) {
    return;
  }
  const command = bashCommand([
    `if [ -f ${shellQuote(LINUX_PID_PATH)} ]; then`,
    `  pid="$(cat ${shellQuote(LINUX_PID_PATH)})"`,
    `  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then kill "$pid" >/dev/null 2>&1 || true; fi`,
    `  rm -f ${shellQuote(LINUX_PID_PATH)}`,
    "fi",
  ].join("\n"));
  await execServerCommand(command, 4000);
  await sleep(500);
}

async function startServer(port: number): Promise<string> {
  const sessionId = await ensureServerTerminalSession();
  const command = bashCommand([
    `mkdir -p ${shellQuote(ACCOUNT_BOOK_DATA_DIR)}`,
    `cd ${shellQuote(LINUX_RUNTIME_DIR)}`,
    `if [ -f ${shellQuote(LINUX_PID_PATH)} ]; then`,
    `  pid="$(cat ${shellQuote(LINUX_PID_PATH)})"`,
    `  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then kill "$pid" >/dev/null 2>&1 || true; fi`,
    `  rm -f ${shellQuote(LINUX_PID_PATH)}`,
    "fi",
    `nohup node server.cjs --host ${HOST} --port ${port} --data-file ${shellQuote(ACCOUNT_BOOK_DATA_FILE)} >> ${shellQuote(LINUX_LOG_PATH)} 2>&1 &`,
    `echo $! > ${shellQuote(LINUX_PID_PATH)}`,
    `cat ${shellQuote(LINUX_PID_PATH)}`,
  ].join("\n"));
  await execServerCommand(command, 15000);
  return sessionId;
}

export async function ensureAccountBookWebServer(
  params?: EnsureAccountBookWebServerParams
): Promise<AccountBookWebServerResult> {
  const port = toPort(params?.port);
  const url = buildServerUrl(port);
  const onProgress = params?.on_progress;

  if (!params?.force_restart) {
    reportProgress(onProgress, "检查记账本服务状态", 8);
    const health = await readHealth(port);
    if (health.ok) {
      return {
        success: true,
        status: "running",
        url,
        port,
        runtimeDir: LINUX_RUNTIME_DIR,
        logPath: LINUX_LOG_PATH,
        dataFile: ACCOUNT_BOOK_DATA_FILE,
        packageJson: LINUX_PACKAGE_JSON_PATH,
        health: health.data,
      };
    }
  }

  reportProgress(onProgress, "停止旧的记账本服务", 12);
  await stopServerIfRequested(Boolean(params?.force_restart));
  const resources = await prepareLinuxRuntime(onProgress);
  reportProgress(onProgress, "校验记账本运行目录", 54);
  await verifyLinuxRuntimeLayout();
  reportProgress(onProgress, "检查并安装运行依赖", 58);
  const installResult = await installRuntimeDependencies(onProgress);
  reportProgress(onProgress, "校验依赖安装结果", 74);
  const dependencyState = await readRuntimeDependencyState();
  if (dependencyState.missing.length > 0) {
    throw new Error(
      `Runtime dependencies are still missing after install: ${dependencyState.missing
        .map((dependency) => dependency.name)
        .join(", ")}`
    );
  }
  reportProgress(onProgress, "正在启动记账本网页服务", 82);
  const sessionId = await startServer(port);
  reportProgress(onProgress, "等待记账本网页服务响应", 90);
  const started = await waitForHealth(port);

  if (!started) {
    return {
      success: false,
      status: "failed",
      message: "Web server did not become healthy in time.",
      url,
      port,
      sessionId,
      runtimeDir: LINUX_RUNTIME_DIR,
      logPath: LINUX_LOG_PATH,
      dataFile: ACCOUNT_BOOK_DATA_FILE,
      packageJson: LINUX_PACKAGE_JSON_PATH,
      installExitCode: installResult?.exitCode,
      installOutput: String(installResult?.output || ""),
      missingDependencies: installResult?.missingDependencies,
      webAssetZip: resources.webAssetZip,
      serverRuntimeZip: resources.serverRuntimeZip,
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
    logPath: LINUX_LOG_PATH,
    dataFile: ACCOUNT_BOOK_DATA_FILE,
    packageJson: LINUX_PACKAGE_JSON_PATH,
    installExitCode: installResult?.exitCode,
    installOutput: String(installResult?.output || ""),
    missingDependencies: installResult?.missingDependencies,
    webAssetZip: resources.webAssetZip,
    serverRuntimeZip: resources.serverRuntimeZip,
    health: health.ok ? health.data : null,
  };
}

export async function getAccountBookWebServerStatus(
  params?: EnsureAccountBookWebServerParams
): Promise<AccountBookWebServerResult> {
  const port = toPort(params?.port);
  const url = buildServerUrl(port);
  const health = await readHealth(port);
  return {
    success: true,
    status: health.ok ? "running" : "stopped",
    url,
    port,
    runtimeDir: LINUX_RUNTIME_DIR,
    logPath: LINUX_LOG_PATH,
    dataFile: ACCOUNT_BOOK_DATA_FILE,
    packageJson: LINUX_PACKAGE_JSON_PATH,
    health: health.ok ? health.data : null,
    diagnostic: health.ok ? undefined : health,
    logTail: health.ok ? undefined : await readLinuxLogTail(),
  };
}
