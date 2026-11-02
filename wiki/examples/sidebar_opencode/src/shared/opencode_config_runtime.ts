const OPENCODE_CONFIG_DIR = "/root/.config/opencode";
const OPENCODE_CONFIG_PATH = `${OPENCODE_CONFIG_DIR}/opencode.json`;

export interface OpenCodeConfigReadResult {
  success: boolean;
  exists: boolean;
  path: string;
  content: string;
  parsed: Record<string, unknown> | null;
  message?: string;
}

export interface OpenCodeConfigWriteResult {
  success: boolean;
  path: string;
  content: string;
  parsed: Record<string, unknown>;
  message?: string;
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stripJsonComments(raw: string): string {
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
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
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

function stripTrailingCommas(raw: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
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

function normalizeJsonLikeText(raw: string): string {
  return stripTrailingCommas(stripJsonComments(raw)).trim();
}

function ensureObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function parseObjectJson(raw: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonLikeText(String(raw || "")));
  } catch (error) {
    throw new Error(
      `${label} must be valid JSON or JSONC: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return ensureObject(parsed, label);
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = next[key];
    if (
      baseValue &&
      patchValue &&
      typeof baseValue === "object" &&
      typeof patchValue === "object" &&
      !Array.isArray(baseValue) &&
      !Array.isArray(patchValue)
    ) {
      next[key] = deepMerge(
        baseValue as Record<string, unknown>,
        patchValue as Record<string, unknown>
      );
      continue;
    }
    next[key] = patchValue;
  }
  return next;
}

async function ensureConfigDir(): Promise<void> {
  await Tools.Files.mkdir(OPENCODE_CONFIG_DIR, true, "linux");
}

async function readConfigText(): Promise<{ exists: boolean; content: string }> {
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

async function writeConfigObject(
  config: Record<string, unknown>,
  message: string
): Promise<OpenCodeConfigWriteResult> {
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

export async function readOpenCodeGlobalConfig(): Promise<OpenCodeConfigReadResult> {
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

export async function writeOpenCodeGlobalConfig(params?: {
  config_json?: string;
}): Promise<OpenCodeConfigWriteResult> {
  const config = parseObjectJson(String(params?.config_json || ""), "config_json");
  return await writeConfigObject(config, "OpenCode global config written.");
}

export async function mergeOpenCodeGlobalConfig(params?: {
  patch_json?: string;
}): Promise<OpenCodeConfigWriteResult> {
  const patch = parseObjectJson(String(params?.patch_json || ""), "patch_json");
  const current = await readOpenCodeGlobalConfig();
  const base = current.parsed || {};
  const merged = deepMerge(base, patch);
  return await writeConfigObject(merged, "OpenCode global config merged.");
}
