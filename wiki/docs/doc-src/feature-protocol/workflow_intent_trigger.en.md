# Workflow Intent Trigger (Custom Action)

This document explains how to trigger Operit workflows via **Intent broadcasts**.

The current implementation supports:

- **Each workflow's Intent Trigger can configure its own `action`**
- External apps can trigger matching workflows by sending a broadcast (explicit broadcasts are recommended)

Relevant code:

- Receiving entry point: `app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerReceiver.kt`
- Matching and triggering: `WorkflowRepository.triggerWorkflowsByIntentEvent(intent)`

---

## 1. Core Concepts

### 1.1 TriggerNode(intent)

When a workflow's trigger node satisfies:

- `triggerType == "intent"`
- `triggerConfig["action"] == intent.action`

the workflow is triggered and executed.

### 1.2 Why Explicit Broadcasts Are Recommended

Android imposes various restrictions on implicit broadcasts (especially in the background, Android 8+ and later).

To ensure broadcasts are reliably delivered to Operit, the following is recommended:

- **Explicit broadcast**: specify the `component` (package name + Receiver class name)

This ensures delivery to Operit's `WorkflowTaskerReceiver` even when the action is custom.

---

## 2. Receiver / Component Information

- **Receiver class**: `com.ai.assistance.operit.integrations.tasker.WorkflowTaskerReceiver`
- **Package name**: `com.ai.assistance.operit`
- **Component**: `com.ai.assistance.operit/.integrations.tasker.WorkflowTaskerReceiver`

---

## 3. Configuring a Workflow's action

In the workflow editor, set the trigger to:

- **Type**: Intent
- **action**: enter the action you want external triggers to use, for example:
  - `com.example.myapp.TRIGGER_OPERIT_WORKFLOW_A`

Notes:

- An action is just a string, used for matching.
- On triggering, the intent's extras are provided to downstream nodes as the TriggerNode's output JSON (a string; fields can be extracted with ExtractNode(JSON)).

---

## 4. adb Trigger Examples

### 4.1 Method A: Explicit Broadcast (Recommended, Supports Any Custom Action)

```bash
adb shell am broadcast \
  -n com.ai.assistance.operit/.integrations.tasker.WorkflowTaskerReceiver \
  -a com.example.myapp.TRIGGER_OPERIT_WORKFLOW_A \
  --es message "hello from adb" \
  --es request_id "req-1001"
```

- `-n` specifies the component, ensuring delivery to Operit.
- `-a` is the action you configured in the workflow Trigger.
- `--es/--ez/--ei/...` are extras, which are collected by the workflow TriggerNode and output.

### 4.2 Method B: Implicit Broadcast (Only When the System Allows Delivery)

If you do not want to specify a component, you can try:

```bash
adb shell am broadcast \
  -a com.example.myapp.TRIGGER_OPERIT_WORKFLOW_A \
  --es message "hello"
```

However, this depends on the system version, ROM policy, and whether Operit can receive the implicit broadcast in the background.

### 4.3 Method C: Using the Built-in Default Action (Compatibility Usage)

If the workflow Trigger's `action` is configured with the default value:

- `com.ai.assistance.operit.TRIGGER_WORKFLOW`

then you can use:

```bash
adb shell am broadcast \
  -a com.ai.assistance.operit.TRIGGER_WORKFLOW \
  --es message "hello" \
  --es request_id "req-1002"
```

---

## 5. WORKFLOW_RESULT: Workflow Result Callback Broadcast (Demo Template Default)

In the built-in "Intent trigger + send message + callback broadcast" demo template, the tool node `send_broadcast` is used to send back the result:

- **action**: `com.ai.assistance.operit.WORKFLOW_RESULT`
- **extra_key**: `result`
- **extra_value**: the output (a string) from the `send_message_to_ai` node

You can also customize within the workflow:

- The callback action (for example, sending it back to your own app)
- The extra key/value (for example, also sending back `request_id`, `chat_id`, etc.)

---

## 6. How to Receive WORKFLOW_RESULT

`adb` itself cannot act directly as a "broadcast receiver" to print received broadcast content (it can only send broadcasts). To receive callback broadcasts, two approaches are recommended:

### 6.1 Receiving with Tasker (Most Convenient)

- In Tasker, create a Profile: Event -> System -> Intent Received
- Fill in the Action: `com.ai.assistance.operit.WORKFLOW_RESULT`
- In the Task, read the variables (usually `%result` can be used directly, or taken from the extras mapping)

### 6.2 Writing a Minimal Receiving App / Receiver (For Debugging)

In your test app, register a `BroadcastReceiver` listening for `com.ai.assistance.operit.WORKFLOW_RESULT`, and in `onReceive()` read:

- `intent.getStringExtra("result")`

Then you can use `adb logcat` to see what the receiving end prints.

---

## 7. How to Read Extras Inside a Workflow (Trigger JSON + Extract(JSON))

The TriggerNode converts the received extras into a JSON string as its output, for example:

- Received extras:
  - `message=hello`
  - `request_id=req-1001`

TriggerNode output (illustrative):

```json
{"message":"hello","request_id":"req-1001"}
```

Downstream, `ExtractNode(mode=JSON)` can be used:

- `source = NodeReference(triggerNodeId)`
- `expression = "message"`

to obtain `hello`.

---

## 8. Notes

- This Receiver is `exported=true`: any app can send broadcasts to this entry point.
- If you are concerned about abuse, it is recommended to later add a permission or perform validation/an allowlist check in the Receiver.
- Both the Receiver and scheduled Workers can cold-start the app process without an Activity. The global preferences required by workflow runtime are ready during the `Application.onCreate()` phase, so there is no need to open the main UI first.
