# integrations-webchat（Issue #80）第三名独立 critic 复验报告

- 复验对象：`review/batch-06/integrations-webchat.{md,facts.json,quality.json,lint.md,status.json}`（第二轮修错后）
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（HEAD 已确认一致）
- 复验日期：2026-10-01

## 一、critic2 的 7 项修错复验（全部修到位）

1. **5 处 facts 重锚**：逐条拉 ±5 窗口比对源码，全部支撑断言——
   - [133] `:200`：窗口覆盖 `use_system_theme`（:202）✓
   - [135] `:496`：窗口覆盖 `current_model_name`（:498）✓
   - [93] `:1046`：窗口覆盖 `mimeType`（:1049）/`fileSize`（:1050）✓
   - [98] `:1147`：窗口覆盖 `STREAM_EVENT_START`（:1144）与 `STREAM_EVENT_USER_MESSAGE`（:1151）✓
   - [115] `:2611`：窗口覆盖 `ASSET_TTL_MS`（:2610）与 `UPLOAD_TTL_MS`（:2616）✓
2. **Q01/Q03/Q05 evidence 缩进**：脚本做 raw bytes 逐字节比对，全部与源码一致，无缩进剥离 ✓
3. **Q03/Q12 evidence2_file**：字段已补为 `.../integrations/http/WebChatHttpBridge.kt`，与 evidence2 内容对应 ✓

## 二、quality 全部 14 条 evidence 逐字节比对

- 14/14 evidence 与 evidence2 内容均为源码逐字原文（脚本比对，无一 BAD）。
- 说明：源码 `ExternalChatHttpServer.kt:386` 的真实文本为 `error = "Bearer token not configured"`；运行时对该字串做显示层脱敏，本报告的比对全部在脚本内按 raw bytes 执行，未受显示影响。
- **4 条 high 全部实锤**（逐条看过源码原文）：
  - Q01：`LISTEN_HOST = "0.0.0.0"`（:548），无 TLS 配置，severity 恰当
  - Q02：`handleApi()` 内 assets 路由（:111–113）先于 `requireBearerToken`（:115）短路返回，severity 恰当
  - Q03：`serve()` 非 `/api` 路径直接 `serveStatic`（:83），无 token 校验，severity 恰当
  - Q04：`withCors()` 全响应加 `Access-Control-Allow-Origin: *`（:538–542），severity 恰当
- severity 分布 4 high / 7 warn / 3 suggestion，无膨胀；取值仅 high/warn/suggestion。

## 三、facts 随机抽查 25 条（seed=80）

23 条 ±5 窗口完整支撑；2 条发现窗口问题（见第四节第 5、6 项）。无虚构符号、无错文件、无越界、无复合事实。

## 四、剩余问题（6 项，均为机械修正，无事实错误）

以下断言内容经源码核实全部为真，问题仅在行号字段/锚点窗口：

1. **quality[8]（Q09）`line` 字段**：`2619`→应 `2618`。evidence 两行（`uploadsById.remove(entry.key)` / `runCatching { entry.value.storedFile.delete() }`）实际起于 2618 行。
2. **quality[8]（Q09）`evidence2_line`**：`1033`→应 `1032`。`val attachmentInfo = AttachmentInfo(` 实际在 1032 行（grep 确认）。
3. **quality[9]（Q10）`line` 字段**：`437`→应 `439`。evidence 两行（`}?..value?.trim()?.toLongOrNull()` / `?: return RequestBodyResult(error = "Missing or invalid Content-Length")`）实际起于 439 行。
4. **quality[13]（Q14）`line` 字段**：`382`→应 `383`。evidence 四行（`Response.Status.UNAUTHORIZED,` 起）实际起于 383 行。
5. **facts[3] 锚点**：ref `:65` 的 ±5 窗口（60–70）覆盖 `a2aHandler.close()`（:69）与 `stop()`（:70），但断言的"最后把 running 置为 false"在 :71，窗口外 1 行。修正：ref 改为 `:68`（窗口 63–73 覆盖三处）。
6. **facts[37] 窗口支撑不全**：ref `:471` 的窗口（466–476）覆盖"从 content-type 头解析 charset"，但"不支持或缺失时回退 UTF-8"的证据在 :482–489（`getOrElse { ... StandardCharsets.UTF_8 }`），窗口外。修正：拆两条——(a) "从 content-type 头按 `;` 分割解析 charset=" 锚 `:473`；(b) "charset 不支持或缺失时回退 UTF-8" 锚 `:484`。拆分后 facts 152→153，`status.json` 的 `refs_valid` 需同步为 153。

## 五、合规检查

- `status.json`：issue=80、source_commit=`dbf71916…`、refs_valid=152（=当前 facts 数组长度）、review-pending，全对
- 5 个交付文件禁用词（通过/批准/LGTM）：0 命中
- facts/quality 顶层数组；facts 条目键仅 `fact`+`ref`
- facts 152 条 ref 全部存在、无越界

## 六、后续建议

6 处均为单点重锚/行号字段修正，无事实错误。按既有先例，parent 可直接修正并核对 ±5 窗口，无需第四轮全量复核。修正后 4 文件隔离重跑 lint（0/0）并更新 lint.md。

## Verdict: FAIL（6 项机械修正，见第四节；无事实错误）
