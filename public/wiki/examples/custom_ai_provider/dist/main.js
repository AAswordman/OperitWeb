"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
exports.listModels = listModels;
exports.sendMessage = sendMessage;
exports.testConnection = testConnection;
exports.calculateInputTokens = calculateInputTokens;
const PROVIDER_ID = "example_openai_compatible_provider";
const PROVIDER_NAME = "示例供应商";
function registerToolPkg() {
    ToolPkg.registerAiProvider({
        id: PROVIDER_ID,
        displayName: PROVIDER_NAME,
        description: "通过 ToolPkg 注册的示例 OpenAI 兼容供应商",
        listModels: { function: listModels },
        sendMessage: { function: sendMessage },
        testConnection: { function: testConnection },
        calculateInputTokens: { function: calculateInputTokens }
    });
    return true;
}
function normalizeText(value) {
    return value == null ? "" : String(value);
}
function requireConfigField(config, fieldName, displayName) {
    const value = normalizeText(config?.[fieldName]).trim();
    if (!value) {
        throw new Error(`${displayName} 不能为空`);
    }
    return value;
}
function buildHeaders(config) {
    const headers = {
        "Content-Type": "application/json"
    };
    const customHeaders = config && typeof config.customHeaders === "object" ? config.customHeaders : {};
    Object.keys(customHeaders).forEach((key) => {
        headers[key] = normalizeText(customHeaders[key]);
    });
    const apiKey = normalizeText(config.apiKey).trim();
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }
    return headers;
}
function buildModelsEndpoint(apiEndpoint) {
    const endpoint = normalizeText(apiEndpoint).trim();
    if (!endpoint) {
        throw new Error("API Endpoint 不能为空");
    }
    if (endpoint.includes("/chat/completions")) {
        return endpoint.replace(/\/chat\/completions\/?$/i, "/models");
    }
    if (endpoint.includes("/responses")) {
        return endpoint.replace(/\/responses\/?$/i, "/models");
    }
    return `${endpoint.replace(/\/+$/g, "")}/models`;
}
function mapPromptTurnsToMessages(chatHistory) {
    return (Array.isArray(chatHistory) ? chatHistory : []).map((turn) => {
        const kind = normalizeText(turn?.kind).toUpperCase();
        const content = normalizeText(turn?.content);
        if (kind === "SYSTEM") {
            return { role: "system", content };
        }
        if (kind === "ASSISTANT") {
            return { role: "assistant", content };
        }
        if (kind === "TOOL_RESULT") {
            return {
                role: "tool",
                content,
                name: normalizeText(turn?.toolName) || undefined
            };
        }
        if (kind === "TOOL_CALL") {
            return { role: "assistant", content };
        }
        return { role: "user", content };
    });
}
async function parseJsonSafely(response) {
    if (!response) {
        throw new Error("响应为空");
    }
    if (typeof response.json === "function") {
        return response.json();
    }
    const text = normalizeText(response.content || response.body || response.data);
    return text ? JSON.parse(text) : {};
}
function ensureHttpOk(response, payload) {
    const ok = response && ((typeof response.isSuccessful === "function" && response.isSuccessful()) ||
        response.ok === true ||
        response.success === true ||
        (typeof response.statusCode === "number" && response.statusCode >= 200 && response.statusCode < 300) ||
        (typeof response.code === "number" && response.code >= 200 && response.code < 300) ||
        (typeof response.status === "number" && response.status >= 200 && response.status < 300));
    if (ok) {
        return;
    }
    let bodyText = "";
    try {
        bodyText = JSON.stringify(payload);
    }
    catch {
        bodyText = normalizeText(payload);
    }
    const statusText = normalizeText(response?.statusMessage || response?.statusText || response?.message);
    const statusCode = response?.statusCode || response?.status || response?.code;
    throw new Error(`HTTP 请求失败${statusCode ? ` (${statusCode})` : ""}${statusText ? `: ${statusText}` : ""}${bodyText ? ` ${bodyText}` : ""}`);
}
function createHttpClient(timeoutMs) {
    if (typeof OkHttp === "undefined") {
        throw new Error("OkHttp 不可用");
    }
    return OkHttp.newBuilder()
        .connectTimeout(timeoutMs)
        .readTimeout(timeoutMs)
        .writeTimeout(timeoutMs)
        .build();
}
async function httpRequest(options) {
    const timeoutMs = Math.max(1, Number(options.timeoutMs || 30000));
    const client = createHttpClient(timeoutMs);
    const method = normalizeText(options.method || "GET").toUpperCase();
    const requestBuilder = client.newRequest()
        .url(options.url)
        .method(method);
    if (options.headers && Object.keys(options.headers).length > 0) {
        requestBuilder.headers(options.headers);
    }
    if (options.body !== undefined && options.body !== null && method !== "GET" && method !== "HEAD") {
        if (typeof options.body === "string") {
            requestBuilder.body(options.body, "text");
        }
        else {
            requestBuilder.body(options.body, "json");
        }
    }
    return await requestBuilder.build().execute({
        onIntermediateResult: options.onIntermediateResult
    });
}
function extractUsage(payload) {
    const usage = payload?.usage || {};
    return {
        input: Number(usage.prompt_tokens || usage.input_tokens || usage.input || 0),
        cachedInput: Number(usage.cached_tokens || usage.cached_input_tokens || usage.cachedInput || 0),
        output: Number(usage.completion_tokens || usage.output_tokens || usage.output || 0)
    };
}
function extractAssistantText(payload) {
    if (Array.isArray(payload?.choices) && payload.choices.length > 0) {
        const content = normalizeText(payload.choices[0]?.message?.content);
        if (content) {
            return content;
        }
    }
    if (Array.isArray(payload?.output) && payload.output.length > 0) {
        const text = normalizeText(payload.output[0]?.content);
        if (text) {
            return text;
        }
    }
    return "";
}
function emitChunks(text, usage) {
    if (typeof sendIntermediateResult !== "function") {
        return;
    }
    const normalized = normalizeText(text);
    if (!normalized) {
        return;
    }
    const chunkSize = 80;
    for (let index = 0; index < normalized.length; index += chunkSize) {
        sendIntermediateResult({
            chunk: normalized.slice(index, index + chunkSize)
        });
    }
    sendIntermediateResult({ usage });
}
function createStreamState() {
    return {
        buffer: "",
        text: "",
        usage: { input: 0, cachedInput: 0, output: 0 }
    };
}
function mergeUsage(current, nextUsage) {
    if (!nextUsage) {
        return current;
    }
    return {
        input: Number(nextUsage.prompt_tokens || nextUsage.input_tokens || nextUsage.input || current.input || 0),
        cachedInput: Number(nextUsage.cached_tokens || nextUsage.cached_input_tokens || nextUsage.cachedInput || current.cachedInput || 0),
        output: Number(nextUsage.completion_tokens || nextUsage.output_tokens || nextUsage.output || current.output || 0)
    };
}
function processSsePayload(state, payloadText) {
    if (!payloadText || payloadText === "[DONE]") {
        return;
    }
    const payload = JSON.parse(payloadText);
    state.usage = mergeUsage(state.usage, payload.usage);
    const deltaText = normalizeText(payload.choices?.[0]?.delta?.content) ||
        normalizeText(payload.choices?.[0]?.message?.content) ||
        extractAssistantText(payload);
    if (deltaText) {
        state.text += deltaText;
        sendIntermediateResult({ chunk: deltaText });
    }
    if (payload.usage) {
        sendIntermediateResult({ usage: state.usage });
    }
}
function processStreamChunk(state, event) {
    if (event.type !== "chunk" || !event.chunk) {
        return;
    }
    state.buffer += event.chunk;
    let separatorIndex = state.buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
        const block = state.buffer.slice(0, separatorIndex);
        state.buffer = state.buffer.slice(separatorIndex + 2);
        const dataLines = block
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .filter(Boolean);
        if (dataLines.length > 0) {
            processSsePayload(state, dataLines.join("\n"));
        }
        separatorIndex = state.buffer.indexOf("\n\n");
    }
}
async function listModels(event) {
    const config = event.eventPayload.config;
    const apiEndpoint = requireConfigField(config, "apiEndpoint", "API Endpoint");
    const response = await httpRequest({
        url: buildModelsEndpoint(apiEndpoint),
        method: "GET",
        headers: buildHeaders(config)
    });
    const payload = await parseJsonSafely(response);
    ensureHttpOk(response, payload);
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return {
        models: items
            .map((item) => {
            const id = normalizeText(item?.id).trim();
            return {
                id,
                name: id || normalizeText(item?.name).trim()
            };
        })
            .filter((item) => item.id)
    };
}
async function sendMessage(event) {
    const payload = event.eventPayload;
    const config = payload.config;
    const apiEndpoint = requireConfigField(config, "apiEndpoint", "API Endpoint");
    const modelName = requireConfigField(config, "modelName", "modelName");
    const timeoutMs = Math.max(1, Number(config.timeout || payload.timeout || 30000));
    const requestBody = {
        model: modelName,
        messages: mapPromptTurnsToMessages(payload.chatHistory),
        stream: true
    };
    const streamState = createStreamState();
    await httpRequest({
        url: apiEndpoint,
        method: "POST",
        headers: buildHeaders(config),
        body: requestBody,
        timeoutMs,
        onIntermediateResult: (streamEvent) => {
            processStreamChunk(streamState, streamEvent);
        }
    });
    if (streamState.buffer.trim()) {
        const remainingDataLines = streamState.buffer
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .filter(Boolean);
        if (remainingDataLines.length > 0) {
            processSsePayload(streamState, remainingDataLines.join("\n"));
        }
    }
    const text = streamState.text;
    const usage = streamState.usage;
    return {
        text,
        usage
    };
}
async function testConnection(event) {
    await listModels(event);
    return {
        success: true,
        message: "连接成功"
    };
}
function calculateInputTokens(event) {
    const history = event.eventPayload.chatHistory || [];
    const totalChars = history.reduce((sum, turn) => {
        return sum + normalizeText(turn?.content).length;
    }, 0);
    return {
        tokens: Math.max(1, Math.ceil(totalChars / 4))
    };
}
