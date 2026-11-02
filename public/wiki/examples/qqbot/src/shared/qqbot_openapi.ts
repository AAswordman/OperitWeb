import {
    API_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    JsonObject,
    QQBotConfigSnapshot,
    QQBotSendMessageParams,
    QQBotTokenResponse,
    RequestJsonResult,
    SANDBOX_API_BASE_URL,
    TOKEN_URL,
    asText,
    firstNonBlank,
    parseMessageType,
    parseMsgSeq,
    parsePositiveInt,
    toHttpTimeoutSeconds
} from "./qqbot_common";

function parseResponseJson(content: string): JsonObject {
    const trimmed = content.trim();
    if (!trimmed) {
        return {};
    }
    try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed as JsonObject
            : {};
    } catch (_error) {
        return {};
    }
}

export async function requestJson(
    url: string,
    method: "GET" | "POST",
    headers: Record<string, string>,
    body: JsonObject | null,
    timeoutMs: number
): Promise<RequestJsonResult> {
    const response = await Tools.Net.http({
        url,
        method,
        headers,
        body: body || undefined,
        connect_timeout: toHttpTimeoutSeconds(timeoutMs),
        read_timeout: toHttpTimeoutSeconds(timeoutMs),
        validateStatus: false
    });
    const statusCode = Number(response?.statusCode == null ? 0 : response.statusCode);
    const content = asText(response?.content);
    return {
        success: statusCode >= 200 && statusCode < 300,
        statusCode,
        contentType: asText(response?.contentType),
        body: content,
        json: parseResponseJson(content)
    };
}

export async function fetchAccessToken(
    snapshot: QQBotConfigSnapshot,
    timeoutMs: number
): Promise<QQBotTokenResponse> {
    const result = await requestJson(
        TOKEN_URL,
        "POST",
        {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8"
        },
        {
            appId: snapshot.appId,
            clientSecret: snapshot.appSecret
        },
        timeoutMs
    );

    const accessToken = firstNonBlank(asText(result.json.access_token), asText(result.json.accessToken));
    const expiresIn = parsePositiveInt(
        firstNonBlank(asText(result.json.expires_in), asText(result.json.expiresIn)),
        "expires_in",
        0
    );
    const message = firstNonBlank(asText(result.json.message), result.success ? "" : `HTTP ${result.statusCode}`);

    if (!result.success || !accessToken) {
        throw new Error(firstNonBlank(message, "Failed to retrieve QQ Bot access token"));
    }

    return {
        accessToken,
        expiresIn,
        tokenType: "QQBot"
    };
}

export async function openApiRequest(
    snapshot: QQBotConfigSnapshot,
    path: string,
    method: "GET" | "POST",
    body: JsonObject | null,
    timeoutMs: number
): Promise<RequestJsonResult> {
    const token = await fetchAccessToken(snapshot, timeoutMs);
    const baseUrl = snapshot.useSandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;
    return await requestJson(
        `${baseUrl}${path}`,
        method,
        {
            Accept: "application/json",
            Authorization: `${token.tokenType} ${token.accessToken}`,
            "X-Union-Appid": snapshot.appId,
            ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {})
        },
        body,
        timeoutMs
    );
}

export async function fetchGatewayInfo(snapshot: QQBotConfigSnapshot, timeoutMs: number): Promise<JsonObject> {
    const response = await openApiRequest(snapshot, "/gateway", "GET", null, timeoutMs);
    const url = asText(response.json.url).trim();
    if (!response.success || !url) {
        throw new Error(firstNonBlank(asText(response.json.message), response.body, "Failed to fetch QQ Bot gateway URL"));
    }
    return {
        url,
        shards: Number(response.json.shards == null ? 0 : response.json.shards),
        sessionStartLimit: response.json.session_start_limit,
        response: response.json
    };
}

export function buildSendMessageBody(params: QQBotSendMessageParams): JsonObject {
    const content = asText(params.content).trim();
    if (!content) {
        throw new Error("Missing param: content");
    }

    const body: JsonObject = {
        content,
        msg_type: parseMessageType(params.msg_type),
        msg_seq: parseMsgSeq(params.msg_seq)
    };

    const msgId = asText(params.msg_id).trim();
    if (msgId) {
        body.msg_id = msgId;
    }

    const eventId = asText(params.event_id).trim();
    if (eventId) {
        body.event_id = eventId;
    }

    return body;
}

export function resolveTimeoutMs(value: unknown): number {
    return parsePositiveInt(value, "timeout_ms", DEFAULT_TIMEOUT_MS);
}
