# 独立 Critic 报告（2026-10-01）

- 条目：`core-tools-standard-webchat`（标准工具·浏览器/网络/聊天/工作流）
- 源码钉死：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 说明：此前同名文件为 writer 自我走查记录，本报告为**与 writer 无关的独立复核**，覆盖其上。

## 结论：退回修正（8 条 facts 引用行号错位）

- `facts.json`：82 条中 **74 通过 / 8 失败**。8 条失败的**内容断言全部属实**（已逐条用 grep/sed 在源码中验真），但 `ref` 行号落在断言依据的 ±5 行窗口之外，违反引用铁律，必须修正行号后重新过审。
- `core-tools-standard-webchat.md` 正文：结构完整（概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 关联条目 / 来源），`## AI 速览` 齐全（核心符号清单 + 主入口 + 数据流向一句话 + 关键常量）。**正文没有超出 facts 的断言**；抽查的常量全部验真（浏览器 22 工具、聊天 15 工具、`runOnMainSync` 默认 8s@StandardBrowserSessionTools.kt:1775、`AI_RESPONSE_TIMEOUT=180000L`@StandardChatManagerTool.kt:101、`MAX_INLINE_VISIT_CONTENT_CHARS=12_000`@StandardWebVisitTool.kt:103、桌面 Chrome 124 / Pixel 7 移动 UA@StandardBrowserSessionTools.kt:87-91）。值得注意：**正文的内联引用反而是对的**（如 requireSnapshotNode 用 :315、triggerType 缺省 manual 用 :987、ChatHistoryManager 用 :876），说明 facts.json 的 8 处是单纯的引用行号抄错。
- `quality.json`：17 条走查**实质全部成立**（4 high / 10 medium / 3 low）。逐条验过：`onReceivedSslError` 直接 `handler.proceed()`（Q0）、`applyUnsafeSsl`（Q1）、`isValidUrl` 无内网过滤（Q2）、`defaultClient`/`client` 死代码（Q12/Q13，经 grep 确认全文件仅声明处出现）、visit_web 无悬浮窗权限前置检查（Q16，全文件无 canDrawOverlays 检查）、通配查询 `Int.MAX_VALUE`（Q8）、`resolveNodeId` 下标容错（Q11）。仅有**证据行号/片段的轻微漂移**（见下表"次要问题"），不影响结论成立。

## 必须修正的 8 条 facts（退回清单）

| # | 事实摘要 | 当前 ref | 问题 | 正确行号（±5 窗口内可见依据） |
|---|---|---|---|---|
| 7 | 点击/悬停/拖拽等工具的 ref 须在页面快照中（`requireSnapshotNode`） | StandardBrowserSessionTools.kt:286 | :286 是 `browserClick` 函数头，`requireSnapshotNode` 实际调用在 :315 | **:315**（`if (ref != null && requireSnapshotNode(session, ref) == null)`） |
| 16 | console level 仅允许 error/warning/info/debug（默认 info）；network_requests `includeStatic` 默认 false | StandardBrowserSessionTools.kt:1320 | 一条 ref 横跨两个函数：level 校验在 :1328-1330，`includeStatic` 默认 false 在 :1346（`boolParam(tool, "includeStatic", false)`），:1320 的 ±5 窗口看不到后者 | **拆成两条**：level 校验 → :1328；includeStatic → :1346 |
| 21 | 默认冒充桌面 Chrome 124 UA，另有 Android 13 Pixel 7 Chrome 120 移动 UA | StandardBrowserSessionTools.kt:74 | :74 附近只有 `DESKTOP_CHROME_MAJOR_VERSION`，真正的 UA 字符串常量在 :87-91 | **:87**（`DEFAULT_USER_AGENT` / `MOBILE_USER_AGENT` 窗口 82-92 覆盖两者） |
| 37 | HTTP 默认超时 15/20/15s，非法数字回退默认，`follow_redirects` 默认开，proxy 条件 | StandardHttpTools.kt:301 | :301 是 `PreparedHttpRequest` 构造处，看不到任何超时/代理数值 | **:88**（窗口 83-93 含 `connectTimeout=15/readTimeout=20/writeTimeout=15`、`followRedirects=true`、`proxyHost`） |
| 40 | `http_request` 不做 2xx 校验，404/500 也返回 success=true | StandardHttpTools.kt:315 | :315 是 `httpRequest` 函数头；无条件 `success=true` 在 :338（全文件 0 处 `isSuccessful`） | **:338**（`ToolResult(toolName=..., success=true, result=httpResponseData, error="")`） |
| 47 | 会话数据经 `ChatHistoryManager` 单例持久化，当前会话由 `currentChatIdFlow` 维护 | StandardChatManagerTool.kt:837 | :837 附近是 `findChat`，`getInstance` 在 :874、`currentChatIdFlow.first()` 在 :876 | **:874**（窗口 869-879 同时覆盖两者） |
| 54 | 发消息前并发预检，无活跃流否则返回 "Previous message is still being processed" | StandardChatManagerTool.kt:1873 | :1873 窗口只有预检逻辑，该错误字符串实际在 :1889（16 行外） | **:1889**（`error = "Previous message is still being processed"`） |
| 67 | `TriggerNode.triggerType` 缺省 `manual` | StandardWorkflowTools.kt:1008 | :1008 是 `ExecuteNode` 解析处，`optString("triggerType", "manual")` 实际在 :982 | **:982** |

## 次要问题（建议顺手修，不阻塞）

- `quality.json` Q0：`onReceivedSslError` 的声明在 StandardWebVisitTool.kt:**1248**，当前 `line: 1259` 指向函数体内部（`handler.proceed()` 处），偏 11 行。建议改为 1248。
- `quality.json` 证据片段有轻微转述，与源码原文不完全一致（均已验真结论成立，仅片段文字建议贴原文）：
  - Q7：`parseHeaders(headersJson: String?)` → 实际签名是 `(headersJson: String)`（StandardHttpTools.kt:436）；
  - Q8：`val limit = when {` → 实际是 `val defaultLimit = if (isWildcardQuery && limit == null)`（MemoryQueryToolExecutor.kt:277）；
  - Q11：`val index = idValue.toIntOrNull()` → 实际是 `val idxFromIdField = v.toIntOrNull()`（StandardWorkflowTools.kt:1219）；
  - Q12：`private val defaultClient: OkHttpClient = OkHttpClient.Builder()` → 实际是 `private val defaultClient =`（类型推断，StandardHttpTools.kt:78）；
  - Q13：同理 `private val client: OkHttpClient = ...` → 实际 `private val client =`（StandardWebVisitTool.kt:116）。

## 验证方法

- 自写脚本对 82 条 facts 全量校验：文件存在 → 行号在文件总行数内 → symbol/断言关键词在 ±5 行窗口内；15 条未命中转人工逐条 `sed` 窗口核验，其中 7 条为脚本分词漏检（已人工确认为通过），8 条为真实行号错位（上表）。
- 正文抽查 10+ 处常量与工具数量，全部与源码一致；`## AI 速览` 四要素齐全。
- `quality.json` 17 条：脚本验 file/line/snippet（10 通过），7 条 snippet 未命中转人工核验——结论全部成立，仅 Q0 行号漂移 11 行、5 处片段转述。

## 给 writer 的修正动作

1. 按上表修正 8 条 facts 的 `ref`（其中 #16 拆成两条 facts）。
2. 修正 Q0 的 `line` 为 1248；5 处证据片段贴源码原文。
3. 修正后重新跑 `scripts/lint.py`（要求 0 硬失败 0 警告），不要动 `.status.json`（保持 `review-pending`）。

## 修正记录（2026-10-01）
- 8 条 facts 引用行号已修正（idx7→:315、idx16 拆成两条 :1328/:1346、idx21→:87、idx37→:88、idx40→:338、idx47→:874、idx54→:1889、idx67→:982），修正前已用脚本逐条验真新行号。
- quality.json：Q0 line 1259→1248；Q7/Q8/Q11/Q12/Q13 证据片段贴回源码原文（Q11 line 同步为 1220）。
- 注意：critic 报告中的编号为 0-based，与 facts.json 数组下标一致。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
