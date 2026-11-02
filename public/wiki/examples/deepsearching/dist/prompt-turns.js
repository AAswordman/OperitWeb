"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromptTurn = createPromptTurn;
exports.normalizePromptTurnList = normalizePromptTurnList;
exports.toKotlinPromptTurnList = toKotlinPromptTurnList;
exports.createSendMessageOptions = createSendMessageOptions;
const PromptTurnClass = Java.type("com.ai.assistance.operit.core.chat.hooks.PromptTurn");
const PromptTurnKindClass = Java.type("com.ai.assistance.operit.core.chat.hooks.PromptTurnKind");
const SendMessageOptionsClass = Java.type("com.ai.assistance.operit.api.chat.EnhancedAIService$SendMessageOptions");
function createPromptTurn(kind, content, toolName, metadata) {
    const turn = {
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
function normalizePromptTurnList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const turns = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            continue;
        }
        const record = item;
        const kind = normalizePromptTurnKind(record.kind);
        if (!kind) {
            continue;
        }
        turns.push(createPromptTurn(kind, String(record.content ?? ""), typeof record.toolName === "string" ? record.toolName : undefined, isJsonObject(record.metadata) ? record.metadata : undefined));
    }
    return turns;
}
function toKotlinPromptTurnList(history) {
    return (history || []).map((turn) => new PromptTurnClass(resolvePromptTurnKind(turn.kind), String(turn.content ?? ""), typeof turn.toolName === "string" ? turn.toolName : null, isJsonObject(turn.metadata) ? turn.metadata : {}));
}
function createSendMessageOptions(options) {
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
function normalizePromptTurnKind(kind) {
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
function resolvePromptTurnKind(kind) {
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
function isJsonObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
