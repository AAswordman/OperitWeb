# 第二名独立 critic 复验报告：integrations-external（Issue #81）

复验范围：修错后的 `integrations-external.{md,facts.json,quality.json,lint.md,status.json}`，源码 Operit @ `dbf71916`（已确认 HEAD 一致）。

## 第一轮 critic 打回项的复验结果

- 约 60 条 facts 行号错位：抽验 30 条修正过的 facts，ref 全部存在、行号无越界，断言均为真。
- 16 条 `integrations/http/`↔`integrations/externalchat/` 误写：已无残留。当前 23 处 `integrations/http/` 引用全部指向真实存在的 `integrations/http/ExternalChatHttpServer.kt`，无误写。
- [85]："独立的 @Serializable data class（非继承）"——`ExternalChatModels.kt:55-56` 确为 `@Serializable data class ExternalChatHttpRequest(`，无超类型。PASS。
- [149]/[150] 拆条：[149] 锚 `:24` 窗口 19–29 覆盖 task_type/arg1/arg2/arg3；[150] 锚 `:34` 窗口 29–39 覆盖 arg4/arg5/args_json。PASS。
- quality Q[5]/Q[8] 重锚：evidence 逐字命中。PASS。
- 正文 75 处行内引用：随机抽 20 处，行号全部合法且在界。PASS。

## 全量核验

- facts 155 条：顶层数组；ref 文件全部存在、行号无越界；severity 未混入。
- quality 10 条：顶层数组；evidence 10/10 与源码逐字命中（逐行 rstrip 后全文比对）；severity 仅 high/warn/suggestion（2/5/3）。
- 2 条 high 实锤成立：
  - Q[0] `AndroidManifest.xml:385`：`<receiver android:name=".integrations.intent.ExternalChatReceiver" android:exported="true">`，无权限声明，任意第三方应用可发 `com.ai.assistance.operit.EXTERNAL_CHAT` 广播借 Operit 身份执行聊天请求。
  - Q[1] `AndroidManifest.xml:461`：`<receiver android:name=".integrations.tasker.WorkflowTaskerReceiver" android:exported="true" android:enabled="true">`，无权限声明。
- status.json：id=integrations-external、issue=81（整数）、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、refs_valid=155（= facts 数组长度）、status=review-pending——全对。
- 禁用词：md/facts/quality/status 0 命中；lint.md 有 1 处"全部通过 ±5 窗口符号检查"（描述检查结果的中性用词，非评审表态），建议顺手改掉以绝后患。

## 发现的剩余问题（6 项，均为锚点窗口支撑不全；断言本身经核对均为真）

1. **[19] 锚点错行**：ref `:119` 的 ±5 窗口（114–124）内是 `readRequestBody` 异常分支，用的 `JSON_RPC_PARSE_ERROR`（=-32700）；断言"返回 invalid request（-32600）"对应的代码是 `parseJsonRpcRequest` 异常分支 `code = JSON_RPC_INVALID_REQUEST`，在 **:125** 行。窗口内出现的是另一个错误码，易误导。修正：ref 改为 `:125`。
2. **[33] 数字无窗口支撑**：断言"64KB"，ref `:207` 窗口内只有 `PipedInputStream(SSE_PIPE_BUFFER_SIZE)`，64*1024 的定义在 `A2aHttpHandler.kt:594`，窗口够不着。修正：改锚或改写断言（如锚 `:594` 表述为常量定义，或去掉具体数字）。
3. **[38] 断言后半无窗口支撑**：断言"有输出时才带 artifacts"，`if (task.output.isNotBlank())` 在 :308–309，ref `:291` 的 ±5 窗口（286–296）够不着。修正：ref 改为 `:305` 左右（窗口同时覆盖 taskId/contextId 与 artifacts 条件），或拆条。
4. **[76] 机制词无窗口支撑**：断言"用 CompletableDeferred"，ref `:105` 窗口（100–110）内只有 `awaitTerminalTask → findTask(taskId).awaitTerminal()`；`CompletableDeferred` 在 `A2aTaskManager.kt:180`（TaskRecord.terminalTask）。修正：ref 改为 `:180` 或 `:277`（awaitTerminal 实现）。
5. **[86] 断言后半无窗口支撑**：断言"其他值返回 null"，`else -> null` 在 `ExternalChatModels.kt:93`，ref `:84` 的 ±5 窗口（79–89）够不着（sync/async_callback 分支在 :90–91 同样出窗）。修正：ref 改为 `:91`。
6. **[91] 调用名无窗口支撑**：断言"调用 start_chat_service"，ref `:131` 窗口（126–136）内只有 `if (request.showFloating)`；`startChatService(AITool(name = "start_chat_service"…))` 在 :139–143。修正：ref 改为 `:140`。

## 结论

**verdict: FAIL**——6 处锚点窗口支撑问题需修错员单点修正（全部是重锚/小改写，断言本身为真，无事实错误）。修正后建议 parent 直接核对 6 处窗口即可，无需第三轮全量复核。critic 未修改任何交付文件。
