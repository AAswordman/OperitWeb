"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOpenCodeGlobalConfig = readOpenCodeGlobalConfig;
exports.writeOpenCodeGlobalConfig = writeOpenCodeGlobalConfig;
exports.mergeOpenCodeGlobalConfig = mergeOpenCodeGlobalConfig;
const OPENCODE_CONFIG_DIR = "/root/.config/opencode";
const OPENCODE_CONFIG_PATH = `${OPENCODE_CONFIG_DIR}/opencode.json`;
function prettyJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}
function stripJsonComments(raw) {
    let output = "";
    let inString = false;
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let index = 0; index < raw.length; index += 1) {
        const char = raw[index];
        const next = raw[index + 1];
        if (inLineComment) {
            if (char === "\n") {
                inLineComment = false;
                output += char;
            }
            continue;
        }
        if (inBlockComment) {
            if (char === "*" && next === "/") {
                inBlockComment = false;
                index += 1;
            }
            continue;
        }
        if (inString) {
            output += char;
            if (escaped) {
                escaped = false;
            }
            else if (char === "\\") {
                escaped = true;
            }
            else if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
            output += char;
            continue;
        }
        if (char === "/" && next === "/") {
            inLineComment = true;
            index += 1;
            continue;
        }
        if (char === "/" && next === "*") {
            inBlockComment = true;
            index += 1;
            continue;
        }
        output += char;
    }
    return output;
}
function stripTrailingCommas(raw) {
    let output = "";
    let inString = false;
    let escaped = false;
    for (let index = 0; index < raw.length; index += 1) {
        const char = raw[index];
        if (inString) {
            output += char;
            if (escaped) {
                escaped = false;
            }
            else if (char === "\\") {
                escaped = true;
            }
            else if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
            output += char;
            continue;
        }
        if (char === ",") {
            let cursor = index + 1;
            while (cursor < raw.length && /\s/.test(raw[cursor])) {
                cursor += 1;
            }
            const nextSignificant = raw[cursor];
            if (nextSignificant === "}" || nextSignificant === "]") {
                continue;
            }
        }
        output += char;
    }
    return output;
}
function normalizeJsonLikeText(raw) {
    return stripTrailingCommas(stripJsonComments(raw)).trim();
}
function ensureObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be a JSON object.`);
    }
    return value;
}
function parseObjectJson(raw, label) {
    let parsed;
    try {
        parsed = JSON.parse(normalizeJsonLikeText(String(raw || "")));
    }
    catch (error) {
        throw new Error(`${label} must be valid JSON or JSONC: ${error instanceof Error ? error.message : String(error)}`);
    }
    return ensureObject(parsed, label);
}
function deepMerge(base, patch) {
    const next = { ...base };
    for (const [key, patchValue] of Object.entries(patch)) {
        const baseValue = next[key];
        if (baseValue &&
            patchValue &&
            typeof baseValue === "object" &&
            typeof patchValue === "object" &&
            !Array.isArray(baseValue) &&
            !Array.isArray(patchValue)) {
            next[key] = deepMerge(baseValue, patchValue);
            continue;
        }
        next[key] = patchValue;
    }
    return next;
}
async function ensureConfigDir() {
    await Tools.Files.mkdir(OPENCODE_CONFIG_DIR, true, "linux");
}
async function readConfigText() {
    const exists = await Tools.Files.exists(OPENCODE_CONFIG_PATH, "linux");
    if (!exists?.exists) {
        return { exists: false, content: "" };
    }
    const result = await Tools.Files.read({
        path: OPENCODE_CONFIG_PATH,
        environment: "linux",
    });
    return {
        exists: true,
        content: String(result?.content || ""),
    };
}
async function writeConfigObject(config, message) {
    await ensureConfigDir();
    const content = prettyJson(config);
    await Tools.Files.write(OPENCODE_CONFIG_PATH, content, false, "linux");
    return {
        success: true,
        path: OPENCODE_CONFIG_PATH,
        content,
        parsed: config,
        message,
    };
}
async function readOpenCodeGlobalConfig() {
    await ensureConfigDir();
    const { exists, content } = await readConfigText();
    if (!exists) {
        return {
            success: true,
            exists: false,
            path: OPENCODE_CONFIG_PATH,
            content: "",
            parsed: null,
            message: "OpenCode global config does not exist yet.",
        };
    }
    const trimmed = content.trim();
    if (!trimmed) {
        return {
            success: true,
            exists: true,
            path: OPENCODE_CONFIG_PATH,
            content,
            parsed: null,
            message: "OpenCode global config file is empty.",
        };
    }
    const parsed = parseObjectJson(trimmed, "OpenCode global config");
    return {
        success: true,
        exists: true,
        path: OPENCODE_CONFIG_PATH,
        content,
        parsed,
    };
}
async function writeOpenCodeGlobalConfig(params) {
    const config = parseObjectJson(String(params?.config_json || ""), "config_json");
    return await writeConfigObject(config, "OpenCode global config written.");
}
async function mergeOpenCodeGlobalConfig(params) {
    const patch = parseObjectJson(String(params?.patch_json || ""), "patch_json");
    const current = await readOpenCodeGlobalConfig();
    const base = current.parsed || {};
    const merged = deepMerge(base, patch);
    return await writeConfigObject(merged, "OpenCode global config merged.");
}
