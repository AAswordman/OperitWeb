# Critic 复核报告：api-chat-claude（Claude 供应商）

- 复核对象：`review/batch-04/api-chat-claude.*`
- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 HEAD 一致）
- 复核方式：119 条 facts 全部做引用存在性校验；42 条符号-窗口疑点逐条人工看源码窗口判定；抽查 12 条未标记 facts；quality 5 条 evidence 逐字 grep 命中验证；正文 §9 结构检查；status.json 字段检查。

## 结论：退回修正

facts 119 条中 8 条存在引用错位或复合事实（断言超出 ref ±5 行窗口），另有 7 处轻微越界建议顺手修。quality 5 条全部通过。正文结构与 status 通过。

## 必须修（8 条）

1. **#27** `ref :253`：「`applyAnthropicUsage` 把解析结果写入 `tokenCacheManager` 并回调 `onTokensUpdated`」
   - :253±5（248-258）只看到函数签名和 `parseAnthropicUsage` 调用；`tokenCacheManager.updateActualTokens` 在 259-262，`onTokensUpdated(...)` 在 274-278。
   - 修：拆成两条事实（写入 ref→260 附近；回调 ref→274 附近）。一个 ref 盖不住两处。

2. **#95** `ref :1436`：「4xx 响应抛 `HttpStatusException`」
   - :1436±5（1431-1441）是 `catch (e: Exception) { throw e }`，与断言无关；真正的 `throw HttpStatusException(... statusCode = response.code)` 在 **1451**。
   - 修：ref → 1451。

3. **#96** `ref :1454`：「用 `peekBody(4096)` 预读响应」
   - :1454±5（1449-1459）无 peekBody；`response.peekBody(4096)` 实际在 **1468**。
   - 修：ref → 1468。

4. **#98** `ref :1479`：「`processOpenAiCompatibleJsonLines` 逐行取 delta.content，`finish_reason` 确认完成」——复合事实
   - delta.content 提取在 1485-1486（窗口内）；但 `finish_reason` 读取与判定在 1496-1509，超出 :1479±5。
   - 修：拆成两条（逐行解析 ref→1479；finish_reason ref→1503）。

5. **#100** `ref :1510`：「结果空白且 usage 未应用时抛 `provider_error_parsing_failed`」
   - :1510 是 `applyAnthropicUsage(` 调用行；`throw IOException(...provider_error_parsing_failed)` 实际在 **1556**。
   - 修：ref → 1556。

6. **#106** `ref :1747`：「`content_block_start` 的 thinking 块仅在启用 thinking 时发出 `<think>`」
   - :1747±5（1742-1752）只有 `emit(initialThinking)`；`"thinking" -> if (enableThinking)` 与 `<think>` 标签发出在 **1731-1734**。
   - 修：ref → 1731。

7. **#107** `ref :1770`：「`content_block_delta` 分别处理 `text_delta`、`thinking_delta`、`input_json_delta`」——复合事实
   - 三处分支在 1760 / 1773 / **1786**，跨度 26 行，任何一个 ±5 窗口都盖不住三条断言。
   - 修：拆成三条事实（ref 分别 →1760 / →1773 / →1786）。

8. **#109** `ref :1863`：「`message_delta` 应用 usage 并覆盖输出 token」
   - :1863±5（1858-1868）是 `message_stop` 分支内的 toolEndTag 逻辑；`message_delta` 分支在 **1837**，`applyAnthropicUsage(overwriteOutputTokens = true)` 在 1838-1842。
   - 修：ref → 1838。

## 轻微问题（建议顺手修，不阻塞但按铁律也算越界）

9. **#1** `ref :54`：「实现 `AIService` 接口」——`) : AIService {` 实际在 55，窗口覆盖（合规），建议 ref→55。
10. **#28** `ref :305`：`unescape` 在 313，距 ref 8 行。建议 ref→309 或拆分。
11. **#79** `ref :1226`：`anthropic-version` / `Content-Type` 在 1232-1233，距 ref 6-7 行。建议 ref→1231。
12. **#92** `ref :1350`：`redacted_thinking` 空分支在 1357-1358，距 ref 7-8 行。建议 ref→1353 或拆分。
13. **#103** `ref :1646`：`type.isBlank()` 条件在 1637，距 ref 9 行。建议 ref→1637。
14. **#105** `ref :1706`：`content_block_start`→`tool_use` 分支派发在 1693-1696，距 ref 10+ 行。建议 ref→1696。
15. **#108** `ref :1818`：`currentToolParser!!.flush()` 在 1808，距 ref 10 行。建议 ref→1808 或拆分。
16. **正文 `api-chat-claude.md` 调用链**：「响应按 SSE 事件流式解析」引用 `:1454`，与 #96 同错，建议 →1468。

## 通过项

- **facts**：其余 111 条引用真实存在且断言在 ±5 窗口内有源码支撑（含随机抽查 12 条逐条看窗口验证，如 #113/#15/#47/#42/#39/#20/#14/#88/#12/#69/#4/#5）。
- **quality（5/5 通过）**：evidence 全部与源码逐字一致、行号准确：
  - warning@65 `activeCall/activeResponse` 缺 `@Volatile`（63-67 行确认只有 `isManuallyCancelled` 有 `@Volatile`）；
  - warning@1132 完整请求体打 logcat；
  - warning@1361 非流式 `tool_use` 在 `enableToolCall=false` 时静默丢弃（1360-1361 确认无 else）；
  - suggestion@1436 冗余 catch-rethrow（1436-1438 逐字命中）；
  - suggestion@505 空白消息填 `[Empty]` 字面量发 API。
  severity/confidence 标注合理，无虚构证据。
- **正文**：§9 结构完整（概述 / AI 速览 / 核心机制 / 关键符号 / 调用链三段式 / 来源）；AI 速览含核心符号清单、主入口（sendMessage :1299 已验）、数据流向一句话；符号名保留英文原文；术语首现有解释。
- **status.json**：id=`api-chat-claude`、issue=29、status=`review-pending`、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，正确（critic 字段待 parent 回填）。
- **lint**：0 硬失败 / 0 警告。

## 覆盖缺口（非错误，备注）

- SSE 路径的 `provider_error_parsing_failed`（:1925）无事实覆盖；facts 只覆盖了非流式 JSON 路径的 :1556。可补一条，不强制。

---

## 复检（2026-10-01，修错后复验）

- 结论：**通过**。8 处必须修 + 7 处轻微越界 + 正文引用同步，全部复验通过。
- 必须修 8 条：#27 拆两条（:260 tokenCacheManager.updateActualTokens 窗口内、:275 onTokensUpdated 窗口内）✓；#95 :1451（throw HttpStatusException，400..499 分支在窗口内）✓；#96 :1468（peekBody(4096)）✓；#98 拆两条（:1485 delta.content 提取、:1503 finish_reason 判定含 null/none 排除）✓；#100 :1556（throw IOException provider_error_parsing_failed，isBlank && !usageApplied 在窗口内）✓；#106 :1731（"thinking" -> if (enableThinking) 与 <think> 发出）✓；#107 拆三条（:1760 text_delta、:1773 thinking_delta、:1786 input_json_delta/partial_json）✓；#109 :1838（message_delta + applyAnthropicUsage(overwriteOutputTokens=true)）✓。
- 轻微 7 条：:55（`: AIService {`）✓、:309（escape/unescape 同窗）✓、:1231（三请求头）✓、:1352/:1358（<think> 转换 / redacted_thinking 空分支）✓、:1637（type.isBlank()）✓、:1700/:1708（tool_use XML 起始标签 / StreamingJsonXmlConverter 创建）✓、:1807/:1824（flush / 补结束标签+清状态）✓。
- 拆分新条目抽查 13 条全部逐条 sed 验窗通过。
- 正文：旧错位引用（:1454/:1436/:253/:1226/:1706/:1747）已全部清除，:1468/:1451/:1231/:260/:275 已同步到位。
- facts 总数 119→126 条；lint 0 硬失败 / 0 警告（修错员已重跑）。
- 备注：`.status.json` 的 `refs_valid` 字段仍写 "119/119"，现为 126 条 facts，建议日终回填时更新。
