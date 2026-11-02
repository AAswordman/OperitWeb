"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestJson = requestJson;
exports.fetchAccessToken = fetchAccessToken;
exports.openApiRequest = openApiRequest;
exports.fetchGatewayInfo = fetchGatewayInfo;
exports.buildSendMessageBody = buildSendMessageBody;
exports.resolveTimeoutMs = resolveTimeoutMs;
const qqbot_common_1 = require("./qqbot_common");
function parseResponseJson(content) {
    const trimmed = content.trim();
    if (!trimmed) {
        return {};
    }
    try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch (_error) {
        return {};
    }
}
async function requestJson(url, method, headers, body, timeoutMs) {
    const response = await Tools.Net.http({
        url,
        method,
        headers,
        body: body || undefined,
        connect_timeout: (0, qqbot_common_1.toHttpTimeoutSeconds)(timeoutMs),
        read_timeout: (0, qqbot_common_1.toHttpTimeoutSeconds)(timeoutMs),
        validateStatus: false
    });
    const statusCode = Number(response?.statusCode == null ? 0 : response.statusCode);
    const content = (0, qqbot_common_1.asText)(response?.content);
    return {
        success: statusCode >= 200 && statusCode < 300,
        statusCode,
        contentType: (0, qqbot_common_1.asText)(response?.contentType),
        body: content,
        json: parseResponseJson(content)
    };
}
async function fetchAccessToken(snapshot, timeoutMs) {
    const result = await requestJson(qqbot_common_1.TOKEN_URL, "POST", {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8"
    }, {
        appId: snapshot.appId,
        clientSecret: snapshot.appSecret
    }, timeoutMs);
    const accessToken = (0, qqbot_common_1.firstNonBlank)((0, qqbot_common_1.asText)(result.json.access_token), (0, qqbot_common_1.asText)(result.json.accessToken));
    const expiresIn = (0, qqbot_common_1.parsePositiveInt)((0, qqbot_common_1.firstNonBlank)((0, qqbot_common_1.asText)(result.json.expires_in), (0, qqbot_common_1.asText)(result.json.expiresIn)), "expires_in", 0);
    const message = (0, qqbot_common_1.firstNonBlank)((0, qqbot_common_1.asText)(result.json.message), result.success ? "" : `HTTP ${result.statusCode}`);
    if (!result.success || !accessToken) {
        throw new Error((0, qqbot_common_1.firstNonBlank)(message, "Failed to retrieve QQ Bot access token"));
    }
    return {
        accessToken,
        expiresIn,
        tokenType: "QQBot"
    };
}
async function openApiRequest(snapshot, path, method, body, timeoutMs) {
    const token = await fetchAccessToken(snapshot, timeoutMs);
    const baseUrl = snapshot.useSandbox ? qqbot_common_1.SANDBOX_API_BASE_URL : qqbot_common_1.API_BASE_URL;
    return await requestJson(`${baseUrl}${path}`, method, {
        Accept: "application/json",
        Authorization: `${token.tokenType} ${token.accessToken}`,
        "X-Union-Appid": snapshot.appId,
        ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {})
    }, body, timeoutMs);
}
async function fetchGatewayInfo(snapshot, timeoutMs) {
    const response = await openApiRequest(snapshot, "/gateway", "GET", null, timeoutMs);
    const url = (0, qqbot_common_1.asText)(response.json.url).trim();
    if (!response.success || !url) {
        throw new Error((0, qqbot_common_1.firstNonBlank)((0, qqbot_common_1.asText)(response.json.message), response.body, "Failed to fetch QQ Bot gateway URL"));
    }
    return {
        url,
        shards: Number(response.json.shards == null ? 0 : response.json.shards),
        sessionStartLimit: response.json.session_start_limit,
        response: response.json
    };
}
function buildSendMessageBody(params) {
    const content = (0, qqbot_common_1.asText)(params.content).trim();
    if (!content) {
        throw new Error("Missing param: content");
    }
    const body = {
        content,
        msg_type: (0, qqbot_common_1.parseMessageType)(params.msg_type),
        msg_seq: (0, qqbot_common_1.parseMsgSeq)(params.msg_seq)
    };
    const msgId = (0, qqbot_common_1.asText)(params.msg_id).trim();
    if (msgId) {
        body.msg_id = msgId;
    }
    const eventId = (0, qqbot_common_1.asText)(params.event_id).trim();
    if (eventId) {
        body.event_id = eventId;
    }
    return body;
}
function resolveTimeoutMs(value) {
    return (0, qqbot_common_1.parsePositiveInt)(value, "timeout_ms", qqbot_common_1.DEFAULT_TIMEOUT_MS);
}
