# Critic 复核报告：api-chat-gemini（Gemini 供应商）

- 复核对象：`review/batch-04/api-chat-gemini.{md,facts.json,quality.json,lint.md,status.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse` 一致）
- 复核方式：86 条 facts 逐条取 `file:line ±5` 窗口与源码比对；quality 7 条逐字 diff；正文抽查关键断言
- **结论：退回修正**

## 总览

| 项 | 结果 |
|---|---|
| facts 86 条 | 通过 35 / 事实错误 2 / 引用错位 32 / 引用支撑不足 17 |
| quality 7 条 | 全部通过，evidence 与源码逐字一致 |
| status.json | 正确（id / issue 28 / review-pending / source_commit） |
| 正文 §9 结构 | 完整（概述/AI速览/核心机制/关键符号/调用链三段式/来源） |
| 正文事实 | 继承 facts [8] 的"21个"错误（2 处）；其余抽查断言与源码一致 |

核心问题：writer 系统性地记错了行号——约一半 facts 的断言本身为真，但 ref 指向了前后 5~30 行之外的位置，不符合"断言必须在 ±5 行内可见"的铁律。另有 2 条是真正的事实错误。

## 一、事实错误（必须改断言）

1. **[8] `terminalFinishReasons` 数量**：fact 称"共 21 个终结原因"，源码 `setOf(...)`（:149-170）实际只有 **20** 个：STOP, MAX_TOKENS, SAFETY, RECITATION, LANGUAGE, OTHER, BLOCKLIST, PROHIBITED_CONTENT, SPII, MALFORMED_FUNCTION_CALL, IMAGE_SAFETY, IMAGE_PROHIBITED_CONTENT, IMAGE_OTHER, NO_IMAGE, IMAGE_RECITATION, UNEXPECTED_TOOL_CALL, TOO_MANY_TOOL_CALLS, MISSING_THOUGHT_SIGNATURE, MALFORMED_RESPONSE, ESCALATION。逐个数过，无遗漏。→ 改为 20。
2. **[66] SSE 解析异常处理**：fact 称"SSE 解析异常只记日志不中断整条流"。源码 :1608-1613 的 catch 链是：`CancellationException → throw`，`IOException → throw`，只有普通 `Exception` 才 `logError` 继续。IO 异常会中断流，原断言以偏概全。→ 改为"只有非 IO 的普通异常才只记日志继续；CancellationException 与 IOException 原样抛出、中断流"。ref :1608 可保留（窗口覆盖 catch 链）。

正文 `api-chat-gemini.md` 同步改 2 处："`finishReason` 落在 21 个终结集合里"、"`terminalFinishReasons` | 21 个终结原因集合" → 20 个。

## 二、引用错位（断言为真，ref 指错行，请按下表改 ref）

| # | 原 ref | 正确 ref | 说明 |
|---|---:|---:|---|
| [15] | :241 | :248（另拆一条 :260） | strip 调用在 :248；"ASSISTANT 轮剥离思考内容"在 :259-261，一个窗口盖不住，拆两条 |
| [22] | :504 | :512 | description+details 拼接在 :511-515 |
| [26] | :594 | :610 | 纯文本分支（`// 纯文本消息`）在 :609-613；:594 是图片分支 |
| [28] | :643 | :672 | systemInstruction 构造在 :672-675 |
| [31] | :712 | :729 | model 角色拼装 + thoughtSignature 只挂首个 Part 在 :721-733，:729 的窗口全覆盖 |
| [33] | :970 | :943 | `flushOpenFunctionCallsAsUnmatched("history_end")` 在 :943 |
| [34] | :847 | :866 | TOOL_RESULT 轮 `emitQueuedFunctionCallsIfNeeded()` 在 :866 |
| [40] | :1062 | :1073（或拆 :1082） | buildGeminiErrorDetail 在 :1073；拼接格式在 :1082-1094 |
| [41] | :1078 | :1098 | throwIfGeminiErrorPayload 在 :1098-1104 |
| [42] | :1084 | :1107 | resolveRetryErrorText 在 :1107-1111 |
| [43] | :1090 | :1128 | 三个原样抛出的异常在 :1126-1131，:1128 窗口覆盖 |
| [44] | :1097 | :1132 | isManuallyCancelled 检查在 :1132-1134 |
| [45] | :1129 | :1154 | nextDelayMs 调用在 :1154 |
| [46] | :1131 | :1156 | shouldSuppressKeyPoolRateLimitNotice 在 :1156 |
| [47] | :1164 | :1179 | MutableSharedStream(replay=MAX) 在 :1179 |
| [48] | :1168 | :1181 | isManuallyCancelled=false 在 :1181 |
| [50] | :1182 | :1193 | MAX_RETRY_ATTEMPTS 在 :1193 |
| [51] | :1247 | :1266 | `response.code in 400..499` 在 :1266 |
| [55] | :1349 | :1391 | tools→systemInstruction→contents→generationConfig 组装在 :1381-1396 |
| [56] | :1378 | :1410 | 四组参数映射在 :1405-1415 |
| [57] | :1410 | :1431 | OTHER 分支挂请求根在 :1430-1436 |
| [58] | :1431 | :1466 | tools 脱敏 + sanitize 在 :1464-1470 |
| [64] | :1516 | :1521 | 回退 URL `https://generativelanguage.googleapis.com` 在 :1523，:1521 窗口覆盖 |
| [73] | :1946 | :1957 | PromptBlockedException 抛出在 :1955-1959 |
| [74] | :1962 | :1973 | `finishReason in terminalFinishReasons` 在 :1973-1974 |
| [75] | :1968 | :1978 | groundingMetadata 解析在 :1977-1981 |
| [77] | :2048 | :2084 | 图片解码落盘 + markdown 插入在 :2079-2087 |
| [78] | :2084 | :2106 | generateRandomToolTagName 在 :2106-2107 |
| [80] | :2117 | :2145 | `<think>` 开关逻辑在 :2143-2151 |
| [81] | :2130 | :2170 | serverUsageApplied 跳过估算在 :2167-2172 |
| [84] | :2214 | :2226（或拆） | "Hi" 在 :2222，enableRetry=false 在 :2230；:2226 窗口覆盖两者 |
| [85] | :2238 | :2244 | CancellationException 原样传播在 :2244-2249（含注释"不能变成 Result.failure"） |

## 三、引用支撑不足（断言部分超出 ±5 窗口，请收紧 ref 或拆分/删减断言）

- [0] :134：窗口无 `: AIService`（在 :145）。拆两条：`:134` 保留"open class + 对接 Gemini REST + 流式"（窗口 :129-139 覆盖注释与类名）；另起一条"实现 AIService 接口" ref :145。
- [5] :94：窗口只有函数签名，"enableThinking=false 置 includeThoughts=false"不在窗口内。找到实际代码行重指。
- [11] :196：窗口无 outputTokenCount（在 :202-203）。改 ref :198 或拆条。
- [13] :210：窗口无 activeCall?.cancel()。找到实际行重指。
- [17] :319：窗口只有 escape，unescape 顺序不在窗口内。补实际行或拆条。
- [19] :420：窗口无"参数值经 XmlEscaper.unescape"（在 map 体内 :432-436）。重指。
- [20] :428：窗口无"从文本中删掉原 XML"。找到实际行重指。
- [21] :462：窗口无 `{name, response:{result}}` 构造。找到实际行重指。
- [24] :530：窗口无"default/required"处理。找到实际行重指。
- [25] :563：窗口只有 hasImages/hasMedia 判断，inline_data 转换不在窗口内。改 ref :594。
- [29] :936：窗口无 ASSISTANT（:930）与非 toolcall 分支上下文（:927）。改 ref :930。
- [30] :702：thoughtSignature"只保留第一个非空"在 :708-710，超出窗口。改 ref :707。
- [36] :981：窗口无 `[image base64 omitted, length=...]` 字样。找到实际行重指。
- [38] :1030：gif 映射与 else→png 在 :1036-1037，超出窗口。改 ref :1033。
- [39] :1039：文件名格式与 catch-return-null 在 :1048-1054，超出窗口。改 ref :1048。
- [49] :1201：窗口只有 helper 定义，"每次请求发 SAVEPOINT / 重试前 ROLLBACK" 的行为证据在 :1222（发射）与 :1327（onRetryAccepted）。拆三条各指实际行。
- [79] :2092：窗口只有注释"流式转换为XML"，StreamingJsonXmlConverter 使用在 :2112-2114。改 ref :2112。

## 四、通过项（抽样列举，不再复述）

- [1][2][3][4] 构造函数默认参数、GeminiThinkingConfig 三段式 wire 值：引用精准。
- [7] DEBUG=true、[9] HttpStatusException、[10] PromptBlockedException、[14] @Volatile：通过。
- [52][53][54] finally 关闭 response、清理活跃引用、onUsageFinalized：通过。
- [59]-[63] streamGenerateContent/generateContent 选择、URL 格式、自定义头、?key= 拼接、请求头脱敏：通过。
- [65][67] SSE 数据行/[DONE]、JSON 分段收集：通过。
- [68]-[72] 流中断抛错、思考模式收尾、空格占位、usage 先提取：通过。
- quality 7 条：DEBUG 硬编码、Key 拼 URL、recordTokenUsage 死参数、SSE 丢行、空格占位、determineBaseUrl 静默回退、activeCall/activeResponse 异常路径残留——evidence 全部与源码逐字一致，严重度与置信度合理。其中 recordTokenUsage 死参数（全文件仅 :1176 声明与 :2231 传参两处出现）与非流式空格占位（:1883）已额外核实。

## 五、给 writer 的修复要求

1. 按"一、二"改 2 条事实错误（含正文 2 处"21个"）。
2. 按"二"表逐条修正 32 个错位 ref（建议用脚本批量改后自查窗口）。
3. 按"三"收紧 17 条弱引用（重指/拆分/删减断言三选一）。
4. 全部修完后重跑 `scripts/lint.py` 到 0/0，并自查每个新 ref 的 ±5 窗口。
5. 修完通知 critic 复检（只需复检本次列出的问题条目）。

注：本次复核未修改任何被复核文件；`review-queue.json` 未动；`tracking/read-status.json` 中 GeminiProvider.kt 登记正常。

## 复检（2026-10-01 13:55 CST，独立复检 critic）

- 复检对象：修错员按本报告"一、二、三"修完后的 `api-chat-gemini.facts.json`（86→100 条）、正文、`quality.json`、`lint.md`。
- 复检方式：只复检本次退回条目，未重走全文。
- **结论：通过**

### 1. 事实错误（2 条）——全部修正并独立验真
- **[8]→现[10]**：我逐个字面数过 `setOf(...)`（:150-170），确为 **20 个**（STOP、MAX_TOKENS、SAFETY、RECITATION、LANGUAGE、OTHER、BLOCKLIST、PROHIBITED_CONTENT、SPII、MALFORMED_FUNCTION_CALL、IMAGE_SAFETY、IMAGE_PROHIBITED_CONTENT、IMAGE_OTHER、NO_IMAGE、IMAGE_RECITATION、UNEXPECTED_TOOL_CALL、TOO_MANY_TOOL_CALLS、MISSING_THOUGHT_SIGNATURE、MALFORMED_RESPONSE、ESCALATION）。fact 断言已改为"共 20 个"。注：计数跨越 21 行列表，单行 ±5 窗口只能看到声明起点 :149，但计数本身经我独立核实无误，接受。
- **[66]→现[79]**：亲眼核对 :1608-1613 catch 链——`CancellationException → throw`、`IOException → throw`、普通 `Exception → logError` 继续。fact 改述为"SSE 解析只有非 IO 的普通 Exception 才记日志继续；CancellationException 与 IOException 原样抛出、中断流"，ref :1608 的窗口（1603-1613）完全支撑。✓
- 正文 2 处（:66 行、:106 符号表）均已改为"20 个"。✓

### 2. 错位 ref（32 处）——全部修正并抽查验真
- 全量自动校验：100 条 facts 的反引号符号逐条落在 ref ±5 窗口内，**0 失败**；全部 ref 行号有效、无越界、无格式错误。
- 人工抽查 10 处修后窗口（sed 实测）：:248（stripGeminiThoughtSignatureMeta）、:260（ASSISTANT 分支 removeThinkingContent）、:512（description+details 拼接）、:610（纯文本分支）、:672（systemInstruction 构造）、:707（thoughtSignature 只保留第一个非空）、:991（`[image base64 omitted, length=...]`）、:1074（buildGeminiErrorDetail 三字段）、:1154（LlmRetryPolicy.nextDelayMs）、:943（flushOpenFunctionCallsAsUnmatched("history_end")）——断言均被窗口完全支撑。✓
- 另抽查 :1978（groundingMetadata.webSearchQueries）、:2145（<think> 开关）、:2226（"Hi"+enableRetry=false 同窗）、:1410（top_p/top_k/max_tokens 映射）——全部通过。✓

### 3. 弱引用（17 处）——全部处理，抽查拆分项
- 拆分项核实：[0]→:134（open class）/:145（`: AIService`）；[15]→:248/:260；[24]→:531（type=object）/:539（逐参数）/:553（required）；[49]→:1201（挂起函数定义）/:1222（请求前发射 SAVEPOINT）/:1327（onRetryAccepted 发 ROLLBACK）；[40]→:1074/:1090。抽查的 6+ 条拆分新条目 ref 窗口均完全支撑各自断言。✓

### 4. lint
- `.lint.md`：0 硬失败 / 0 警告（修错后重跑）。✓

未改动 facts/md/quality/status 文件；`review-queue.json` 未动。
