import type { JavaBridgeValue } from "../../types/java-bridge";

const PromptTurnClass = Java.type("com.ai.assistance.operit.core.chat.hooks.PromptTurn");
const PromptTurnKindClass = Java.type("com.ai.assistance.operit.core.chat.hooks.PromptTurnKind");
const SendMessageOptionsClass = Java.type(
  "com.ai.assistance.operit.api.chat.EnhancedAIService$SendMessageOptions"
);

export type PromptTurn = ToolPkg.PromptTurn;
export type PromptTurnKind = ToolPkg.PromptTurnKind;

export function createPromptTurn(
  kind: PromptTurnKind,
  content: string,
  toolName?: string | null,
  metadata?: ToolPkg.JsonObject
): PromptTurn {
  const turn: PromptTurn = {
    kind,
    content: String(content ?? ""),
  };
  if (typeof toolName === "string" && toolName.length > 0) {
    turn.toolName = toolName;
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    turn.metadata = metadata;
  }
  return turn;
}

export function normalizePromptTurnList(value: unknown): PromptTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const turns: PromptTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Partial<PromptTurn>;
    const kind = normalizePromptTurnKind(record.kind);
    if (!kind) {
      continue;
    }

    turns.push(
      createPromptTurn(
        kind,
        String(record.content ?? ""),
        typeof record.toolName === "string" ? record.toolName : undefined,
        isJsonObject(record.metadata) ? record.metadata : undefined
      )
    );
  }
  return turns;
}

export function toKotlinPromptTurnList(history: PromptTurn[]): JavaBridgeValue[] {
  return (history || []).map((turn) =>
    new PromptTurnClass(
      resolvePromptTurnKind(turn.kind),
      String(turn.content ?? ""),
      typeof turn.toolName === "string" ? turn.toolName : null,
      isJsonObject(turn.metadata) ? turn.metadata : {}
    )
  );
}

export interface SendMessageBridgeOptions {
  message: string;
  chatId?: string | null;
  chatHistory: PromptTurn[];
  maxTokens: number;
  tokenUsageThreshold: number;
  workspacePath?: string | null;
  customSystemPromptTemplate?: string | null;
  isSubTask: boolean;
  proxySenderName?: string | null;
  enableMemoryAutoUpdate?: boolean;
  callbacks?: {
    onNonFatalError?: (error: string) => unknown;
    onTokenLimitExceeded?: () => unknown;
    onToolInvocation?: (toolName: string) => unknown;
  } | null;
}

export function createSendMessageOptions(
  options: SendMessageBridgeOptions
): JavaBridgeValue {
  const javaOptions = new SendMessageOptionsClass();
  javaOptions.message = String(options.message ?? "");
  javaOptions.chatId = options.chatId ?? null;
  javaOptions.chatHistory = toKotlinPromptTurnList(options.chatHistory || []);
  javaOptions.maxTokens = Number(options.maxTokens);
  javaOptions.tokenUsageThreshold = Number(options.tokenUsageThreshold);
  javaOptions.workspacePath = options.workspacePath ?? null;
  javaOptions.customSystemPromptTemplate = options.customSystemPromptTemplate ?? null;
  javaOptions.subTask = Boolean(options.isSubTask);
  javaOptions.proxySenderName = options.proxySenderName ?? null;
  javaOptions.enableMemoryAutoUpdate = options.enableMemoryAutoUpdate ?? true;
  javaOptions.callbacks = options.callbacks ?? null;
  return javaOptions;
}

function normalizePromptTurnKind(kind: unknown): PromptTurnKind | null {
  const normalized = String(kind ?? "").trim().toUpperCase();
  switch (normalized) {
    case "SYSTEM":
    case "USER":
    case "ASSISTANT":
    case "TOOL_CALL":
    case "TOOL_RESULT":
    case "SUMMARY":
      return normalized;
    default:
      return null;
  }
}

function resolvePromptTurnKind(kind: PromptTurnKind): JavaBridgeValue {
  switch (kind) {
    case "SYSTEM":
      return PromptTurnKindClass.SYSTEM;
    case "ASSISTANT":
      return PromptTurnKindClass.ASSISTANT;
    case "TOOL_CALL":
      return PromptTurnKindClass.TOOL_CALL;
    case "TOOL_RESULT":
      return PromptTurnKindClass.TOOL_RESULT;
    case "SUMMARY":
      return PromptTurnKindClass.SUMMARY;
    case "USER":
    default:
      return PromptTurnKindClass.USER;
  }
}

function isJsonObject(value: unknown): value is ToolPkg.JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
