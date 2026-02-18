# Operit 外部调用 三种方式

本文档说明 Operit 目前可用的三种外部调用入口，均基于 `assistance` 项目实现：

- `app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitAssistActivity.kt`
- `app/src/main/AndroidManifest.xml`

## 1. 直接发消息给 AI：`EXTERNAL_CHAT`

- 类型：广播 `BroadcastReceiver`
- Action：`com.ai.assistance.operit.EXTERNAL_CHAT`
- 入口：`ExternalChatReceiver`
- 用途：外部应用直接请求 Operit 发一条消息给 AI，并接收结果回传

### 关键参数 extras

- `message` 必填，发送给 AI 的消息
- `request_id` 请求 ID，回传时原样带回
- `create_new_chat` 是否新建会话
- `chat_id` 指定会话发送
- `create_if_none` 无当前会话时是否自动创建，默认 `true`
- `show_floating` 是否启动悬浮窗服务
- `auto_exit_after_ms` 悬浮窗自动退出时间
- `stop_after` 执行后是否停止服务
- `reply_action` 自定义回传 action
- `reply_package` 限定回传给指定包名

### 回传字段 广播

默认回传 action：`com.ai.assistance.operit.EXTERNAL_CHAT_RESULT`

- `success` 是否成功
- `request_id` 可选
- `chat_id` 可选
- `ai_response` 可选
- `error` 可选

### adb 示例

```bash
adb shell am broadcast \
  -a com.ai.assistance.operit.EXTERNAL_CHAT \
  --es request_id "req-001" \
  --es message "你好，帮我总结一下这段文本" \
  --ez create_new_chat true \
  --es group "workflow" \
  --ez show_floating true \
  --el auto_exit_after_ms 10000
```

## 2. 触发工作流：Intent Trigger

- 类型：广播 `BroadcastReceiver`
- 入口：`WorkflowTaskerReceiver`
- 主要 action：
  - `com.ai.assistance.operit.TRIGGER_WORKFLOW`
  - `com.twofortyfouram.locale.intent.action.FIRE_SETTING`
- 用途：匹配工作流里 `triggerType == "intent"` 且 `triggerConfig["action"] == intent.action` 的触发器

### 行为说明

- `WorkflowRepository.triggerWorkflowsByIntentEvent(intent)` 会读取 intent 的 extras，并转成 `Map<String, String>` 传给触发节点下游。
- 同一 action 可以命中多个已启用工作流。
- 若你用自定义 action，建议发显式广播（指定 component），投递更稳定。

### adb 示例 推荐显式

```bash
adb shell am broadcast \
  -n com.ai.assistance.operit/.integrations.tasker.WorkflowTaskerReceiver \
  -a com.example.myapp.TRIGGER_OPERIT_WORKFLOW_A \
  --es message "hello from adb" \
  --es request_id "req-1001"
```

## 3. 助手入口 `ASSIST` Action

- 类型：Activity 启动
- 入口：`OperitAssistActivity`
- 支持 action：
  - `android.intent.action.ASSIST`
  - `android.intent.action.VOICE_ASSIST`
- 用途：拉起 Operit 助手入口，内部会启动 `FloatingChatService` 并自动进入语音对话

### 行为说明

`OperitAssistActivity` 收到 Intent 后会：

- 启动 `FloatingChatService`
- 设置 `INITIAL_MODE = FULLSCREEN`
- 设置 `AUTO_ENTER_VOICE_CHAT = true`

该入口用于唤起助手，不是直接发消息并回传结果，所以没有 `EXTERNAL_CHAT` 那类回传字段。

### adb 示例

```bash
adb shell am start \
  -n com.ai.assistance.operit/.services.assistant.OperitAssistActivity \
  -a android.intent.action.ASSIST
```

或：

```bash
adb shell am start \
  -n com.ai.assistance.operit/.services.assistant.OperitAssistActivity \
  -a android.intent.action.VOICE_ASSIST
```

## 如何选用

- 你要“发消息并拿结果”：用 `EXTERNAL_CHAT`
- 你要“触发已有工作流编排”：用 Intent Trigger
- 你要唤起 Operit 助手界面或语音入口：用 `ASSIST` / `VOICE_ASSIST`

## 注意事项

- `ExternalChatReceiver` 与 `WorkflowTaskerReceiver` 在 Manifest 中是 `exported=true`，外部可调用，建议在业务侧加白名单或签名校验策略。
- `adb` 可用于发送调用，但不能直接当回传广播接收端；要看回传请用接收端 App/Tasker 或日志。
