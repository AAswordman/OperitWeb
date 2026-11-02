# External Intent API: `EXTERNAL_CHAT`

This document describes an external interaction interface that is **independent of the workflow system**: an external app sends a broadcast Intent (`com.ai.assistance.operit.EXTERNAL_CHAT`) to Operit to initiate a "send a message to the AI" request, and receives the execution result through another broadcast.

If you want to call via HTTP over the local network instead of a broadcast Intent, see:

- `docs/doc-src/feature-protocol/external_http_chat.md`

The HTTP interface has the same semantics as the Intent interface in this document; only the entry point differs.

The implementation of this interface is located at:

- `app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt`

Manifest registration:

- `AndroidManifest.xml` -> `.integrations.intent.ExternalChatReceiver`

---

## 1. Action

- **Request Action**: `com.ai.assistance.operit.EXTERNAL_CHAT`
- **Default reply Action**: `com.ai.assistance.operit.EXTERNAL_CHAT_RESULT`

You can also specify a custom reply action via `reply_action`.

---

## 2. Request Parameters (Intent extras)

| extra key | Type | Required | Default | Description |
|---|---:|:---:|---:|---|
| `message` | `String` | Yes | - | The text to send to the AI |
| `request_id` | `String` | No | - | Business-side request ID (returned verbatim, for correlating request/response) |
| `group` | `String` | No | - | When `create_new_chat=true`, the group for the new chat |
| `create_new_chat` | `Boolean` | No | `false` | Whether to force creating a new chat before sending the message |
| `chat_id` | `String` | No | - | Send to a specific chat (only takes effect when `create_new_chat=false`) |
| `create_if_none` | `Boolean` | No | `true` | When no `chat_id` is specified and there is currently no chat, whether automatic chat creation is allowed (set to `false` to return an error) |
| `show_floating` | `Boolean` | No | `false` | Whether to start/show the floating window service (triggers binding and starts `FloatingChatService`) |
| `return_tool_status` | `Boolean` | No | `true` | Whether to return tool-status-related content. When set to `false`, auxiliary content such as `<tool*>`, `<tool_result*>`, and `<status>` is removed from the returned `ai_response` |
| `initial_mode` | `String` | No | - | When `show_floating=true`, specifies the floating window's initial mode. Possible values: `WINDOW`, `BALL`, `VOICE_BALL`, `FULLSCREEN`, `RESULT_DISPLAY`, `SCREEN_OCR` |
| `auto_exit_after_ms` | `Long` | No | `-1` | When `show_floating=true`: timeout (in milliseconds) for automatically exiting/closing the floating window |
| `stop_after` | `Boolean` | No | `false` | Whether to stop the chat service after this request finishes (stops `FloatingChatService`) |
| `reply_action` | `String` | No | `com.ai.assistance.operit.EXTERNAL_CHAT_RESULT` | Specifies the reply broadcast action |
| `reply_package` | `String` | No | - | If specified, the reply broadcast will have `intent.setPackage(reply_package)` set, to prevent the result from being received by other apps |

---

## 3. Reply Parameters (Intent extras)

After processing completes, Operit sends a broadcast (with the action `reply_action` or the default action) carrying the following extras:

| extra key | Type | Description |
|---|---:|---|
| `request_id` | `String` | If carried in the request, returned verbatim |
| `success` | `Boolean` | Whether it succeeded |
| `chat_id` | `String` | The ID of the chat where the interaction happened (if available) |
| `ai_response` | `String` | The AI reply text (if available) |
| `error` | `String` | Error message (on failure) |

---

## 4. Behavior and Priority Rules (Simplified)

- If `message` is empty, it fails and returns directly.
- If `show_floating=true`:
  - It tries to start/connect to `FloatingChatService`.
  - The initial UI can be specified via `initial_mode`.
  - If `initial_mode` is not passed, the current/last-saved floating window mode is kept; the first-time default is `WINDOW`.
  - Automatic exit can be set via `auto_exit_after_ms`.
- If `return_tool_status=false`:
  - Tool-status-related XML is removed from the `ai_response` in the reply, reducing message size.
- If `create_new_chat=true`:
  - A new chat is created (optionally with `group`).
  - `chat_id` is not used when sending the message (`chat_id` is ignored).
- If `create_new_chat=false` and `chat_id` is non-empty:
  - It first switches to the specified chat and sends.
- If `create_new_chat=false` and `chat_id` is empty:
  - Default `create_if_none=true`: automatic creation is allowed when there is no current chat.
  - `create_if_none=false`: fails and returns if there is currently no chat.
- If `stop_after=true`: `FloatingChatService` is stopped after processing.

---

## 5. adb Examples

### 5.1 Create a New Chat + Group + Send a Message + Show the Floating Window

```bash
adb shell am broadcast \
  -a com.ai.assistance.operit.EXTERNAL_CHAT \
  --es request_id "req-001" \
  --es message "你好，帮我总结一下这段话" \
  --es group "workflow" \
  --ez create_new_chat true \
  --ez show_floating true \
  --ez return_tool_status false \
  --es initial_mode "WINDOW" \
  --el auto_exit_after_ms 10000
```

### 5.2 Send to a Specified chat_id (Without Creating a New One)

```bash
adb shell am broadcast \
  -a com.ai.assistance.operit.EXTERNAL_CHAT \
  --es request_id "req-002" \
  --es chat_id "YOUR_CHAT_ID" \
  --es message "继续刚才的话题"
```

### 5.3 Disallow Automatic Chat Creation (create_if_none=false)

If there is currently no chat and creation is not allowed, a failure is returned:

```bash
adb shell am broadcast \
  -a com.ai.assistance.operit.EXTERNAL_CHAT \
  --es request_id "req-003" \
  --es message "测试" \
  --ez create_if_none false
```

---

## 6. How to Receive the Reply After Sending

After processing completes, Operit sends a reply broadcast:

- Default action: `com.ai.assistance.operit.EXTERNAL_CHAT_RESULT`
- Or the `reply_action` you specified in the request

Note:

- `adb` itself can only be used to "send broadcasts"; it cannot directly serve as a "broadcast receiver" to print received broadcasts.

If you want **only your own app to receive the reply**, set in the request:

- `reply_package = your package name`

That way, when replying, Operit sets `intent.setPackage(reply_package)` on the broadcast.

### 6.1 Write a Minimal Receiving App / Receiver (for Debugging/Integration)

Below is a "minimal usable" receiver example (Kotlin). You only need to:

- Register a `BroadcastReceiver`
- Listen for `EXTERNAL_CHAT_RESULT` (or your custom `reply_action`)
- Read the extras in `onReceive()`

#### 6.1.1 Receiver Code Example

```kotlin
class ExternalChatResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "com.ai.assistance.operit.EXTERNAL_CHAT_RESULT") return

        val requestId = intent.getStringExtra("request_id")
        val success = intent.getBooleanExtra("success", false)
        val chatId = intent.getStringExtra("chat_id")
        val aiResponse = intent.getStringExtra("ai_response")
        val error = intent.getStringExtra("error")

        Log.d(
            "ExternalChatResult",
            "request_id=$requestId success=$success chat_id=$chatId ai_response=$aiResponse error=$error"
        )
    }
}
```

#### 6.1.2 Manifest Registration Example

Register in your app's `AndroidManifest.xml` (Android 12+ requires an explicit exported declaration):

```xml
<receiver
    android:name=".ExternalChatResultReceiver"
    android:exported="true">
    <intent-filter>
        <action android:name="com.ai.assistance.operit.EXTERNAL_CHAT_RESULT" />
    </intent-filter>
</receiver>
```

#### 6.1.3 Trigger a Request and Verify the Reply (adb + logcat)

1) First start your receiving app (keeping the process alive makes it easier to observe the log):

2) Send the request (specifying `reply_package` is recommended, to avoid the reply being received by other apps):

```bash
adb shell am broadcast \
  -a com.ai.assistance.operit.EXTERNAL_CHAT \
  --es request_id "req-101" \
  --es message "hello" \
  --es reply_package "YOUR.APP.PACKAGE"
```

3) Observe your app's log:

```bash
adb logcat | findstr ExternalChatResult
```

If `success=true`, then `ai_response` usually contains the AI reply text; on failure, check `error`.

### 6.2 Quick Reference for Reply Fields

Reply broadcast extras:

- `request_id: String?`
- `success: Boolean`
- `chat_id: String?`
- `ai_response: String?`
- `error: String?`

You can use `request_id` on the business side to correlate requests with replies.
