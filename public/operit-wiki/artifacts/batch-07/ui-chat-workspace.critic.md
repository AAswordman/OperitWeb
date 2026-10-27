# Critic 报告 — ui-chat-workspace（Issue #95）

- 批评日期：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核 `git rev-parse` = dbf71916）
- 交付物：`review/batch-07/ui-chat-workspace.{md,facts.json,quality.json,lint.md,status.json}`
- writer 自报：facts 201 条、quality 21 条（high 2/warn 12/suggestion 7）、lint 0/0
- 核验方式：201 条 facts 逐条拉取 `file:line ±5` 窗口比对断言；21 条 quality 用脚本机械校验 evidence 逐字匹配（含缩进）；lint 在 /tmp 隔离复制后独立重跑；正文通读核行数/数量/禁用词。

## 总体结论

**verdict: FAIL**（需修后复验）

- 事实真值：201 条 facts 中 200 条断言本身为真，**1 条虚假（F74）**；约 **35 条行锚漂移**（±5 窗口内不含断言代码），其中 F5/F103/F104/F110/F112/F128/F130/F131/F133/F134/F154/F155/F171/F176/F179/F186 等锚点偏离 10–90 行。
- quality 21 条：evidence 全部逐字验真（脚本机械匹配 21/21），severity 仅用 high/warn/suggestion，描述与源码一致——**quality 部分 PASS**。
- lint 独立重跑：**0 硬失败 / 0 警告**，与 writer 自报一致——PASS。
- 禁用词"通过/批准/LGTM"：4 个交付文件全文 0 命中——PASS。
- `.status.json`：refs_valid=201 与 facts 条数一致，status=review-pending，未擅自批准——PASS。
- 正文硬伤：来源小节写"原子事实（120 条）"，实际 201 条。

writer 的 lint.md 称"已修正 9 处行号漂移"，但仍有约 35 处同类漂移残留，说明其行锚校验流程不可靠（多为凭印象估算行号，未 grep 精确定位）。本次 critic 给出的每个修正锚点均为 grep/sed 实地核对。

---

## 一、虚假断言（必须改）

### F74（WorkspaceUtils.kt:323）— FAIL，事实错误
- 原文："各项目模板的默认配置均启用导出（export.enabled=true）。"
- 真相：10 种项目模板（blank/android/flutter/web/node/typescript/python/java/go/office）中**只有 web 模板**（:322-324）`export.enabled=true`，其余 9 种均为 `false`（:124/:209/:296/:381/:448/:511/:588/:644/:672）。
- 修法：改写为"仅 web 模板默认启用导出（export.enabled=true），blank/android/flutter/node/typescript/python/java/go/office 九种模板默认为 false"，ref 改为 :322。

---

## 二、行锚漂移（断言为真，但 file:line ±5 窗口不支持断言）

| # | 原 ref | 修正 ref | 说明 |
|---|---|---|---|
| F5 | LocalWebServer.kt:185 | :104 | `Os.socket(..., SOCK_STREAM or SOCK_CLOEXEC, 0)` 实际在 `createSocket`（:100-110，socket 调用在 :107），:185 只是类声明 |
| F23 | LocalWebServer.kt:717 | :723 | CookieManager 取 Cookie 并附加在 :723-726，:717 窗口只到 :722 |
| F24 | LocalWebServer.kt:743 | :750 | 响应头剥离 `setOf("content-length","content-encoding","transfer-encoding","connection")` 在 :750，:743 窗口只到 :748 |
| F25 | LocalWebServer.kt:817 | :821（建议） | evidence 实际起于 :821（`addCorsHeaders` 定义），:817 恰在 ±5 边界内，属可接受但建议收紧 |
| F79 | FileManager.kt:85 | :87 | `onFileOpen` 参数在 :91，:85 窗口只到 :90 |
| F95 | WorkspaceBackupManager.kt:56 | :60 | 9 个工具名分布在 :57-65，:56 窗口只到 :61（漏 move_file/delete_file/copy_file/make_directory） |
| F103 | WorkspaceBackupManager.kt:630 | :661 | chatId 规范化实际是 `normalizeChatScope`（:661-665，`__default__` 在 :663），:630 处是 SHA-256 快照函数 |
| F104 | WorkspaceBackupManager.kt:613 | 拆分（见下） | :613 处是删除路径的函数，与 SHA-256/分片路径无关；且本条为复合断言 |
| F110 | WorkspaceBackupManager.kt:1036 | :1010 | `DiffUtils.diff` 在 `estimateChangedLines`（:1010-1015）内，:1036 只是 `previewChanges` 签名；建议 fact 改写为指向 `estimateChangedLines` |
| F111 | WorkspaceBackupManager.kt:248 | :254 | `.backup/` 排除条件在 :254-255，:248 窗口只到 :253 |
| F112 | WorkspaceBackupManager.kt:641 | :678 | `makeRelativePath` 定义在 :678，:641 处是文件 stat 代码 |
| F113 | WorkspaceCommandExecutionState.kt:4 | :8 | 9 个字段分布在 :4-12，:4 窗口只到 :9（漏 isRunning/isVisible/isCancelling） |
| F115 | WorkspaceConfig.kt:15 | :20 | 8 个字段分布在 :16-24，:15 窗口只到 :20（漏 preview/commands/export/watch） |
| F128 | WorkspaceFilePreviewSupport.kt:148 | :136 | `Uri.fromFile` 回退在 :136，:148 是另一个函数的分支 |
| F130 | WorkspaceImagePreview.kt:42 | :48 | 缩放常量（1f/2.5f/5f）在 :48-50，:42 是 import 行 |
| F131 | WorkspaceImagePreview.kt:88 | :73 | Coil 缓存策略在 :73-75，:88 是 painter 状态判断 |
| F133 | WorkspaceImagePreview.kt:10 | :234 | `clampImageOffset` 定义在 :234，:10 是 import 行 |
| F134 | WorkspaceImagePreview.kt:252 | :174 | 文件名徽标（`Alignment.BottomStart` 半透明 Surface）在 :171-186，:252 是 `doubleTapOffset` 函数 |
| F135 | WorkspaceManager.kt:164 | :167 | `onExportClick` 参数在 :170，:164 窗口只到 :169 |
| F144 | WorkspaceManager.kt:521 | :530 | "HTML 默认进预览态"（`this[fileInfo.path] = fileInfo.isHtml`）在 :534-535，:521 窗口只到 :526 |
| F146 | WorkspaceManager.kt:1250 | :1259 | `DialogProperties(dismissOnBackPress=false, dismissOnClickOutside=false)` 在 :1259 |
| F147 | WorkspaceManager.kt:1410 | :1418 | `rememberLocal<FabPosition?>("fab_menu_offset", null)` 在 :1418，:1410 是 BoxWithConstraints |
| F148 | WorkspaceManager.kt:1052 | 拆分（见下） | :1052 只支撑"格式化仅 js/css/html"，菜单项清单（撤销/重做/格式化/文件管理/导出/重命名/解绑）在 :1395-1407 |
| F151 | WorkspaceManager.kt:1708 | :724 | "非 browser 预览时"条件（`workspaceConfig.preview.type != "browser"`）在 :724，:1708 只是函数内 forEach |
| F154 | WorkspaceReadOnlyDocumentPreview.kt:62 | :97 | pdf/Word/表格路由 `when` 在 :97-112，:62 是 State 数据类 |
| F155 | WorkspaceReadOnlyDocumentPreview.kt:108 | :122 | `rememberWorkspacePreviewFileState` 定义在 :122（key1/2/3 在 :130-133），:108 是路由 when 块 |
| F156 | WorkspaceReadOnlyDocumentPreview.kt:342 | 拆分（见下） | `read_file_binary` 在 :353-360，`cacheDir/workspace_document_preview` 在 :372；:342 窗口只到 :347 |
| F171 | DepthLimitedFileObserver.kt:21 | :28 | `EVENT_MASK`（8 种事件）在 :27-35，:21 是类声明 |
| F175 | DepthLimitedFileObserver.kt:128 | :145 | 新目录自动 `watchDirectory` 在 :145（删除目录移除 observer 在 :152）；:128 是内部类声明；且本条为复合断言 |
| F176 | DepthLimitedFileObserver.kt:101 | :113 | `kindFor` 映射在 :113-126，:101 是 `relativePathFor` |
| F179 | GitIgnoreFilter.kt:197 | :171 | 否定规则 `startsWith("!") → return false` 在 :170-173，:197 是路径匹配分支 |
| F186 | WorkspaceAttachmentProcessor.kt:36 | :48 | `escapeText` 定义在 :48-55，:36 是函数尾 |
| F188 | WorkspaceChangeTracker.kt:59 | :65 | `updateOwner` 的移除条件体在 :65-69，:59 窗口只到 :64 |
| F189 | WorkspaceChangeTracker.kt:87 | :107 | 清空 changes/omittedCount/initialRootStructure/aiChangedPaths 在 :107-110 |
| F190 | WorkspaceChangeTracker.kt:115 | :122 | `ignoreAiChanges` 的记入/移除逻辑在 :122-130，:115 窗口只到 :120 |
| F195 | WorkspaceRuleFileReader.kt:17 | :33 | `read_file_full(text_only=true)` 工具调用在 :29-39，:17 只是函数签名 |

其余约 165 条 facts：断言为真且 ±5 窗口完整支撑，PASS。

---

## 三、复合断言必须拆分

1. **F104**（WorkspaceBackupManager.kt:613）：含三个独立断言——(a) SHA-256 内容寻址（:630-633）(b) 分片路径 `objectsDir/哈希前两位/完整哈希`（:690）(c) 兼容旧扁平路径（:699-703，`buildLegacyObjectPath`）。拆成 2 条：F104a（SHA-256，ref :630）、F104b（分片+legacy 兼容，ref :690）。
2. **F148**（WorkspaceManager.kt:1052）：(a) 菜单项清单（ref :1395）(b) 格式化仅 js/css/html（ref :1052 保留）。
3. **F156**（WorkspaceReadOnlyDocumentPreview.kt:342）：(a) SAF 经 `read_file_binary`（ref :353）(b) 缓存到 `cacheDir/workspace_document_preview`（ref :372）。
4. **F175**（DepthLimitedFileObserver.kt:128）：(a) 新建目录自动加 watch（ref :145）(b) 删除/移走目录移除其下全部 observer（ref :152）。
5. **F13**（LocalWebServer.kt:462，可选）：两个调用点（:462 与 :495）各注入一次；建议拆成两条或 ref 改为函数定义 :513。

拆分后 facts 总数变为 201 - 5 + 10 = **206**（F104/F148/F156/F175/F13 各 1→2）。

---

## 四、quality.json 逐条结论（21/21 PASS）

evidence 经脚本机械比对全部逐字匹配（含缩进），行锚均在 ±5 内，severity 仅用 high/warn/suggestion：

- Q1 high（LocalWebServer.kt:712，evidence 实际起于 :716）：开放代理 + Cookie 自动附加。构造 `: NanoHTTPD(port)`（:52）未指定 bind 地址，NanoHTTPD 默认监听全网卡——描述准确。**建议** evidence 追加 :52 构造行，否则"全网卡"断言无 evidence 行。
- Q2 high（WebViewHandler.kt:163，evidence 起于 :162）：JS/混合内容/文件访问全开——实锤，PASS。
- Q3–Q14 warn（12 条）：权限直接 grant（:362）、SSL 点继续放行（:276）、CORS `*`+credentials（:821）、二进制静默不备份（:548）、gitignore 否定不支持（:170）、SAF 无变更追踪（:65）、保存后立即关标签竞态（:1171）、makeRelativePath 前缀误判（:678）、跨聊天停服（:200）、配置损坏回退开服默认（:96）、删除无二次确认（:356）、Eruda 公网 CDN（:589）——逐条已核源码，全部属实，severity 恰当。
- Q15–Q21 suggestion（7 条）：整文件进内存（:456）、runBlocking 阻塞工具线程（:144）、hashCode 碰撞（:374）、Coil 缓存禁用（:71）、加载失败静默（:222）、子目录规则忽略（:12）、下载无大小限制（:101）——全部属实。

---

## 五、正文（md）核验

- 21 个种子文件、9758 行：与 `wc -l` 实测完全一致——PASS。
- 各文件行数断言（865/756/751/784/972/1178/20/131/198/269/1757/24/508/60/636/164/246/56/275/57/51）：全部与实测一致——PASS。
- **FAIL**：来源小节"原子事实见 `ui-chat-workspace.facts.json`（120 条）"→ 实际 201 条，**必须改为 201 条**（若采纳拆分建议则为 206 条）。
- 正文断言抽查（HTML baseUrl 取 `file://` 父目录 :907、Markdown 经 StreamMarkdownRenderer :119-146、重命名有未保存拒绝 :1042、FAB 键盘弹起隐藏 :1002、音视频 isAudio/isVideo 分支 :811/:845）：源码均属实，但 facts.json 中**没有对应 facts**（无 baseUrl、无 Markdown 渲染、无 rename-save-first、无 IME 隐藏 FAB、无音视频预览 facts）——正文-facts 覆盖缺口，建议补 4–5 条 facts 或删减正文对应句子。
- 禁用词：全文 0 命中——PASS。
- `WorkspaceOption` 列入关键符号：存在（WorkspaceSetup.kt:583 定义），但无对应 fact——同属覆盖缺口，轻微。

---

## 六、lint 独立重跑

`/tmp` 隔离复制后 `python3 scripts/lint.py --src ~/workspace/Operit`：**硬失败 0 / 警告 0**——与 writer 自报一致，PASS。

---

## 七、需修清单（writer 修错用）

1. F74 重写（虚假断言）→ ref :322。
2. 上表 35 处行锚按"修正 ref"列逐条修正（均为实地 grep/sed 核对，勿再估算）。
3. F104/F148/F156/F175 拆分（F13 可选），facts 总数更新为 206。
4. md 来源小节"120 条"→"201 条"（拆分后 "206 条"）；同步更新 `.status.json` 的 `refs_valid`。
5. 可选：补正文无 facts 支撑的 4–5 条 facts（HTML baseUrl file://、StreamMarkdownRenderer、rename-save-first、IME 隐藏 FAB、音视频预览分支）；Q1 evidence 追加 LocalWebServer.kt:52 构造行。
6. 修完后需重新跑 lint 并由独立 critic 复验（重点抽查本次点名的锚点），再走 build→deploy→公网验证。

## 最终 verdict

**FAIL** —— 1 条虚假断言（F74）+ 约 35 处行锚漂移 + 正文来源数量错误（120≠201）。quality 与 lint 无问题。按用户铁律"不合格就一直迭代"，打回修错，不得直接发布。
