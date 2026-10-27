# Critic 复核报告：integrations-webchat（Issue #80）

- 复核对象：`review/batch-06/integrations-webchat.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 复核方式：139 条 facts 逐条取 ref 文件 ±5 行窗口比对断言；14 条 quality evidence 逐字串匹配源码；正文关键数字/状态码/枚举逐项核源码；status/lint/禁用词机器校验
- 总体 verdict：**FAIL** —— 11 条 facts 引用缺陷、4 处正文事实错误、9 处 quality evidence 非逐字。实质结论（4 个 high 的存在性）全部为真，不用重做走查，只需按清单修引用与文字。

---

## 一、facts.json（139 条）：128 PASS，11 FAIL

### PASS（128 条）
F1–F71、F73–F78、F80–F105、F107–F120、F129–F139：ref 文件存在、行号不越界、±5 窗口完整支撑断言，断言原子、无虚构符号。抽查实锤：
- F2 `LISTEN_HOST = "0.0.0.0"` :548 ✓；F39 CORS `*` :538-542 ✓；F49 assets 路由在鉴权前 :111-115 ✓；F83 serveStatic 无鉴权路由 :83 ✓
- F20 `response_mode must be sync/async_callback` 与源码错误串逐字一致 ✓
- F119 "全部 @Serializable" 经脚本验证 49/49 类 ✓

### FAIL（11 条）
1. **F72**（:2652）：引用窗口违规。断言含两部分——(a) normalizeStaticPath 拒反斜杠/`..`（实际在 :2660-2665），(b) serveStatic 对其返 403（实际 :250）。±5 窗口（2647-2657）两处都看不到。修：拆成两条，分别锚 :2660 与 :250。
2. **F79**（:463）：行号错位。锚点落在函数声明行，断言的 `createNewChat`/`setCurrent→switchAppChatContext` 在 :471-482。修：锚点改 :471。
3. **F106**（:1305）：引用窗口违规。`Cache-Control: no-store` 实际在 :1312，窗口（1300-1310）看不到。修：锚点改 :1311。
4. **F121–F128**（8 条，系统性锚点错误＋复合事实）：锚点全部指向错误的类——
   - F121（WebChatSummary 字段）锚 :33，实际 :33 是 WebCapabilities 的字段行；类定义在 :43
   - F122（WebChatMessage 字段）锚 :58，实际 :58 是 WebChatSummary 尾部；类定义在 :87
   - F123（WebChatMessagesPage）锚 :118，实际是 WebMessageAttachment 结尾/WebReplyPreview 起始；类定义在 :163
   - F124（WebChatStreamEvent）锚 :388，实际是 WebDisplayPreferences 字段；类定义在 :547
   - F125（WebSendMessageRequest）锚 :472，实际是 WebThinkingQualityOption；类定义在 :709
   - F126（WebThemeSnapshot）锚 :140，实际是 WebMessageContentBlock；类定义在 :195
   - F127（WebModelSelectorState）锚 :350，实际是主题 padding 字段；类定义在 :491
   - F128（WebInputSettingsState）锚 :430，实际是 WebCharacterCardSelectorItem；类定义在 :649
   - 8 条断言内容经核实**全部为真**（字段清单与源码一致），只需修正锚点；另这 8 条均为"一条列 N 个字段"的复合事实，按原子化要求应拆成单字段断言（或每条只保留窗口内可见的字段）。

---

## 二、quality.json（14 条）：实质 14/14 为真，形式 9 处 FAIL

### 实质结论（全部成立）
- **Q01 high** ✓：`LISTEN_HOST = "0.0.0.0"`（:548 逐字命中）＋ 全程无 TLS（NanoHTTPD 纯 HTTP），同一局域网可嗅探明文 Bearer token。评级恰当。
- **Q02 high** ✓：`handleApi` 中 assets 路由（:111-112）在 `requireBearerToken`（:115）之前短路返回，免鉴权。评级恰当。
- **Q03 high** ✓：`serve()` 把非 /api 路径直接交 `serveStatic`（:83），其内部无 token 校验。detail 已诚实限定"调 API 仍要 token"，评级可接受。
- **Q04 high** ✓：`withCors` 给全部响应加 `Access-Control-Allow-Origin: *`（:538-542）。评级恰当。
- Q05 warn（`==` 明文比对，:401 逐字命中）、Q06 warn（先 parseBody 落盘后查大小，:996/:1010）、Q07 warn（sync 模式 runBlocking 占 NanoHTTPD 线程）、Q08 warn（回调失败只打日志）、Q09 warn（2h TTL 删文件但消息 attachment id=绝对路径，:2618-2619/:1132）、Q10 warn（强制 Content-Length）、Q11 warn（switchAppChatContext 打到全局会话）、Q12/Q13/Q14 suggestion：机制描述与源码一致，评级合理。

### 形式 FAIL（必须修）
1. **evidence 非逐字原文**（铁律要求源码逐字复制）：Q02、Q04、Q07、Q08、Q10、Q11、Q13、Q14 的 evidence 首行被去掉源码缩进；Q02/Q07 续行缩进被改写（12 空格→16 空格）；Q10 甚至把 `}?.value` 写成 `? .value`。Q03/Q06/Q09/Q12 的 evidence2 同样被重排缩进。修：从源码原样复制含缩进的代码块。
2. **行号错位**：Q06 evidence1 标 :995 实际 :996；Q06 evidence2 标 :1007 实际 :1010；Q09 evidence2 标 :1032 实际 :1033。
3. **Q06 detail 文字错误**："超大文件先写满临时磁盘再 413"——源码 :1010-1014 返回的是 `BAD_REQUEST`（400），不是 413。修：改 "413" 为 "400"。
4. 键名说明：本页 quality.json 用 `title`/`detail` 而非任务简报写的 `description`，但与 `site/quality.html` 模板消费的字段（`f.title`/`f.detail`/`f.evidence`）一致，**不视为缺陷**，不用改。

---

## 三、正文 integrations-webchat.md：4 处事实错误 FAIL

1. **文件行数写错两处**：多处写 "ExternalChatHttpServer ~670 行"（AI 速览、§1 标题、来源），实际 570 行；"WebChatModels.kt 约 490 行"（AI 速览、来源），实际 760 行。修：570 / 760。
2. **数据模型数量**："WebChatModels（~40 个数据模型）"，实际 49 个 @Serializable 数据类。修：~50。
3. **状态码写错**：§6 "单文件超 25MB（MAX_UPLOAD_BYTES）直接 413"——源码返回 400（`Response.Status.BAD_REQUEST`）。修：400。
4. **虚构 URI scheme**：§6 "readRegisteredAsset 支持 file:///android_asset/、content URI、http(s)、data URI、本地文件"——源码 `when` 分支实际为：`file:///android_asset/`、`android_asset/`、`content://`/`android.resource://`、`file://`、普通文件路径；**没有 http(s)、没有 data URI**。修：删掉虚构的两项，按源码五分支写。
5. 其余：结构符合双受众规范（概述/AI 速览/核心机制/关键符号/调用链/来源）；10 个种子文件来源全列；4 条调用链与源码一致；行内引用 `:379`/`:2623` 等准确；"约 20 条路由"（实际 21 个路由项）可接受。

---

## 四、status.json / lint / 禁用词：PASS

- status.json：`{"id":"integrations-webchat","issue":80,"status":"review-pending","source_commit":"dbf71916...","refs_valid":139}` —— issue/状态/commit 正确，refs_valid=139 与 facts 条数一致，critic 为空（待本报告后由 parent 填）。
- lint：隔离复跑 0 硬失败 / 0 警告 ✓
- 禁用词：5 文件 "通过/批准/LGTM" 0 命中 ✓
- severity 枚举：仅 high/warn/suggestion ✓

---

## 总体 verdict：FAIL，需修错后复验

**必须修的问题清单**（修错员按条改，不许改实质结论）：
1. F72 拆成两条并修正锚点（:2660 / :250）。
2. F79 锚点 :463 → :471。
3. F106 锚点 :1305 → :1311。
4. F121–F128 修正 8 个锚点（:43 / :87 / :163 / :547 / :709 / :195 / :491 / :649）并按原子化拆分复合字段断言。
5. 正文：ExternalChatHttpServer 670→570 行；WebChatModels.kt 490→760 行；数据模型 ~40→~50。
6. 正文 §6 与 Q06 detail：超限状态码 413→400。
7. 正文 §6：readRegisteredAsset 支持的来源删掉 http(s)/data URI，按源码五分支重写。
8. quality.json：Q02/Q03e2/Q04/Q06e2/Q07/Q08/Q09e1/Q10/Q11/Q12/Q13/Q14 的 evidence（含 evidence2）改为源码逐字原文（含原始缩进）。
9. quality.json：Q06 evidence 行号 995→996、1007→1010；Q09 evidence2 行号 1032→1033。

修完后需另一名独立 critic 复验（本 critic 不复验自己挑过的问题）。
