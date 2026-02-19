# Operit External Invocation Three Methods

This page documents three external invocation entry points in Operit, based on the `assistance` project implementation:

- `app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitAssistActivity.kt`
- `app/src/main/AndroidManifest.xml`

## 1. Direct AI Message via `EXTERNAL_CHAT`

- Type: broadcast receiver
- Action: `com.ai.assistance.operit.EXTERNAL_CHAT`
- Entry: `ExternalChatReceiver`
- Purpose: send a message to AI and receive callback fields

Core extras:

- `message` required
- `request_id`
- `create_new_chat`
- `chat_id`
- `create_if_none`
- `show_floating`
- `auto_exit_after_ms`
- `stop_after`
- `reply_action`
- `reply_package`

Default callback action:

- `com.ai.assistance.operit.EXTERNAL_CHAT_RESULT`

Callback extras:

- `success`
- `request_id`
- `chat_id`
- `ai_response`
- `error`

Recommended (explicit component):

```bash
adb shell am broadcast \
  --user 0 \
  -n com.ai.assistance.operit/.integrations.intent.ExternalChatReceiver \
  -a com.ai.assistance.operit.EXTERNAL_CHAT \
  --es request_id "req-001" \
  --es message "Summarize this text" \
  --ez create_new_chat true \
  --es group "workflow" \
  --ez show_floating true \
  --el auto_exit_after_ms 10000
```

Optional extras:

- stop service after completion: `--ez stop_after true`
- custom callback action: `--es reply_action "com.example.YOUR_RESULT_ACTION"`
- callback package limit: `--es reply_package "com.example.yourapp"`

If it does not work, check:

- use explicit receiver component (`-n ...ExternalChatReceiver`)
- `message` is not empty
- target package is correct (`com.ai.assistance.operit`)
- inspect logs:

```bash
adb logcat -s ExternalChatReceiver StandardChatManagerTool FloatingChatService
```

## 2. Trigger Workflow via Intent Trigger

- Type: broadcast receiver
- Entry: `WorkflowTaskerReceiver`
- Common actions:
  - `com.ai.assistance.operit.TRIGGER_WORKFLOW`
  - `com.twofortyfouram.locale.intent.action.FIRE_SETTING`
- Match rule: workflow trigger node where `triggerType` is `intent` and configured action equals `intent.action`

Notes:

- extras are converted to `Map<String, String>` and passed to workflow trigger context
- one action can trigger multiple enabled workflows
- explicit broadcast with component is recommended for reliable delivery

```bash
adb shell am broadcast \
  -n com.ai.assistance.operit/.integrations.tasker.WorkflowTaskerReceiver \
  -a com.example.myapp.TRIGGER_OPERIT_WORKFLOW_A \
  --es message "hello from adb" \
  --es request_id "req-1001"
```

## 3. Assistant Entry via `ASSIST` Action

- Type: activity launch
- Entry: `OperitAssistActivity`
- Supported actions:
  - `android.intent.action.ASSIST`
  - `android.intent.action.VOICE_ASSIST`
- Purpose: launch Operit assistant entry, then start `FloatingChatService` and auto enter voice chat

Behavior:

- sets `INITIAL_MODE` to `FULLSCREEN`
- sets `AUTO_ENTER_VOICE_CHAT` to `true`
- no direct message callback like `EXTERNAL_CHAT`

```bash
adb shell am start \
  -n com.ai.assistance.operit/.services.assistant.OperitAssistActivity \
  -a android.intent.action.ASSIST
```

```bash
adb shell am start \
  -n com.ai.assistance.operit/.services.assistant.OperitAssistActivity \
  -a android.intent.action.VOICE_ASSIST
```
