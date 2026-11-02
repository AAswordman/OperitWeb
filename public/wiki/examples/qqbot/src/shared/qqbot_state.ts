import {
    CONFIG_FILE_NAME,
    ENV_KEYS,
    JsonObject,
    LOG_FILE_NAME,
    PACKAGE_VERSION,
    QQBOT_TOOLPKG_ID,
    QQBotConfigSnapshot,
    API_BASE_URL,
    SANDBOX_API_BASE_URL,
    asText,
    hasOwn,
    isObject,
    maskSecret,
    parseJsonObject,
    parseOptionalBoolean,
    toBoolean
} from "./qqbot_common";

const AUTO_REPLY_STATE_FILE_NAME = "auto_reply_state.json";

type CachedJsonStoreEntry = {
    loaded: boolean;
    dirty: boolean;
    value: JsonObject;
};

let stateDirectoryPathCache = "";
const cachedJsonStores: Record<string, CachedJsonStoreEntry> = Object.create(null);

function cloneJsonObject(value: JsonObject): JsonObject {
    return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function normalizeStorePath(path: string): string {
    return asText(path).trim().replace(/\\/g, "/");
}

function getCachedJsonStoreEntry(path: string): CachedJsonStoreEntry {
    const normalizedPath = normalizeStorePath(path);
    if (!normalizedPath) {
        throw new Error("State store path is empty");
    }
    if (!cachedJsonStores[normalizedPath]) {
        cachedJsonStores[normalizedPath] = {
            loaded: false,
            dirty: false,
            value: {}
        };
    }
    return cachedJsonStores[normalizedPath];
}

async function readCachedJsonStoreAsync(
    path: string,
    sanitize?: (value: JsonObject) => JsonObject
): Promise<JsonObject> {
    const entry = getCachedJsonStoreEntry(path);
    if (!entry.loaded) {
        const raw = await readJsonObjectFileAsync(path);
        const nextValue = sanitize ? sanitize(raw) : raw;
        entry.value = cloneJsonObject(nextValue);
        entry.loaded = true;
        entry.dirty = false;
    }
    return cloneJsonObject(entry.value);
}

async function writeCachedJsonStoreAsync(
    path: string,
    value: JsonObject,
    sanitize?: (value: JsonObject) => JsonObject
): Promise<JsonObject> {
    const entry = getCachedJsonStoreEntry(path);
    const nextValue = sanitize ? sanitize(value) : value;
    entry.value = cloneJsonObject(nextValue);
    entry.loaded = true;
    entry.dirty = true;
    return cloneJsonObject(entry.value);
}

async function flushCachedJsonStoreAsync(path: string): Promise<void> {
    const entry = getCachedJsonStoreEntry(path);
    if (!entry.loaded || !entry.dirty) {
        return;
    }
    await writeJsonObjectFileAsync(path, entry.value);
    entry.dirty = false;
}

export function getStateDirectoryPath(): string {
    if (stateDirectoryPathCache) {
        return stateDirectoryPathCache;
    }
    if (typeof getPluginConfigDir !== "function") {
        throw new Error("getPluginConfigDir is unavailable");
    }
    const path = asText(getPluginConfigDir(QQBOT_TOOLPKG_ID)).trim();
    if (!path) {
        throw new Error(`Failed to resolve plugin config dir for ${QQBOT_TOOLPKG_ID}`);
    }
    stateDirectoryPathCache = path;
    return stateDirectoryPathCache;
}

export function getStateFilePath(name: string): string {
    return `${getStateDirectoryPath()}/${name}`;
}

export function getConfigFilePath(): string {
    return getStateFilePath(CONFIG_FILE_NAME);
}

export function getServiceLogPath(): string {
    return getStateFilePath(LOG_FILE_NAME);
}

export function getAutoReplyStateFilePath(): string {
    return getStateFilePath(AUTO_REPLY_STATE_FILE_NAME);
}

export function readEnv(key: string): string {
    if (typeof getEnv !== "function") {
        return "";
    }
    const value = getEnv(key);
    return value == null ? "" : asText(value).trim();
}

export async function writeEnv(key: string, value: string): Promise<void> {
    await Tools.SoftwareSettings.writeEnvironmentVariable(key, value);
}

export async function readTextFileWithTools(path: string): Promise<string> {
    const exists = await Tools.Files.exists(path, "android");
    if (!exists?.exists) {
        return "";
    }
    const result = await Tools.Files.read({ path, environment: "android" });
    return asText(result?.content);
}

export async function writeTextFileWithTools(path: string, content: string): Promise<void> {
    await Tools.Files.write(path, content, false, "android");
}

export async function deleteFileIfExistsAsync(path: string): Promise<void> {
    const exists = await Tools.Files.exists(path, "android");
    if (exists?.exists) {
        await Tools.Files.deleteFile(path, false, "android");
    }
}

export async function readJsonObjectFileAsync(path: string): Promise<JsonObject> {
    const raw = (await readTextFileWithTools(path)).trim();
    if (!raw) {
        return {};
    }
    return parseJsonObject(raw);
}

export async function writeJsonObjectFileAsync(path: string, value: JsonObject): Promise<void> {
    await writeTextFileWithTools(path, JSON.stringify(value));
}

function sanitizePersistedConfig(value: JsonObject): JsonObject {
    const useSandbox = hasOwn(value, "useSandbox") ? toBoolean(value.useSandbox, false) : false;
    const listenerEnabled = hasOwn(value, "listenerEnabled") ? toBoolean(value.listenerEnabled, false) : false;
    const autoReply = hasOwn(value, "autoReply") && isObject(value.autoReply)
        ? { ...(value.autoReply as JsonObject) }
        : {};
    return {
        useSandbox,
        listenerEnabled,
        autoReply
    };
}

function sanitizeAutoReplyStateStore(value: JsonObject): JsonObject {
    return {
        runtime: hasOwn(value, "runtime") && isObject(value.runtime)
            ? cloneJsonObject(value.runtime as JsonObject)
            : {},
        bindings: hasOwn(value, "bindings") && isObject(value.bindings)
            ? cloneJsonObject(value.bindings as JsonObject)
            : {},
        records: hasOwn(value, "records") && isObject(value.records)
            ? cloneJsonObject(value.records as JsonObject)
            : {}
    };
}

export async function readPersistedConfigAsync(): Promise<JsonObject> {
    return await readCachedJsonStoreAsync(getConfigFilePath(), sanitizePersistedConfig);
}

export async function writePersistedConfigAsync(value: JsonObject): Promise<JsonObject> {
    const nextValue = await writeCachedJsonStoreAsync(getConfigFilePath(), value, sanitizePersistedConfig);
    await flushCachedJsonStoreAsync(getConfigFilePath());
    return nextValue;
}

export async function updatePersistedConfigAsync(patch: JsonObject): Promise<JsonObject> {
    const current = await readPersistedConfigAsync();
    return await writePersistedConfigAsync({ ...current, ...patch });
}

export async function readPersistedAutoReplyStateAsync<TState extends JsonObject = JsonObject>(): Promise<TState> {
    return await readCachedJsonStoreAsync(getAutoReplyStateFilePath(), sanitizeAutoReplyStateStore) as TState;
}

export async function writePersistedAutoReplyStateAsync<TState extends JsonObject = JsonObject>(
    value: TState
): Promise<TState> {
    return await writeCachedJsonStoreAsync(
        getAutoReplyStateFilePath(),
        value,
        sanitizeAutoReplyStateStore
    ) as TState;
}

export async function flushPersistedAutoReplyStateAsync(): Promise<void> {
    await flushCachedJsonStoreAsync(getAutoReplyStateFilePath());
}

export function readConfigSnapshotFrom(storedConfig: JsonObject, overrides?: JsonObject): QQBotConfigSnapshot {
    const appId =
        overrides && hasOwn(overrides, "appId")
            ? asText(overrides.appId).trim()
            : readEnv(ENV_KEYS.appId);
    const appSecret =
        overrides && hasOwn(overrides, "appSecret")
            ? asText(overrides.appSecret).trim()
            : readEnv(ENV_KEYS.appSecret);
    const useSandboxRaw =
        overrides && hasOwn(overrides, "useSandbox")
            ? overrides.useSandbox
            : storedConfig.useSandbox;
    const parsedUseSandbox = parseOptionalBoolean(useSandboxRaw, "use_sandbox");

    return {
        appId,
        appSecret,
        useSandbox: parsedUseSandbox === true,
        listenerEnabled: toBoolean(storedConfig.listenerEnabled, false)
    };
}

export async function readConfigSnapshotAsync(overrides?: JsonObject): Promise<QQBotConfigSnapshot> {
    return readConfigSnapshotFrom(await readPersistedConfigAsync(), overrides);
}

export async function requireConfiguredSnapshotAsync(overrides?: JsonObject): Promise<QQBotConfigSnapshot> {
    const snapshot = await readConfigSnapshotAsync(overrides);
    if (!snapshot.appId) {
        throw new Error("Missing env: QQBOT_APP_ID");
    }
    if (!snapshot.appSecret) {
        throw new Error("Missing env: QQBOT_APP_SECRET");
    }
    return snapshot;
}

export function buildStatus(snapshot: QQBotConfigSnapshot): JsonObject {
    return {
        packageVersion: PACKAGE_VERSION,
        configured: !!snapshot.appId && !!snapshot.appSecret,
        mode: "websocket_gateway",
        appId: snapshot.appId,
        appSecretMasked: maskSecret(snapshot.appSecret),
        useSandbox: snapshot.useSandbox,
        listenerEnabled: snapshot.listenerEnabled,
        openApiBaseUrl: snapshot.useSandbox ? SANDBOX_API_BASE_URL : API_BASE_URL,
        gatewayApiPath: "/gateway"
    };
}
