# Critic 复核报告：api-chat-openai（OpenAI 供应商）

- 复核对象：`review/batch-04/api-chat-openai.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对一致）
- 复核方式：116 条 facts 逐条取 ref ±5 行窗口与源码 diff；5 条 quality evidence 全文检索定位；正文结构与 status 人工检查
- **结论：退回修正（引用错位系统性问题，事实内容本身全部属实）**

## 总览

| 项 | 结果 |
|---|---|
| facts 116 条 | 断言内容 116/116 属实；**44 条引用行号错位**（窗口内无支撑代码） |
| quality 5 条 | 5/5 通过，evidence 均为真实源码 |
| 正文 .md | §9 结构完整，通过（1 处小瑕疵） |
| .status.json | 通过（id/issue 27/review-pending/source_commit 正确） |
| lint | 0 硬失败 / 0 警告（writer 自报，已见 .lint.md） |

## 必须修正：44 条引用错位（按 facts 数组下标）

说明：断言本身经核实全部为真，问题是 `ref` 指向的行号 ±5 窗口内看不到支撑代码，违反引用铁律。修正方式：把 `ref` 改为建议行号（均为实测定位）。

| # | 当前 ref | 断言摘要 | 建议 ref |
|---|---|---|---|
| 0 | :88 | 实现 AIService 接口 | :103（`: AIService` 在此行；或拆成两条） |
| 16 | :130 | 三个 token 计数属性 | :132（cachedInputTokenCount 在 L136，窗口差 1 行，轻微） |
| 18 | :143 | useResponsesApi 默认 false | :129 |
| 21 | :167 | 错误详情格式 message [type=.., code=..] | :176 |
| 31 | :265 | testConnection 不重试 | :281（`enableRetry = false` 在此行） |
| 34 | :314 | sanitizeImageDataForLogging 脱敏 base64 | :330 |
| 37 | :398 | 输出图片文件名格式/失败返 null | :405 |
| 40 | :454 | tryHandleOpenAiImageResponse 处理 data 数组与 image_generation 事件 | 拆分：data 部分 :459，image_generation 事件 :492 |
| 42 | :577 | createRequestBody 经 createRequestBodyInternal+ThinkingConfigurationApplier | :587 |
| 52 | :774 | calculateAndStoreInputTokens 经 tokenCacheManager.calculateInputTokens | :783 |
| 58 | :1078 | SYSTEM/USER/SUMMARY 边界 flush 未匹配 tool_calls | :1119（system_boundary） |
| 59 | :1095 | ASSISTANT 历史 XML 经 parseXmlToolCalls 解析 | :1140 |
| 60 | :1145 | TOOL_RESULT 配对生成 role=tool 消息 | :1221 |
| 61 | :1120 | 历史末尾统一生成 unmatched 占位 | :1295（history_end） |
| 62 | :1210 | 不启用 Tool Call 时按 providerRoleForTurn 原样发送/空 assistant 填 [Empty] | :1268 |
| 66 | :1390 | convertToolCallsToXml 转 XML/转义/无 name delta 跳过 | :1397（跳过逻辑）；转义 :1428 |
| 67 | :1430 | XmlEscaper 转义 5 字符 | :1442 |
| 68 | :1447 | sanitizeToolCallId 归一 9 字符 | :1459 |
| 69 | :1462 | stableIdHashPart 36 进制 id 片段 | :1479 |
| 70 | :1485 | ToolCallState 结构 | :1498 |
| 71 | :1524 | StreamEmitter.emitContent 非空才 emit+累加 token | :1532 |
| 72 | :1555 | StreamEmitter savepoint/rollback | :1574（savepoint）/:1581（rollback） |
| 73 | :1816 | createRequest 经 EndpointCompleter 补全端点 | :1823 |
| 77 | :1898 | processToolCallChunk 按 index 累积/name 到达 emit 起始标签 | :1922 |
| 80 | :2008 | processToolCallsDelta 跳过 index<0/工具切换 | :2023 |
| 81 | :2036 | closeToolCallIfOpen flush 后 emit 闭合标签 | :2050 |
| 83 | :1674 | wrapPackageToolCallsWithProxy 包装含冒号工具名 | :1682 |
| 86 | :2579 | processResponsesStreamingEvent 处理各类事件 | :2602 起（事件分发） |
| 87 | :2585 | response.output_text.delta 正文通道 | :2602 |
| 88 | :2700 | response.function_call_arguments.delta 累积 | :2763 |
| 89 | :2745 | response.completed/incomplete 关闭工具调用+应用 usage | :2801 |
| 90 | :2768 | response.failed/error 抛 IOException | :2822 |
| 91 | :2900 | processContentDelta 思考内容包 <think> 输出 | :2893 |
| 94 | :3035 | processResponseChunk 无 choices 只应用 usage | :3043 |
| 95 | :3048 | reasoning_content 兼容 reasoning 字段名 | :3074 |
| 96 | :3107 | processStreamingResponse 只处理 data: 行 | :3121 |
| 98 | :3185 | 流未确认完成抛网络中断 IOException | :3173 |
| 99 | :3207 | sendMessage 开始重置输出 token | :3227（`addOutputTokens(-outputTokenCount)`） |
| 103 | :3380 | 非流式取 choices[0].message/tool_calls 需 enableToolCall 才转 XML | :3407 |
| 108 | :1640 | handleRetryableError 取消异常直接抛出 | :1650 |
| 109 | :1650 | enableRetry=false 直接抛 IOException | :1657 |
| 110 | :1660 | 重试间隔取 LlmRetryPolicy.nextDelayMs | :1672 |
| 111 | :1633 | 重试前检查取消抛 UserCancellationException | :1621（checkCancellation） |
| 112 | :820 | appendReadableImageMessageIfNeeded 在 supportsVision 时补图片消息 | :829（声明）/:834（`if (!supportsVision) return`） |
| 113 | :878 | canCarryUserRichContent 仅 user/summary 可携带多媒体 | :812 |
| 114 | :883 | Responses 模式 role=tool 可携带结构化图片 | :817 |

## quality.json（5 条，全过）

- Q0 warning：流式 SSE 行 JSON 解析失败静默跳过 — evidence 真实（L3160-3171），定位准确。
- Q1 suggestion：只处理 choices[0] — evidence 真实（L3043-3050）。
- Q2 warning：mergeCanonicalArgs 拼接可能出非法 JSON — evidence 真实（L1967-1972）。
- Q3 suggestion：downloadBytes 吞异常返 null — evidence 真实（L415-420）。
- Q4 suggestion：closeToolCallIfOpen 强制补标签 — evidence 真实（L2055-2058）。
- 小瑕疵（非阻塞）：Q3/Q4 的 evidence 首行缩进被剥离（源码行首有缩进），建议保留原始缩进以做到逐字复制。

## 正文（通过，1 处小瑕疵）

- §9 结构完整：概述 / ## AI 速览（含核心符号清单+主入口+数据流向一句话） / 核心机制（9 个子节） / 关键符号（符号表，英文原名） / 调用链（输入→处理→输出三段编号，引用精确到行） / 来源。
- 人话短句，术语有解释；符号名保留英文。
- 小瑕疵：`SSE` 首现（概述段）未展开全称 Server-Sent Events，建议补。

## status.json（通过）

`{id: api-chat-openai, title: OpenAI 供应商, issue: 27, status: review-pending, source_repo: Operit, source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb}` — 全部正确。

## 给 writer 的修正要求

1. 按上表把 44 条 `ref` 改到建议行号（或拆分复合断言后各自指向正确行）。
2. quality.json Q3/Q4 evidence 首行补回原始缩进。
3. 正文概述段 SSE 首现加全称注释。
4. 改完后重新跑 `scripts/lint.py`，保持 0/0，通知 parent 复检。

## 复检（2026-10-01T13:54 CST）

**结论：通过。** 修错员按对照表修完 44 处引用（其中 4 条拆成 8 条原子事实，facts 116→120）+ quality Q0–Q4 evidence 缩进 + 正文 SSE 全称，lint 0/0。

**复检方式**（只复检修错项，不重走全文）：
1. 48 个新 ref（44 修正 + 4 拆分）在 facts.json 中全部存在（:2602 被 #86/#87 两个事实共用，均指事件分发窗口，合理）。
2. 用 sed 逐个导出 ±5 行窗口人工核对：48/48 全部支撑断言，无一例越界。抽查示例：:103（`: AIService`）→"实现 AIService 接口"；:176（`buildString` 拼 message[type=,code=]）→错误详情格式；:2822（`response.failed/error` 分支）→抛 IOException；拆分项 :459/:492（tryHandleOpenAiImageResponse 的 data 数组 vs image_generation 事件）、:1397/:1428（无 name delta 跳过 vs XML 转义）、:1574/:1581（savepoint vs rollback）、:829/:834（声明 vs `!supportsVision` 早返）均独立成条、窗口各自完全支撑。
3. quality Q0–Q4 的 evidence 5/5 与源码逐字一致（含修错员顺手补回的 Q0/Q1/Q2 首行缩进）。
4. 正文概述段首现已展开为 `SSE（Server-Sent Events，服务端推送事件）`。

未改动 facts/md/quality/status 文件，未动 review-queue.json。本页达到收货标准，可进入发布队列。
