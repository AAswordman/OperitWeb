# External HTTP Chat API

This document describes Operit's new LAN HTTP chat interface. It is semantically consistent with the existing `EXTERNAL_CHAT` Intent interface, except that the entry point has changed from broadcast to HTTP.

## 1. Enabling

In the app, go to:

- Settings
- Data and Permissions
- External HTTP Calls

Then:

- Turn on the enable switch
- Note the listening address and Bearer Token shown on the page
- If needed, change the port and save

The default port is `8094`.

## 2. Authentication

Except for `OPTIONS`, all requests must carry:

```http
Authorization: Bearer YOUR_TOKEN
```

The Bearer Token is automatically generated when first enabled, and can also be reset on the settings page.

## 3. Endpoints

### 3.1 `GET /api/health`

Used to check service connectivity and whether authentication is working.

Example:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" "http://DEVICE_IP:8094/api/health"
```

Example response:

```json
{
  "status": "ok",
  "enabled": true,
  "service_running": true,
  "port": 8094,
  "version_name": "1.10.0+1"
}
```

### 3.2 `POST /api/external-chat`

The request body is JSON, with fields reused from the existing Intent interface:

- `request_id`
- `message`
- `group`
- `create_new_chat`
- `chat_id`
- `create_if_none`
- `show_floating`
- `return_tool_status`
- `initial_mode`
- `auto_exit_after_ms`
- `stop_after`

HTTP-only new fields:

- `stream`: when `true`, returns chunked SSE responses instead
- `response_mode`: `sync` or `async_callback`
- `callback_url`: required when `response_mode=async_callback`

Additional notes:

- `return_tool_status` defaults to `true`
- When `return_tool_status=false`, auxiliary content such as `<tool*>`, `<tool_result*>`, and `<status>` is removed from external responses, reducing transfer size
- `initial_mode` is only meaningful when `show_floating=true`
- Possible values of `initial_mode`: `WINDOW`, `BALL`, `VOICE_BALL`, `FULLSCREEN`, `RESULT_DISPLAY`, `SCREEN_OCR`
- If `show_floating=true` and `initial_mode` is not passed, the current/last saved floating window mode is reused; the first-time default is `WINDOW`
- `stream=true` and `response_mode=async_callback` cannot be used together

## 4. Synchronous Calls

Example:

```bash
curl -X POST "http://DEVICE_IP:8094/api/external-chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "message": "你好，帮我总结今天的待办",
    "response_mode": "sync",
    "show_floating": true,
    "return_tool_status": false,
    "initial_mode": "WINDOW"
  }'
```

Example response:

```json
{
  "request_id": "f0fdde0c-3f68-43c1-ae43-9d7736d6fd7d",
  "success": true,
  "chat_id": "1742558116153",
  "ai_response": "这是今天的待办总结……"
}
```

If the request itself is well-formed but chat execution fails, a JSON with the same structure is still returned, except that:

- `success = false`
- `error` carries the failure reason

## 5. SSE Streaming Responses

When `stream=true`, the endpoint returns `text/event-stream`, with each chunk in standard SSE format.

Example:

```bash
curl -N -X POST "http://DEVICE_IP:8094/api/external-chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "message": "请一步步解释这个问题",
    "stream": true,
    "show_floating": true,
    "return_tool_status": false,
    "initial_mode": "WINDOW"
  }'
```

Returned events:

- `start`: request accepted and `chat_id` obtained
- `delta`: incremental text for this chunk
- `done`: fully complete, `ai_response` is the complete result
- `error`: processing failed

Example response:

```text
event: start
data: {"event":"start","request_id":"req-001","chat_id":"1742558116153"}

event: delta
data: {"event":"delta","request_id":"req-001","chat_id":"1742558116153","delta":"你好，"}

event: delta
data: {"event":"delta","request_id":"req-001","chat_id":"1742558116153","delta":"下面我来解释。"}

event: done
data: {"event":"done","request_id":"req-001","chat_id":"1742558116153","success":true,"ai_response":"你好，下面我来解释。"}
```

Error example:

```text
event: error
data: {"event":"error","request_id":"req-001","success":false,"error":"Invalid parameter: stream=true is not compatible with async_callback"}
```

Notes:

- In SSE mode, it is recommended to explicitly send `Accept: text/event-stream`
- After the connection closes, the server attempts to cancel this AI response

## 6. Async Callback

Example:

```bash
curl -X POST "http://DEVICE_IP:8094/api/external-chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "message": "继续刚才的话题",
    "response_mode": "async_callback",
    "callback_url": "http://YOUR_PC:8080/callback"
  }'
```

Immediate response:

```json
{
  "request_id": "dca1a2e0-8f7e-4bf8-9523-a4b7bdf2fd13",
  "accepted": true,
  "status": "accepted"
}
```

After the AI finishes, Operit sends one `POST application/json` callback to `callback_url`, with a request body still of the form:

```json
{
  "request_id": "dca1a2e0-8f7e-4bf8-9523-a4b7bdf2fd13",
  "success": true,
  "chat_id": "1742558116153",
  "ai_response": "……"
}
```

Notes:

- JSON request bodies are processed as UTF-8 by default; it is recommended to explicitly send `Content-Type: application/json; charset=utf-8`
- v1 does no retries
- A non-2xx callback or network failure is only logged, with no automatic resend

## 7. Behavior Notes

- When `show_floating=true`, it attempts to start `FloatingChatService`
- When `show_floating=true` and `initial_mode` is passed, the floating window is started in that mode
- When `show_floating=true` but `initial_mode` is not passed, the current/saved mode is reused; the first-time default is `WINDOW`
- When `create_new_chat=true`, a new conversation is created before sending
- `chat_id` only takes effect when `create_new_chat=false`
- When `create_if_none=false` and there is currently no conversation, a failure is returned
- When `stop_after=true`, it attempts to stop the chat service after the request ends
- When `return_tool_status=false`, tool-status-related XML is filtered, reducing the size of `ai_response` / SSE `delta`
- When `stream=true`, the response changes to SSE; a single fixed JSON response body is no longer returned
- When `stream=true` and `response_mode=async_callback` appear together, `400 Bad Request` is returned

These semantics are consistent with the existing `EXTERNAL_CHAT` Intent interface.
