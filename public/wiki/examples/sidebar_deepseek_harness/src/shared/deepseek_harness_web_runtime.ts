const DEFAULT_PORT = 3081;
const LOOPBACK_HOST = "127.0.0.1";
const DSH_PACKAGE_NAME = "@deepseek-ai/dsh";
const DSH_PACKAGE_SPEC = `${DSH_PACKAGE_NAME}@latest`;
const STARTUP_HEALTH_WAIT_MS = 120000;
const TERMINAL_SESSION_NAME = "sidebar_deepseek_harness_web_server";
const LINUX_RUNTIME_DIR = "/root/sidebar_deepseek_harness";
const DSH_HOME_DIR = `${LINUX_RUNTIME_DIR}/dsh-home`;
const LINUX_LOG_PATH = `${LINUX_RUNTIME_DIR}/deepseek-harness-web.log`;
const LINUX_PID_PATH = `${LINUX_RUNTIME_DIR}/deepseek-harness-web.pid`;
const DSH_PACKAGE_MANIFEST_PATH = `${LINUX_RUNTIME_DIR}/node_modules/${DSH_PACKAGE_NAME}/package.json`;
const DSH_PROCESS_MARKER = "operit_deepseek_harness_web";
const DSH_PROCESS_MARKER_ENV = `OPERIT_DSH_PROCESS_MARKER=${DSH_PROCESS_MARKER}`;
const LINUX_PNPM_HOME = "/root/.local/share/pnpm";
const PNPM_WORKSPACE_PATH = `${LINUX_RUNTIME_DIR}/pnpm-workspace.yaml`;
const DSH_ALLOWED_BUILD_PACKAGES = [
  "@deepseek-ai/dsh-subprocess-local",
  "@google/genai",
  "koffi",
  "node-pty",
  "protobufjs",
];

export interface DeepSeekHarnessWebServerProgressEvent {
  message: string;
  progress: number;
  output?: string;
}

export interface DeepSeekHarnessWebServerResult {
  success: boolean;
  status: "running" | "started" | "failed";
  message: string;
  url: string;
  port: number;
  runtimeDir: string;
  dshHomeDir: string;
  logPath: string;
  sessionId?: string;
  installExitCode?: number;
  installOutput?: string;
  diagnostic?: string;
  logTail?: string;
}

export interface DeepSeekHarnessWebServerStatus {
  success: boolean;
  status: "running" | "starting" | "stopped";
  message: string;
  url: string;
  port: number;
  runtimeDir: string;
  dshHomeDir: string;
  logPath: string;
  pid?: string;
  logTail?: string;
}

export interface DeepSeekHarnessWebServerStartParams {
  forceRestart?: boolean;
  onProgress?: (event: DeepSeekHarnessWebServerProgressEvent) => void;
}

export type DeepSeekHarnessRuntimeInspectionStatus =
  | "uninitialized"
  | "ready"
  | "update_available"
  | "failed";

export interface DeepSeekHarnessRuntimeInspection {
  status: DeepSeekHarnessRuntimeInspectionStatus;
  message: string;
  installedVersion?: string;
  latestVersion?: string;
  diagnostic?: string;
}

export interface DeepSeekHarnessRuntimeInstallResult {
  success: boolean;
  message: string;
  executedCommand?: string;
  installExitCode?: number;
  installTimedOut?: boolean;
  installOutput?: string;
  diagnostic?: string;
}

export interface DeepSeekHarnessRuntimeInspectionParams {
  onProgress?: (event: DeepSeekHarnessWebServerProgressEvent) => void;
}

interface HealthCheckResult {
  ok: boolean;
  message: string;
}

interface DeepSeekHarnessPackageManifest {
  version?: string;
}

interface DeepSeekHarnessRuntimeEventRecord {
  type?: string;
  running?: boolean;
  source?: string;
  version?: string;
  progress?: number;
  message?: string;
  output?: string;
  status?: string;
  command?: string;
  exitCode?: number;
}

interface DeepSeekHarnessProcessStatusEvent {
  type: "process_status";
  running: true;
}

interface DeepSeekHarnessVersionEvent {
  type: "version";
  source: "installed" | "latest";
  version: string;
}

interface DeepSeekHarnessVersionFailureEvent {
  type: "version_failure";
  message: string;
}

interface DeepSeekHarnessInstallProgressRuntimeEvent {
  type: "install_progress";
  progress: number;
  message: string;
}

interface DeepSeekHarnessInstallOutputRuntimeEvent {
  type: "install_output";
  output: string;
}

interface DeepSeekHarnessInstallResultRuntimeEvent {
  type: "install_result";
  status: "ready" | "failed";
  message?: string;
  command?: string;
  exitCode?: number;
}

type DeepSeekHarnessRuntimeEvent =
  | DeepSeekHarnessProcessStatusEvent
  | DeepSeekHarnessVersionEvent
  | DeepSeekHarnessVersionFailureEvent
  | DeepSeekHarnessInstallProgressRuntimeEvent
  | DeepSeekHarnessInstallOutputRuntimeEvent
  | DeepSeekHarnessInstallResultRuntimeEvent;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function bashCommand(script: string): string {
  return `bash -lc ${shellQuote(script)}`;
}

function isDshVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value);
}

function parseRuntimeEvents(output: string): DeepSeekHarnessRuntimeEvent[] {
  const events: DeepSeekHarnessRuntimeEvent[] = [];
  const lines = output.replace(/\r/g, "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("{") || !line.endsWith("}")) {
      continue;
    }
    try {
      const record = JSON.parse(line) as DeepSeekHarnessRuntimeEventRecord;
      if (record.type === "process_status" && record.running === true) {
        events.push({ type: "process_status", running: true });
      } else if (
        record.type === "version" &&
        (record.source === "installed" || record.source === "latest") &&
        typeof record.version === "string" &&
        isDshVersion(record.version)
      ) {
        events.push({ type: "version", source: record.source, version: record.version });
      } else if (record.type === "version_failure" && typeof record.message === "string") {
        events.push({ type: "version_failure", message: record.message });
      } else if (
        record.type === "install_progress" &&
        typeof record.progress === "number" &&
        typeof record.message === "string"
      ) {
        events.push({ type: "install_progress", progress: record.progress, message: record.message });
      } else if (record.type === "install_output" && typeof record.output === "string") {
        events.push({ type: "install_output", output: record.output });
      } else if (
        record.type === "install_result" &&
        (record.status === "ready" || record.status === "failed")
      ) {
        const installResult: DeepSeekHarnessInstallResultRuntimeEvent = {
          type: "install_result",
          status: record.status,
        };
        if (typeof record.message === "string") {
          installResult.message = record.message;
        }
        if (typeof record.command === "string") {
          installResult.command = record.command;
        }
        if (typeof record.exitCode === "number") {
          installResult.exitCode = record.exitCode;
        }
        events.push(installResult);
      }
    } catch (error) {
      console.error("DeepSeek Harness runtime event parsing failed", error);
    }
  }
  return events;
}

function buildRuntimeEventEmitterScript(): string {
  const eventScript = [
    "const [type, first, second, third, fourth] = process.argv.slice(1);",
    "let event;",
    "if (type === 'process_status') { event = { type, running: first === 'true' }; }",
    "else if (type === 'version') { event = { type, source: first, version: second }; }",
    "else if (type === 'version_failure') { event = { type, message: first }; }",
    "else if (type === 'install_progress') { event = { type, progress: Number(first), message: second }; }",
    "else if (type === 'install_result') { event = { type, status: first }; if (second) event.message = second; if (third) event.command = third; if (fourth !== undefined) event.exitCode = Number(fourth); }",
    "else { process.exit(2); }",
    "process.stdout.write(JSON.stringify(event) + '\\n');",
  ].join("");
  const outputScript = [
    "const readline = require('node:readline');",
    "const reader = readline.createInterface({ input: process.stdin });",
    "reader.on('line', (output) => process.stdout.write(JSON.stringify({ type: 'install_output', output }) + '\\n'));",
  ].join("");
  return [
    `runtime_event() { node -e ${shellQuote(eventScript)} "$@"; }`,
    `runtime_output() { node -e ${shellQuote(outputScript)}; }`,
  ].join("\n");
}

function buildServerUrl(): string {
  return `http://${LOOPBACK_HOST}:${DEFAULT_PORT}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function reportProgress(
  onProgress: ((event: DeepSeekHarnessWebServerProgressEvent) => void) | undefined,
  message: string,
  progress: number,
  output?: string
): void {
  if (onProgress === undefined) {
    return;
  }
  onProgress({ message, progress, output });
}

function buildRuntimeEnvironment(): string {
  return [
    `export HOME=${shellQuote("/root")}`,
    `export PNPM_HOME=${shellQuote(LINUX_PNPM_HOME)}`,
    'export PATH="$PNPM_HOME:$PATH"',
    `export DSH_HOME=${shellQuote(DSH_HOME_DIR)}`,
    'export BROWSER=/bin/true',
    `mkdir -p ${shellQuote(LINUX_RUNTIME_DIR)}`,
    `mkdir -p ${shellQuote(DSH_HOME_DIR)}`,
    `mkdir -p ${shellQuote(LINUX_PNPM_HOME)}`,
  ].join("\n");
}

async function getTerminalSessionId(): Promise<string> {
  const session = await Tools.System.terminal.create(TERMINAL_SESSION_NAME);
  const sessionId = session.sessionId.trim();
  if (!sessionId) {
    throw new Error("DeepSeek Harness terminal session was not created.");
  }
  return sessionId;
}

async function executeRuntimeCommand(
  command: string,
  timeoutMs: number
) {
  const sessionId = await getTerminalSessionId();
  return Tools.System.terminal.exec(sessionId, command, timeoutMs);
}

async function executeRuntimeCommandStreaming(
  command: string,
  timeoutMs: number,
  onProgress: ((event: DeepSeekHarnessWebServerProgressEvent) => void) | undefined
) {
  const sessionId = await getTerminalSessionId();
  return Tools.System.terminal.execStreaming(sessionId, command, {
    timeoutMs,
    onIntermediateResult: (event) => {
      if (event.type !== "chunk" || event.chunk === null || event.chunk === undefined) {
        return;
      }
      for (const runtimeEvent of parseRuntimeEvents(event.chunk)) {
        if (runtimeEvent.type === "install_progress") {
          reportProgress(onProgress, runtimeEvent.message, runtimeEvent.progress);
        } else if (runtimeEvent.type === "install_output") {
          reportProgress(onProgress, "正在安装 DeepSeek Harness", 55, runtimeEvent.output);
        }
      }
    },
  });
}

async function readLinuxLogTail(): Promise<string | undefined> {
  try {
    const exists = await Tools.Files.exists(LINUX_LOG_PATH, "linux");
    if (!exists.exists) {
      return undefined;
    }
    const result = await Tools.Files.read({
      path: LINUX_LOG_PATH,
      environment: "linux",
    });
    const content = result.content.trim();
    if (!content) {
      return undefined;
    }
    return content.split(/\r?\n/).slice(-30).join("\n");
  } catch (error) {
    console.error("DeepSeek Harness log read failed", error);
    return undefined;
  }
}

async function readRuntimePid(): Promise<string | undefined> {
  const exists = await Tools.Files.exists(LINUX_PID_PATH, "linux");
  if (!exists.exists) {
    return undefined;
  }

  const result = await Tools.Files.read({
    path: LINUX_PID_PATH,
    environment: "linux",
  });
  const pid = result.content.trim();
  return pid || undefined;
}

async function isDshRuntimeInstalled(): Promise<boolean> {
  const manifest = await Tools.Files.exists(DSH_PACKAGE_MANIFEST_PATH, "linux");
  return manifest.exists;
}

function readVersionEvent(
  events: DeepSeekHarnessRuntimeEvent[],
  source: DeepSeekHarnessVersionEvent["source"]
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const runtimeEvent = events[index];
    if (
      runtimeEvent !== undefined &&
      runtimeEvent.type === "version" &&
      runtimeEvent.source === source
    ) {
      return runtimeEvent.version;
    }
  }
  return undefined;
}

function readVersionFailureEvent(events: DeepSeekHarnessRuntimeEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const runtimeEvent = events[index];
    if (runtimeEvent !== undefined && runtimeEvent.type === "version_failure") {
      return runtimeEvent.message;
    }
  }
  return undefined;
}

async function readInstalledDshVersion(): Promise<string | undefined> {
  if (!(await isDshRuntimeInstalled())) {
    return undefined;
  }

  // Read the absolute manifest through the Linux file API. A terminal-relative
  // require here would inspect /root after a new session and misreport a valid installation.
  try {
    const result = await Tools.Files.read({
      path: DSH_PACKAGE_MANIFEST_PATH,
      environment: "linux",
    });
    const manifest = JSON.parse(result.content) as DeepSeekHarnessPackageManifest;
    if (typeof manifest.version !== "string" || !isDshVersion(manifest.version)) {
      throw new Error("DeepSeek Harness package.json does not contain a valid version.");
    }
    return manifest.version;
  } catch (error) {
    console.error("DeepSeek Harness installed version read failed", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取已安装的 DeepSeek Harness 版本：${message}`);
  }
}

async function readLatestDshVersion(): Promise<string> {
  const result = await executeRuntimeCommand(
    bashCommand([
      buildRuntimeEnvironment(),
      buildRuntimeEventEmitterScript(),
      "if ! command -v pnpm >/dev/null 2>&1; then",
      "  runtime_event version_failure 'pnpm is required to check DeepSeek Harness updates.'",
      `elif latest_version="$(pnpm view ${DSH_PACKAGE_NAME} version --silent 2>/dev/null)" && [ -n "$latest_version" ]; then`,
      "  runtime_event version latest \"$latest_version\"",
      "else",
      "  runtime_event version_failure 'The latest DeepSeek Harness version could not be checked.'",
      "fi",
    ].join("\n")),
    30000
  );
  const events = parseRuntimeEvents(result.output);
  const version = readVersionEvent(events, "latest");
  if (version !== undefined) {
    return version;
  }
  const failure = readVersionFailureEvent(events);
  if (failure !== undefined) {
    throw new Error(failure);
  }
  throw new Error("Latest DeepSeek Harness version check did not return structured data.");
}

async function isRuntimeProcessRunning(pid: string | undefined): Promise<boolean> {
  if (pid === undefined || !/^[1-9][0-9]*$/.test(pid)) {
    return false;
  }

  try {
    const result = await executeRuntimeCommand(
      bashCommand([
        buildRuntimeEventEmitterScript(),
        buildRuntimeProcessCheckScript(),
        `is_deepseek_harness_process ${shellQuote(pid)} report`,
      ].join("\n")),
      10000
    );
    return parseRuntimeEvents(result.output).some(
      (runtimeEvent) => runtimeEvent.type === "process_status" && runtimeEvent.running
    );
  } catch (error) {
    console.error("DeepSeek Harness process state check failed", error);
    return false;
  }
}

async function buildStartupDiagnostic(message: string): Promise<string> {
  const logTail = await readLinuxLogTail();
  if (logTail === undefined) {
    return message;
  }
  return `${message}\n\nLinux runtime log:\n${logTail}`;
}

function readInstallResultEvent(
  events: DeepSeekHarnessRuntimeEvent[]
): DeepSeekHarnessInstallResultRuntimeEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const runtimeEvent = events[index];
    if (runtimeEvent !== undefined && runtimeEvent.type === "install_result") {
      return runtimeEvent;
    }
  }
  return undefined;
}

function buildInstallDiagnostic(output: string): string {
  const events = parseRuntimeEvents(output);
  const installResult = readInstallResultEvent(events);
  const recentOutput = events
    .filter(
      (runtimeEvent): runtimeEvent is DeepSeekHarnessInstallOutputRuntimeEvent =>
        runtimeEvent.type === "install_output"
    )
    .slice(-8)
    .map((runtimeEvent) => runtimeEvent.output)
    .join("\n")
    .trim();
  if (installResult !== undefined) {
    const details: string[] = [];
    if (installResult.message !== undefined) {
      details.push(installResult.message);
    }
    if (installResult.command !== undefined) {
      details.push(`执行命令: ${installResult.command}`);
    }
    if (installResult.exitCode !== undefined) {
      details.push(`命令退出码: ${installResult.exitCode}`);
    }
    if (recentOutput) {
      details.push(`命令输出:\n${recentOutput}`);
    }
    return details.join("\n\n");
  }
  const rawOutput = output.trim();
  if (rawOutput) {
    return [
      "安装命令未返回结构化结果。以下是终端原始输出：",
      rawOutput.split(/\r?\n/).slice(-20).join("\n"),
    ].join("\n\n");
  }
  return "安装命令未返回结构化结果，并且终端没有产生输出。";
}

function installCompleted(
  exitCode: number,
  timedOut: boolean | undefined,
  output: string
): boolean {
  const installResult = readInstallResultEvent(parseRuntimeEvents(output));
  return (
    exitCode === 0 &&
    timedOut !== true &&
    installResult !== undefined &&
    installResult.status === "ready"
  );
}

export async function readDeepSeekHarnessWebFailure(): Promise<string> {
  const logTail = await readLinuxLogTail();
  if (logTail === undefined) {
    return "DeepSeek Harness Web stopped before the page could connect.";
  }

  const lines = logTail.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line !== undefined && line.trim()) {
      return `DeepSeek Harness Web stopped: ${line}`;
    }
  }
  return "DeepSeek Harness Web stopped before the page could connect.";
}

async function readHealth(): Promise<HealthCheckResult> {
  try {
    const response = await Tools.Net.httpGet(buildServerUrl());
    if (response.statusCode >= 200 && response.statusCode < 400) {
      return { ok: true, message: "DeepSeek Harness Web is ready." };
    }
    return {
      ok: false,
      message: `DeepSeek Harness returned HTTP ${response.statusCode}.`,
    };
  } catch {
    return { ok: false, message: "DeepSeek Harness is not reachable on the local runtime." };
  }
}

async function waitForHealth(
  onProgress: ((event: DeepSeekHarnessWebServerProgressEvent) => void) | undefined
): Promise<HealthCheckResult> {
  const deadline = Date.now() + STARTUP_HEALTH_WAIT_MS;
  let latest = await readHealth();
  while (!latest.ok && Date.now() < deadline) {
    reportProgress(onProgress, "正在等待 DeepSeek Harness Web", 88);
    await sleep(1000);
    latest = await readHealth();
  }
  return latest;
}

async function stopRuntime(): Promise<void> {
  const command = bashCommand([
    buildRuntimeEnvironment(),
    buildRuntimeEventEmitterScript(),
    buildRuntimeProcessCheckScript(),
    `if [ -f ${shellQuote(LINUX_PID_PATH)} ]; then`,
    `  pid="$(cat ${shellQuote(LINUX_PID_PATH)})"`,
    "  if is_deepseek_harness_process \"$pid\"; then",
    "    kill \"$pid\" >/dev/null 2>&1",
    "  fi",
    `  rm -f ${shellQuote(LINUX_PID_PATH)}`,
    "fi",
  ].join("\n"));
  await executeRuntimeCommand(command, 10000);
}

export async function readDeepSeekHarnessWebServerStatus(): Promise<DeepSeekHarnessWebServerStatus> {
  const [health, pid, logTail] = await Promise.all([
    readHealth(),
    readRuntimePid(),
    readLinuxLogTail(),
  ]);
  const processRunning = await isRuntimeProcessRunning(pid);
  const status = health.ok ? "running" : processRunning ? "starting" : "stopped";
  return {
    success: health.ok,
    status,
    message: processRunning && !health.ok ? "DeepSeek Harness Web is starting." : health.message,
    url: buildServerUrl(),
    port: DEFAULT_PORT,
    runtimeDir: LINUX_RUNTIME_DIR,
    dshHomeDir: DSH_HOME_DIR,
    logPath: LINUX_LOG_PATH,
    pid,
    logTail,
  };
}

export async function inspectDeepSeekHarnessRuntime(
  params: DeepSeekHarnessRuntimeInspectionParams = {}
): Promise<DeepSeekHarnessRuntimeInspection> {
  reportProgress(params.onProgress, "正在检查本地 DeepSeek Harness", 8);
  try {
    const installedVersion = await readInstalledDshVersion();
    if (installedVersion === undefined) {
      return {
        status: "uninitialized",
        message: "DeepSeek Harness 尚未初始化。",
      };
    }

    reportProgress(params.onProgress, "正在检查 DeepSeek Harness 更新", 20);
    const latestVersion = await readLatestDshVersion();
    if (installedVersion === latestVersion) {
      return {
        status: "ready",
        message: `DeepSeek Harness ${installedVersion} 已是最新版本。`,
        installedVersion,
        latestVersion,
      };
    }
    return {
      status: "update_available",
      message: `发现 DeepSeek Harness ${latestVersion}。`,
      installedVersion,
      latestVersion,
    };
  } catch (error) {
    console.error("DeepSeek Harness runtime inspection failed", error);
    const diagnostic = error instanceof Error ? error.message : String(error);
    return {
      status: "failed",
      message: "无法完成 DeepSeek Harness 版本检查。",
      diagnostic,
    };
  }
}

function buildNodePtySetupScript(): string {
  // The Android Linux container can make node-gyp's Release output a symlink
  // into obj.target. node-pty's postinstall removes obj.target afterwards,
  // so keep a dereferenced native binary before validating the module. pnpm
  // reserves the install command for dependency installation, so invoke its
  // bundled node-gyp entry directly instead of running the package lifecycle.
  return [
    "node_pty_store_dir=\"$(find node_modules/.pnpm -maxdepth 1 -type d -name 'node-pty@*' -print -quit)\"",
    "if [ -z \"$node_pty_store_dir\" ]; then",
    "  runtime_fail 15 'node-pty was not installed with the DeepSeek Harness runtime.' 'find node_modules/.pnpm -maxdepth 1 -type d -name node-pty@*'",
    "fi",
    "node_pty_dir=\"$node_pty_store_dir/node_modules/node-pty\"",
    "node_pty_release_path=\"$node_pty_dir/build/Release/pty.node\"",
    "if [ ! -f \"$node_pty_release_path\" ]; then",
    "  node_gyp_script=\"$(find /usr/lib/node_modules /usr/local/lib/node_modules /root/.local/share/pnpm -path '*/node-gyp/bin/node-gyp.js' -type f -print -quit 2>/dev/null)\"",
    "  if [ -z \"$node_gyp_script\" ]; then",
    "    runtime_fail 17 'pnpm node-gyp entry was not found in the Linux runtime.' 'find pnpm node-gyp/bin/node-gyp.js'",
    "  fi",
    "  if ! (cd \"$node_pty_dir\" && node \"$node_gyp_script\" rebuild --nodedir=/usr) 2>&1 | runtime_output; then",
    "    runtime_fail 16 'node-pty native module build failed.' 'node node-gyp.js rebuild --nodedir=/usr'",
    "  fi",
    "fi",
    "if [ ! -f \"$node_pty_release_path\" ]; then",
    "  runtime_fail 16 'node-pty native module build did not produce build/Release/pty.node.' 'test -f node-pty/build/Release/pty.node'",
    "fi",
    "if [ -L \"$node_pty_release_path\" ]; then",
    "  node_pty_copy_path=\"$node_pty_release_path.operit-copy\"",
    "  if ! cp -L \"$node_pty_release_path\" \"$node_pty_copy_path\"; then",
    "    runtime_fail 16 'node-pty native module copy failed.' 'cp -L node-pty/build/Release/pty.node'",
    "  fi",
    "  if ! rm -f \"$node_pty_release_path\"; then",
    "    runtime_fail 16 'node-pty native module replacement failed.' 'rm -f node-pty/build/Release/pty.node'",
    "  fi",
    "  if ! mv \"$node_pty_copy_path\" \"$node_pty_release_path\"; then",
    "    runtime_fail 16 'node-pty native module finalization failed.' 'mv node-pty/build/Release/pty.node.operit-copy node-pty/build/Release/pty.node'",
    "  fi",
    "fi",
    // find returns node_pty_dir relative to the runtime directory. Node treats a
    // path without ./ as a package name, so this must be an explicit file path.
    "if ! node -e \"require(process.argv[1])\" \"./$node_pty_dir\" 2>&1 | runtime_output; then",
    "  runtime_fail 18 'node-pty native module could not be loaded.' 'node -e require(node-pty)'",
    "fi",
  ].join("\n");
}

function buildRuntimeProcessCheckScript(): string {
  return [
    "is_deepseek_harness_process() {",
    "  runtime_pid=\"$1\"",
    "  if [ -z \"$runtime_pid\" ] || ! kill -0 \"$runtime_pid\" >/dev/null 2>&1; then",
    "    return 1",
    "  fi",
    `  if tr '\\0' '\\n' < \"/proc/$runtime_pid/environ\" 2>/dev/null | grep -Fx ${shellQuote(DSH_PROCESS_MARKER_ENV)} >/dev/null; then`,
    "    if [ \"$2\" = report ]; then",
    "      runtime_event process_status true",
    "    fi",
    "    return 0",
    "  fi",
    "  return 1",
    "}",
  ].join("\n");
}

function buildNativeBuildToolsPreparationScript(): string {
  return [
    "if ! command -v gcc >/dev/null 2>&1 || ! command -v g++ >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1; then",
    "  export DEBIAN_FRONTEND=noninteractive",
    "  runtime_progress 35 '正在配置 Linux 软件包'",
    "  if ! dpkg --configure -a 2>&1 | runtime_output; then",
    "    runtime_fail 23 'Linux package configuration failed before DeepSeek Harness installation.' 'dpkg --configure -a'",
    "  fi",
    "  runtime_progress 40 '正在更新 Linux 软件包索引'",
    "  if ! apt-get update 2>&1 | runtime_output; then",
    "    runtime_fail 23 'Linux package index update failed before DeepSeek Harness installation.' 'apt-get update'",
    "  fi",
    "  runtime_progress 46 '正在安装 Linux 编译工具'",
    "  if ! apt-get install -y --no-install-recommends build-essential 2>&1 | runtime_output; then",
    "    runtime_fail 23 'build-essential installation failed before DeepSeek Harness installation.' 'apt-get install -y --no-install-recommends build-essential'",
    "  fi",
    "fi",
  ].join("\n");
}

function buildPnpmBuildApprovalScript(): string {
  const config = [
    "allowBuilds:",
    ...DSH_ALLOWED_BUILD_PACKAGES.map((packageName) => `  ${JSON.stringify(packageName)}: true`),
    "",
  ].join("\n");
  return `printf %s ${shellQuote(config)} > ${shellQuote(PNPM_WORKSPACE_PATH)}`;
}

async function installRuntime(
  onProgress: ((event: DeepSeekHarnessWebServerProgressEvent) => void) | undefined
) {
  const command = bashCommand([
    buildRuntimeEnvironment(),
    "if ! command -v node >/dev/null 2>&1; then",
    `  printf '%s\\n' ${shellQuote(JSON.stringify({
      type: "install_result",
      status: "failed",
      message: "Node.js is required in the Linux runtime.",
      command: "command -v node",
      exitCode: 11,
    }))}`,
    "  exit 11",
    "fi",
    buildRuntimeEventEmitterScript(),
    "set -o pipefail",
    "runtime_progress() { runtime_event install_progress \"$1\" \"$2\"; }",
    "runtime_fail() { runtime_event install_result failed \"$2\" \"$3\" \"$1\"; exit \"$1\"; }",
    "runtime_progress 20 '正在检查 Node.js 与 pnpm'",
    "if ! command -v pnpm >/dev/null 2>&1; then",
    "  runtime_fail 12 'pnpm is required in the Linux runtime.' 'command -v pnpm'",
    "fi",
    `cd ${shellQuote(LINUX_RUNTIME_DIR)}`,
    buildNativeBuildToolsPreparationScript(),
    "runtime_progress 52 '正在配置 pnpm 依赖构建策略'",
    buildPnpmBuildApprovalScript(),
    "if [ ! -f package.json ]; then",
    "  runtime_progress 56 '正在创建 DeepSeek Harness 运行时'",
    "  if ! pnpm init 2>&1 | runtime_output; then",
    "    runtime_fail 20 'DeepSeek Harness runtime package initialization failed.' 'pnpm init'",
    "  fi",
    "fi",
    "runtime_progress 64 '正在下载 DeepSeek Harness'",
    `if ! pnpm add --prod ${DSH_PACKAGE_SPEC} --reporter=append-only 2>&1 | runtime_output; then`,
    `  runtime_fail 21 'Failed to install ${DSH_PACKAGE_SPEC}.' 'pnpm add --prod ${DSH_PACKAGE_SPEC} --reporter=append-only'`,
    "fi",
    "runtime_progress 76 '正在执行依赖构建脚本'",
    "if ! pnpm install --prod --reporter=append-only 2>&1 | runtime_output; then",
    "  runtime_fail 22 'Failed to run approved DeepSeek Harness dependency build scripts.' 'pnpm install --prod --reporter=append-only'",
    "fi",
    "if [ ! -x node_modules/.bin/dsh ]; then",
    "  runtime_fail 13 'DeepSeek Harness CLI was not installed.' 'test -x node_modules/.bin/dsh'",
    "fi",
    "if ! installed_version=\"$(node -p \"require('./node_modules/@deepseek-ai/dsh/package.json').version\")\"; then",
    "  runtime_fail 14 'Could not read the installed DeepSeek Harness version.' 'node -p require(@deepseek-ai/dsh/package.json).version'",
    "fi",
    "if [ -z \"$installed_version\" ]; then",
    "  runtime_fail 14 'Installed DeepSeek Harness version is empty.' 'test -n installed_version'",
    "fi",
    "runtime_progress 86 '正在准备 node-pty 原生模块'",
    buildNodePtySetupScript(),
    "runtime_progress 96 '正在验证 DeepSeek Harness'",
    "if ! ./node_modules/.bin/dsh --version 2>&1 | runtime_output; then",
    "  runtime_fail 19 'DeepSeek Harness CLI could not be executed.' './node_modules/.bin/dsh --version'",
    "fi",
    "runtime_event install_result ready",
  ].join("\n"));
  return executeRuntimeCommandStreaming(command, 300000, onProgress);
}

export async function installDeepSeekHarnessRuntime(
  params: DeepSeekHarnessRuntimeInspectionParams = {}
): Promise<DeepSeekHarnessRuntimeInstallResult> {
  reportProgress(params.onProgress, "正在准备 DeepSeek Harness 安装", 12);
  try {
    const installResult = await installRuntime(params.onProgress);
    if (installCompleted(installResult.exitCode, installResult.timedOut, installResult.output)) {
      return {
        success: true,
        message: "DeepSeek Harness 已安装。",
      };
    }
    const structuredResult = readInstallResultEvent(parseRuntimeEvents(installResult.output));
    return {
      success: false,
      message: "DeepSeek Harness 安装失败。",
      executedCommand: structuredResult?.command ?? installResult.command,
      installExitCode: installResult.exitCode,
      installTimedOut: installResult.timedOut,
      installOutput: installResult.output,
      diagnostic: buildInstallDiagnostic(installResult.output),
    };
  } catch (error) {
    console.error("DeepSeek Harness runtime installation failed", error);
    const diagnostic = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: "DeepSeek Harness 安装命令无法执行。",
      diagnostic,
    };
  }
}

async function startRuntime(): Promise<string> {
  const sessionId = await getTerminalSessionId();
  const command = bashCommand([
    buildRuntimeEnvironment(),
    buildRuntimeEventEmitterScript(),
    buildRuntimeProcessCheckScript(),
    `cd ${shellQuote(LINUX_RUNTIME_DIR)}`,
    `if [ -f ${shellQuote(LINUX_PID_PATH)} ]; then`,
    `  pid="$(cat ${shellQuote(LINUX_PID_PATH)})"`,
    "  if is_deepseek_harness_process \"$pid\"; then",
    "    kill \"$pid\" >/dev/null 2>&1",
    "  fi",
    `  rm -f ${shellQuote(LINUX_PID_PATH)}`,
    "fi",
    `: > ${shellQuote(LINUX_LOG_PATH)}`,
    // Detach DSH from the terminal session so sidebar navigation cannot terminate Web and PTY work.
    `${DSH_PROCESS_MARKER_ENV} setsid nohup ./node_modules/.bin/dsh web --host ${LOOPBACK_HOST} --port ${DEFAULT_PORT} --trusted-host ${LOOPBACK_HOST}:${DEFAULT_PORT} >> ${shellQuote(LINUX_LOG_PATH)} 2>&1 &`,
    `echo $! > ${shellQuote(LINUX_PID_PATH)}`,
  ].join("\n"));
  await Tools.System.terminal.exec(sessionId, command, 10000);
  return sessionId;
}

function buildResult(
  success: boolean,
  status: DeepSeekHarnessWebServerResult["status"],
  message: string
): DeepSeekHarnessWebServerResult {
  return {
    success,
    status,
    message,
    url: buildServerUrl(),
    port: DEFAULT_PORT,
    runtimeDir: LINUX_RUNTIME_DIR,
    dshHomeDir: DSH_HOME_DIR,
    logPath: LINUX_LOG_PATH,
  };
}

export async function startDeepSeekHarnessWebServer(
  params: DeepSeekHarnessWebServerStartParams = {}
): Promise<DeepSeekHarnessWebServerResult> {
  reportProgress(params.onProgress, "正在检查 DeepSeek Harness Web", 40);
  if (!(await isDshRuntimeInstalled())) {
    return buildResult(false, "failed", "DeepSeek Harness 尚未初始化。");
  }
  const existingHealth = await readHealth();
  if (existingHealth.ok && !params.forceRestart) {
    return buildResult(true, "running", existingHealth.message);
  }

  if (params.forceRestart) {
    reportProgress(params.onProgress, "正在停止 DeepSeek Harness Web", 50);
    await stopRuntime();
  } else {
    const existingPid = await readRuntimePid();
    if (await isRuntimeProcessRunning(existingPid)) {
      reportProgress(params.onProgress, "正在等待 DeepSeek Harness Web", 80);
      const health = await waitForHealth(params.onProgress);
      if (health.ok) {
        return buildResult(true, "running", health.message);
      }

      const result = buildResult(false, "failed", "DeepSeek Harness Web is still starting.");
      result.diagnostic = await buildStartupDiagnostic(health.message);
      result.logTail = await readLinuxLogTail();
      return result;
    }
  }

  reportProgress(params.onProgress, "正在启动 DeepSeek Harness Web", 80);
  const sessionId = await startRuntime();
  const health = await waitForHealth(params.onProgress);
  if (!health.ok) {
    const result = buildResult(false, "failed", "DeepSeek Harness Web did not become ready within 2 minutes.");
    result.sessionId = sessionId;
    result.diagnostic = await buildStartupDiagnostic(health.message);
    result.logTail = await readLinuxLogTail();
    return result;
  }

  const result = buildResult(true, "started", health.message);
  result.sessionId = sessionId;
  return result;
}

export async function stopDeepSeekHarnessWebServer(): Promise<DeepSeekHarnessWebServerStatus> {
  await stopRuntime();
  let status = await readDeepSeekHarnessWebServerStatus();
  for (let attempt = 0; attempt < 10 && status.success; attempt += 1) {
    await sleep(250);
    status = await readDeepSeekHarnessWebServerStatus();
  }
  return status;
}
