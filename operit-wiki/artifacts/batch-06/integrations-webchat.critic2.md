# 第二名独立 critic 复验报告：integrations-webchat（Issue #80）

- 复核对象：修错后的 `review/batch-06/integrations-webchat.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 复核方式：第一名 critic 9 项清单逐项核源码；facts 随机 25 条（seed=80）ref±5 窗口核对；F121–F128 拆出的 19 条逐条 token 落窗脚本核验；quality 14 条 evidence（含 evidence2）raw bytes 脚本比对；4 条 high 逐条看源码原文；status/lint/禁用词机器校验
- 总体 verdict：**FAIL** —— 9 项清单中 7 项修到位，剩余 2 条拆分事实窗口违规；quality evidence 有 4 处缩进剥离未修；抽样另发现 3 处 facts 窗口违规。实质结论（4 个 high）全部为真，不用重做走查。

---

## 一、9 项清单复验：7 PASS，2 FAIL

### PASS（7 项）
1. **F72 拆条** ✓：index 71 `WebChatHttpBridge.kt:2660`（窗口 2655–2667 覆盖反斜杠/`..` 判空两处 return null）；index 72 `:250`（窗口 245–255 覆盖 `FORBIDDEN`/`"Access denied"`）。
2. **F79 拆条** ✓：index 79 `:471`（createNewChat 调用）；index 80 `:480`（`if (request.setCurrent) switchAppChatContext(newChat.id)`）。
3. **F106** ✓：index 107 `:1311`（窗口 1306–1316 覆盖 `addHeader("Cache-Control", "no-store")`）。
4. **正文行数** ✓：md 写 570/760，`wc -l` 确认 ExternalChatHttpServer.kt=570、WebChatModels.kt=760。
5. **数据模型数量** ✓：md 写"~50 个数据模型"，`grep -c @Serializable`=49。
6. **状态码 413→400** ✓：md §6 写"返回 400"；Q06 detail 已删掉错误的 413 表述；源码 :1010–1014 确为 `BAD_REQUEST`。
7. **readRegisteredAsset 五分支** ✓：md 第 97 行按源码五分支重写（`file:///android_asset/`、`android_asset/`、`content://`/`android.resource://`、`file://`、普通文件路径），无 http(s)/data URI 虚构。

### FAIL（2 项，均在 F121–F128 的 19 条拆分中）
- **facts[133]** `WebChatModels.kt:195`：断言含 `use_system_theme`，该 SerialName 实际在 **:202**，±5 窗口（190–200）够不着。修：锚点改为 :200（窗口 195–205 覆盖 source/theme_mode/use_system_theme 三处）。
- **facts[135]** `WebChatModels.kt:491`：断言含 `current_model_name`，实际在 **:498**，±5 窗口（486–496）够不着。修：锚点改为 :496（窗口 491–501 覆盖 current_config_id/current_model_index/current_model_name）。
- 其余 17 条拆分事实逐条 token 落窗脚本核验全部 PASS。

---

## 二、quality.json：4 处 evidence 缩进剥离未修（清单第 8 项部分 FAIL）

raw bytes 脚本比对（逐行精确匹配，含缩进）：
- **Q01 evidence**（line 548）：`private const val LISTEN_HOST = "0.0.0.0"` —— 源码行首有 8 空格，evidence 剥掉了缩进。
- **Q01 evidence2**（evidence2_line 60）：`start(SOCKET_READ_TIMEOUT, false)` —— 源码行首有 8 空格，evidence 剥掉了缩进。
- **Q03 evidence**（line 83）：`!session.uri.startsWith(API_PREFIX) -> webChatBridge.serveStatic(session)` —— 源码行首有 12 空格，evidence 剥掉了缩进。
- **Q05 evidence**（line 401）：`return if (actualToken == expectedToken) {` —— 源码行首有 8 空格，evidence 剥掉了缩进。
- 其余 10 条的 evidence（含 Q02 的 Bearer 鉴权错误串，已按 raw bytes 比对，显示层脱敏不影响结论）与 evidence2 内容逐字一致。

另有 2 处元数据小瑕（不阻塞，供修错员顺手处理）：
- Q03 evidence2（serveStatic 实现，evidence2_line 237）与 Q12 evidence2（STREAM_EVENT_* 常量，evidence2_line 2910）的代码实际在 **WebChatHttpBridge.kt**，但条目的 `file` 字段写的是 ExternalChatHttpServer.kt。evidence 文本本身逐字无误。

**4 条 high 实锤逐条看源码确认**：Q01 `LISTEN_HOST = "0.0.0.0"`（:548）+ NanoHTTPD 纯 HTTP 无 TLS；Q02 `handleApi` 中 assets 路由（WebChatHttpBridge.kt:111–112）在 `requireBearerToken`（:115）之前短路返回；Q03 `serve()` 非 /api 路径直交 `serveStatic`（:83）且其内部无 token 校验；Q04 `withCors` 加 `Access-Control-Allow-Origin: *`（:539）。severity 评级恰当，无夸大。

---

## 三、facts 25 条随机抽样：另发现 3 处窗口违规（第一名 critic 未覆盖）

- **facts[93]** `WebChatHttpBridge.kt:1043`：断言"返回 attachment_id、file_name、mime_type、file_size"，`WebUploadedAttachment(` 构造调用在 :1046–1050，其中 mimeType（:1049）、fileSize（:1050）落在 ±5 窗口（1038–1048）之外。修：锚点改为 :1046（窗口 1041–1051 覆盖四字段）。
- **facts[98]** `WebChatHttpBridge.kt:1144`：断言"先写 start 与 user_message 两个 SSE 事件"，user_message 的 writeSseEvent 在 **:1151**，窗口（1139–1149）之外 2 行。修：锚点改为 :1147（窗口 1142–1152 同时覆盖 :1144 的 start 与 :1151 的 user_message），或拆条。
- **facts[115]** `WebChatHttpBridge.kt:2607`：断言"按 UPLOAD_TTL_MS（2 小时）清理上传"，UPLOAD_TTL_MS 的使用处在 **:2616**，窗口（2602–2612）之外。修：锚点改为 :2611（窗口 2606–2616 同时覆盖 :2610 的 ASSET_TTL_MS 与 :2616 的 UPLOAD_TTL_MS）。
- 其余 22 条抽样：ref 文件存在、行号无越界、±5 窗口完整支撑断言，无虚构符号、无复合事实。

---

## 四、status.json / lint / 禁用词：PASS

- status.json：`{"id":"integrations-webchat","issue":80,"status":"review-pending","source_repo":"operit","source_commit":"dbf71916fae9750cfdc9f9a774f5a0fee56633fb","refs_valid":152}` —— issue/状态/commit 正确，refs_valid=152 与 facts 数组长度一致。
- facts/quality 顶层均为数组；severity 仅 high/warn/suggestion（4/7/3）。
- 隔离 lint（/tmp，不含 lint.md）：0 硬失败 / 0 警告。
- 禁用词（5 文件全文）：0 命中。

---

## 总体 verdict：FAIL，需修错后由另一名独立 critic 复验

**必须修的问题清单**：
1. facts[133] 锚点 :195 → :200。
2. facts[135] 锚点 :491 → :496。
3. facts[93] 锚点 :1043 → :1046。
4. facts[98] 锚点 :1144 → :1147（或拆条）。
5. facts[115] 锚点 :2607 → :2611。
6. Q01 evidence / evidence2、Q03 evidence、Q05 evidence 恢复源码原始缩进（逐字）。
7. （顺手）Q03/Q12 的 evidence2 实际文件为 WebChatHttpBridge.kt，与 `file` 字段不一致，确认 schema 语义后处理。

本 critic 未修改任何交付文件。
