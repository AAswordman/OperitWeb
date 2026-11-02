"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStateDirectoryPath = getStateDirectoryPath;
exports.getStateFilePath = getStateFilePath;
exports.getConfigFilePath = getConfigFilePath;
exports.getServiceLogPath = getServiceLogPath;
exports.getAutoReplyStateFilePath = getAutoReplyStateFilePath;
exports.readEnv = readEnv;
exports.writeEnv = writeEnv;
exports.readTextFileWithTools = readTextFileWithTools;
exports.writeTextFileWithTools = writeTextFileWithTools;
exports.deleteFileIfExistsAsync = deleteFileIfExistsAsync;
exports.readJsonObjectFileAsync = readJsonObjectFileAsync;
exports.writeJsonObjectFileAsync = writeJsonObjectFileAsync;
exports.readPersistedConfigAsync = readPersistedConfigAsync;
exports.writePersistedConfigAsync = writePersistedConfigAsync;
exports.updatePersistedConfigAsync = updatePersistedConfigAsync;
exports.readPersistedAutoReplyStateAsync = readPersistedAutoReplyStateAsync;
exports.writePersistedAutoReplyStateAsync = writePersistedAutoReplyStateAsync;
exports.flushPersistedAutoReplyStateAsync = flushPersistedAutoReplyStateAsync;
exports.readConfigSnapshotFrom = readConfigSnapshotFrom;
exports.readConfigSnapshotAsync = readConfigSnapshotAsync;
exports.requireConfiguredSnapshotAsync = requireConfiguredSnapshotAsync;
exports.buildStatus = buildStatus;
const qqbot_common_1 = require("./qqbot_common");
const AUTO_REPLY_STATE_FILE_NAME = "auto_reply_state.json";
let stateDirectoryPathCache = "";
const cachedJsonStores = Object.create(null);
function cloneJsonObject(value) {
    return JSON.parse(JSON.stringify(value));
}
function normalizeStorePath(path) {
    return (0, qqbot_common_1.asText)(path).trim().replace(/\\/g, "/");
}
function getCachedJsonStoreEntry(path) {
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
async function readCachedJsonStoreAsync(path, sanitize) {
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
async function writeCachedJsonStoreAsync(path, value, sanitize) {
    const entry = getCachedJsonStoreEntry(path);
    const nextValue = sanitize ? sanitize(value) : value;
    entry.value = cloneJsonObject(nextValue);
    entry.loaded = true;
    entry.dirty = true;
    return cloneJsonObject(entry.value);
}
async function flushCachedJsonStoreAsync(path) {
    const entry = getCachedJsonStoreEntry(path);
    if (!entry.loaded || !entry.dirty) {
        return;
    }
    await writeJsonObjectFileAsync(path, entry.value);
    entry.dirty = false;
}
function getStateDirectoryPath() {
    if (stateDirectoryPathCache) {
        return stateDirectoryPathCache;
    }
    if (typeof getPluginConfigDir !== "function") {
        throw new Error("getPluginConfigDir is unavailable");
    }
    const path = (0, qqbot_common_1.asText)(getPluginConfigDir(qqbot_common_1.QQBOT_TOOLPKG_ID)).trim();
    if (!path) {
        throw new Error(`Failed to resolve plugin config dir for ${qqbot_common_1.QQBOT_TOOLPKG_ID}`);
    }
    stateDirectoryPathCache = path;
    return stateDirectoryPathCache;
}
function getStateFilePath(name) {
    return `${getStateDirectoryPath()}/${name}`;
}
function getConfigFilePath() {
    return getStateFilePath(qqbot_common_1.CONFIG_FILE_NAME);
}
function getServiceLogPath() {
    return getStateFilePath(qqbot_common_1.LOG_FILE_NAME);
}
function getAutoReplyStateFilePath() {
    return getStateFilePath(AUTO_REPLY_STATE_FILE_NAME);
}
function readEnv(key) {
    if (typeof getEnv !== "function") {
        return "";
    }
    const value = getEnv(key);
    return value == null ? "" : (0, qqbot_common_1.asText)(value).trim();
}
async function writeEnv(key, value) {
    await Tools.SoftwareSettings.writeEnvironmentVariable(key, value);
}
async function readTextFileWithTools(path) {
    const exists = await Tools.Files.exists(path, "android");
    if (!exists?.exists) {
        return "";
    }
    const result = await Tools.Files.read({ path, environment: "android" });
    return (0, qqbot_common_1.asText)(result?.content);
}
async function writeTextFileWithTools(path, content) {
    await Tools.Files.write(path, content, false, "android");
}
async function deleteFileIfExistsAsync(path) {
    const exists = await Tools.Files.exists(path, "android");
    if (exists?.exists) {
        await Tools.Files.deleteFile(path, false, "android");
    }
}
async function readJsonObjectFileAsync(path) {
    const raw = (await readTextFileWithTools(path)).trim();
    if (!raw) {
        return {};
    }
    return (0, qqbot_common_1.parseJsonObject)(raw);
}
async function writeJsonObjectFileAsync(path, value) {
    await writeTextFileWithTools(path, JSON.stringify(value));
}
function sanitizePersistedConfig(value) {
    const useSandbox = (0, qqbot_common_1.hasOwn)(value, "useSandbox") ? (0, qqbot_common_1.toBoolean)(value.useSandbox, false) : false;
    const listenerEnabled = (0, qqbot_common_1.hasOwn)(value, "listenerEnabled") ? (0, qqbot_common_1.toBoolean)(value.listenerEnabled, false) : false;
    const autoReply = (0, qqbot_common_1.hasOwn)(value, "autoReply") && (0, qqbot_common_1.isObject)(value.autoReply)
        ? { ...value.autoReply }
        : {};
    return {
        useSandbox,
        listenerEnabled,
        autoReply
    };
}
function sanitizeAutoReplyStateStore(value) {
    return {
        runtime: (0, qqbot_common_1.hasOwn)(value, "runtime") && (0, qqbot_common_1.isObject)(value.runtime)
            ? cloneJsonObject(value.runtime)
            : {},
        bindings: (0, qqbot_common_1.hasOwn)(value, "bindings") && (0, qqbot_common_1.isObject)(value.bindings)
            ? cloneJsonObject(value.bindings)
            : {},
        records: (0, qqbot_common_1.hasOwn)(value, "records") && (0, qqbot_common_1.isObject)(value.records)
            ? cloneJsonObject(value.records)
            : {}
    };
}
async function readPersistedConfigAsync() {
    return await readCachedJsonStoreAsync(getConfigFilePath(), sanitizePersistedConfig);
}
async function writePersistedConfigAsync(value) {
    const nextValue = await writeCachedJsonStoreAsync(getConfigFilePath(), value, sanitizePersistedConfig);
    await flushCachedJsonStoreAsync(getConfigFilePath());
    return nextValue;
}
async function updatePersistedConfigAsync(patch) {
    const current = await readPersistedConfigAsync();
    return await writePersistedConfigAsync({ ...current, ...patch });
}
async function readPersistedAutoReplyStateAsync() {
    return await readCachedJsonStoreAsync(getAutoReplyStateFilePath(), sanitizeAutoReplyStateStore);
}
async function writePersistedAutoReplyStateAsync(value) {
    return await writeCachedJsonStoreAsync(getAutoReplyStateFilePath(), value, sanitizeAutoReplyStateStore);
}
async function flushPersistedAutoReplyStateAsync() {
    await flushCachedJsonStoreAsync(getAutoReplyStateFilePath());
}
function readConfigSnapshotFrom(storedConfig, overrides) {
    const appId = overrides && (0, qqbot_common_1.hasOwn)(overrides, "appId")
        ? (0, qqbot_common_1.asText)(overrides.appId).trim()
        : readEnv(qqbot_common_1.ENV_KEYS.appId);
    const appSecret = overrides && (0, qqbot_common_1.hasOwn)(overrides, "appSecret")
        ? (0, qqbot_common_1.asText)(overrides.appSecret).trim()
        : readEnv(qqbot_common_1.ENV_KEYS.appSecret);
    const useSandboxRaw = overrides && (0, qqbot_common_1.hasOwn)(overrides, "useSandbox")
        ? overrides.useSandbox
        : storedConfig.useSandbox;
    const parsedUseSandbox = (0, qqbot_common_1.parseOptionalBoolean)(useSandboxRaw, "use_sandbox");
    return {
        appId,
        appSecret,
        useSandbox: parsedUseSandbox === true,
        listenerEnabled: (0, qqbot_common_1.toBoolean)(storedConfig.listenerEnabled, false)
    };
}
async function readConfigSnapshotAsync(overrides) {
    return readConfigSnapshotFrom(await readPersistedConfigAsync(), overrides);
}
async function requireConfiguredSnapshotAsync(overrides) {
    const snapshot = await readConfigSnapshotAsync(overrides);
    if (!snapshot.appId) {
        throw new Error("Missing env: QQBOT_APP_ID");
    }
    if (!snapshot.appSecret) {
        throw new Error("Missing env: QQBOT_APP_SECRET");
    }
    return snapshot;
}
function buildStatus(snapshot) {
    return {
        packageVersion: qqbot_common_1.PACKAGE_VERSION,
        configured: !!snapshot.appId && !!snapshot.appSecret,
        mode: "websocket_gateway",
        appId: snapshot.appId,
        appSecretMasked: (0, qqbot_common_1.maskSecret)(snapshot.appSecret),
        useSandbox: snapshot.useSandbox,
        listenerEnabled: snapshot.listenerEnabled,
        openApiBaseUrl: snapshot.useSandbox ? qqbot_common_1.SANDBOX_API_BASE_URL : qqbot_common_1.API_BASE_URL,
        gatewayApiPath: "/gateway"
    };
}
