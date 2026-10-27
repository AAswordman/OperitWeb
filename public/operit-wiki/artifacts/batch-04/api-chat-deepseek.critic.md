# Critic 复核报告：api-chat-deepseek（DeepSeek 供应商）

- 复核对象：`review/batch-04/api-chat-deepseek.{md,facts.json,quality.json,lint.md,status.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验证 `git rev-parse HEAD` 一致）
- 复核方法：70 条 facts 逐条抽取 ref ±5 行窗口人工核对；3 条 quality evidence 用脚本验证逐字存在于源码；正文对照 SCHEMA §9 检查结构

## 结论：退回修正（5 处引用行号问题，事实本身全部为真）

70 条事实的**断言内容全部与源码一致**，没有虚构、没有复合事实、没有符号笔误。但有 5 条的 ref 行号落在 ±5 支撑窗口之外，需要把 ref 改到正确行号。修完即通过，无需重写内容。

### 必须修正的引用

1. **[59] ref 1070 → 改为 1099**
   - 断言："推理元数据 Base64 解码失败时记 AppLogger.w 警告并跳过该条"
   - 1070 的窗口（1065–1075）是文本块抽取代码，与 Base64 解码完全无关。
   - 真实位置：1094 `Base64.getDecoder().decode(...)` / 1099 `AppLogger.w("DeepseekProvider", "DeepSeek Responses reasoning metadata decode failed", e)`。
   - 这是本轮唯一的实质性错位（偏离 ~29 行），必须改。

2. **[14] ref 167 → 改为 160**
   - 断言："OBJECT 参数解析失败时记 AppLogger.w 警告日志"
   - 167 的窗口（162–172）不含 `AppLogger.w`，该行实际在 160（`AppLogger.w("DeepseekProvider", "OBJECT参数解析失败: ...")`）。

3. **[10] ref 139 → 改为 115（或 114）**
   - 断言："Thinking 参数经 ThinkingConfigurationApplier.apply 注入请求体"
   - 139 的窗口只看到本地包装函数 `applyThinkingParamsIfNeeded(jsonObject)`，看不到 `ThinkingConfigurationApplier` 这个符号名；真实调用在 115（`ThinkingConfigurationApplier.apply(...)`），114 是该本地函数的定义行。ref 指到 114/115 才满足"符号名在窗口内可见"。

4. **[28] ref 294 → 改为 306**
   - 断言："flushOpenToolCallsAsUnmatched 在边界处把未匹配的 tool_calls 转成 role=tool 的占位消息"
   - 294 的窗口（289–299）只有函数签名和一条日志，`put("role", "tool")` 实际在 306。ref 指到 304–306 区间。

5. **[47] ref 628 → 拆分或改述**
   - 断言："parseNonStreamingResponse 按 type 分发处理 message、reasoning、function_call、web_search_call"
   - 628 的窗口（623–633）只看得到 `"message"` 分支；`"reasoning"`（665）、`"function_call"`（682）、`"web_search_call"`（689）三个分支超出窗口，四条分支跨度 630–689，单个 ref 无法同时覆盖。
   - 建议：拆成 4 条单分支事实（各指 630/665/682/689），或改述为"按 type 分发（message 分支…）"并另起 facts 覆盖其余分支。

### 通过的部分

- **facts**：70 条中 65 条引用精确、窗口内完全支撑；上述 5 条断言为真、仅 ref 行号需调整。无虚构、无复合事实。
- **quality**：3 条全部通过——evidence 经脚本验证逐字存在于源码（`if (matchedCalls.size < resultsList.size)` / `sanitizeImageDataForLogging` / `response_format` 搬运块）；severity 与 confidence 合理（warning/high、suggestion/medium ×2）。小注：[0] 的上报行号 431 与实际 `if` 行 433 差 2 行，evidence 块本身逐字正确，不算问题。
- **lint**：0 硬失败 / 0 警告。
- **status.json**：id=`api-chat-deepseek`、issue=30、status=`review-pending`、source_repo=`Operit`、source_commit=`dbf71916…`（全对，critic 字段留空待填）。
- **正文**：§9 双受众结构完整（概述 / AI 速览 / 核心机制 5 小节 / 关键符号表 / 调用链输入→处理→输出三段式编号 / 来源）；术语首现均有中文解释（Provider、reasoning_content）；符号名保留英文原文；来源引用精确到行。未发现正文与 facts 矛盾之处。

## 待办（给 writer/fixer）

按上面 5 条把 ref 行号改掉（[47] 拆分或改述），改完后 facts 重新跑一遍 lint，无需我二次全文复核，抽查 5 条改动行即可。
