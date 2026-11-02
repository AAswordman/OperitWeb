package com.ai.assistance.operit.core.tools.javascript

import org.json.JSONObject
import org.json.JSONTokener

internal data class JsExecutionFailure(
    val message: String,
    val dataText: String
)

internal fun buildJsExecutionErrorPayload(message: String): String =
    JSONObject()
        .put("success", false)
        .put("message", message.trim())
        .toString()

internal fun extractJsExecutionFailure(raw: Any?): JsExecutionFailure? {
    val text = raw?.toString()?.trim().orEmpty()
    if (text.isEmpty()) {
        return null
    }
    val parsed = runCatching { JSONTokener(text).nextValue() }.getOrNull() as? JSONObject ?: return null
    if (!parsed.has("success") || parsed.optBoolean("success", true)) {
        return null
    }

    val message = parsed.optString("message").trim()
    val dataText =
        if (parsed.has("data") && !parsed.isNull("data")) {
            parsed.get("data").toString()
        } else {
            ""
        }

    return JsExecutionFailure(
        message = message,
        dataText = dataText
    )
}

internal fun extractJsExecutionErrorMessage(raw: Any?): String? {
    return extractJsExecutionFailure(raw)?.message?.ifEmpty { null }
}

internal fun decodeJsExecutionResultValue(raw: Any?): Any? {
    if (raw !is String) {
        return raw
    }
    val text = raw.trim()
    if (text.isEmpty()) {
        return JSONObject.NULL
    }
    return JSONTokener(text).nextValue()
}
