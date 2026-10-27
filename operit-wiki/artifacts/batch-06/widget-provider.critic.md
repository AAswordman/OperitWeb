# Critic 复核报告：widget-provider（Issue #82）

- 复核对象：`review/batch-06/widget-provider.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916`
- 复核方式：146 条 facts 全部拉出 ref±5 行窗口逐条比对；quality 13 条 evidence 逐字比对源码；正文通读核对。
- **总体 verdict：FAIL**（事实性错误 3 处 + 正文连带错误 3 处 + facts 引用行号漂移约 35 条 + quality 行号漂移 9 条，需修错员修正后复验）

## 一、事实性错误（必须修）

### F1. facts [29]：偏好键数量错误
- 原文："saveSelection 用 commit() 同步写入 **11 个**偏好键"（ref `ToolPkgDesktopWidgetHost.kt:82`）
- 实际：`saveSelection` 共 10 个 put（selection/route/renderRoute/container/widgetId/title/subtitle/description/icon/order），`ToolPkgDesktopWidgetHost.kt:66-79`
- 修正：11 → 10；ref 改为 `:72`（commit 行）或保留 :79（`.commit()` 实际在 79 行）

### F2. facts [30]：偏好键数量错误
- 原文："clearSelection 用 apply() 删除 **11 个**偏好键"（ref `ToolPkgDesktopWidgetHost.kt:98`）
- 实际：10 个 remove，`ToolPkgDesktopWidgetHost.kt:83-96`，`.apply()` 在 96 行
- 修正：11 → 10；ref 改为 `:96`

### F3. facts [115]：JSON 字段数量错误
- 原文："buildMemoryJson 序列化 **14 个**字段并缩进 2 格"（ref `MemoryDocumentsProvider.kt:845`）
- 实际：13 个 `obj.put`（uuid/title/content/contentType/source/credibility/importance/folderPath/isDocumentNode/documentPath/createdAt/updatedAt/lastAccessedAt），`toString(2)` 缩进 2 格正确；`MemoryDocumentsProvider.kt:843-856`
- 修正：14 → 13；ref 改为 `:843`（窗口覆盖全部 put）

### F4. 正文连带错误（3 处，同源）
- `## 核心机制` §3："序列化成含 14 个字段的 JSON" → 13
- `链路三`："buildMemoryJson 序列化成 14 字段 JSON" → 13
- `链路一`："saveSelection 把 11 个字段 commit()" → 10 个

## 二、facts 引用行号漂移（断言为真，但 ref±5 窗口不支持，必须重定位）

以下每条的断言经源码核实为真，但 ref 行号落在无关代码上，违反"±5 窗口完整支撑"铁律。给出正确行号：

**ToolPkgDesktopWidgetDslRenderer.kt：**
| # | 断言 | 原 ref | 正确行 |
|---|---|---|---|
| 47 | 列表项以 buildSelectionKey 作为 key | ConfigActivity.kt:152 | ConfigActivity.kt:**169**（`key = { widget ->`） |
| 48 | 卡片显示标题/副标题/容器包名/描述 | ConfigActivity.kt:177 | ConfigActivity.kt:**192**（卡片 Column 起） |
| 49 | 点击卡片选中并回调 onSelect | ConfigActivity.kt:165 | ConfigActivity.kt:**184**（`.clickable {`） |
| 65 | 按钮类节点渲染为蓝色背景 Box+白色文字 | :191 | **:200**（`"button", "textbutton", …` 分支） |
| 66 | linearprogressindicator 渲染为百分比文字 | :210 | **:223** |
| 67 | circularprogressindicator 渲染为"Loading"文字 | :225 | **:239** |
| 68 | 未知类型节点子节点拍平成 Column | :236 | **:250**（`else ->`） |
| 69 | collectWidgetChildren 合并 children 与 slots | :249 | **:282**（函数定义） |
| 70 | extractNodeText 取值优先级 | :258 | **:291**（函数定义） |
| 71 | 可点击/显式 onClick 绑定路由点击动作 | :299 | **:338**（`if (clickable \|\| hasExplicitClick)`） |
| 72 | padding 三种写法 | :309 | **:349**（数字分支起；Map 分支 :352，属性分支 :358） |
| 73 | primary → 0xFF1E88E5 | :355 | **:393** |
| 74 | surface → 0xFFF6F4EE | :357 | **:395** |
| 75 | parseColorString 先 token 后 parseColor | :373 | **:405**（函数定义） |
| 76 | bold/semibold/medium → FontWeight.Bold | :383 | **:418**（函数定义） |

**MemoryDocumentsProvider.kt：**
| # | 断言 | 原 ref | 正确行 |
|---|---|---|---|
| 89 | 根标题"Operit Memory Library" | :247 | **:233** |
| 90 | 根 MIME 类型 application/json、text/plain、*/* | :241 | **:226** |
| 91 | 根 flags FLAG_SUPPORTS_CREATE/IS_CHILD | :244 | **:229** |
| 92 | 根 AVAILABLE_BYTES 硬编码 0L | :253 | **:236** |
| 93 | 根的子文档为各记忆空间 | :271 | **:262**（`is DocRef.Root ->` 块） |
| 111 | moveDocument 禁止跨记忆空间移动 | :142 | **:170**（`Cross-profile move is not supported`） |

**OperitDataDocumentsProvider.kt：**
| # | 断言 | 原 ref | 正确行 |
|---|---|---|---|
| 129 | openDocument 拒绝打开目录 | :107 | **:113**（`if (file.isDirectory) throw`） |
| 130 | 删除目录使用递归删除 | :142 | **:152**（`file.deleteRecursively()`） |
| 131 | moveDocument 校验源父目录包含源文档 | :180 | **:194**（`Source parent does not contain source document`） |
| 132 | ensureInsideDataRoot 越界抛 SecurityException | :288 | **:307**（函数定义） |
| 133 | isSameOrChild 用 canonical+分隔符判断 | :296 | **:315**（函数定义） |
| 134 | resolveChildFile 拒绝空白名/斜杠/空字符 | :276 | **:293**（函数定义） |
| 135 | 根文档显示名为包名 | :227 | **:243**（`getDisplayName`） |
| 136 | MIME 用 MimeTypeMap 失败回退 octet-stream | :239 | **:256** |

**WorkspaceDocumentsProvider.kt：**
| # | 断言 | 原 ref | 正确行 |
|---|---|---|---|
| 142 | deleteDocument 用非递归 file.delete() | :159 | **:172** |
| 143 | isChildDocument 用 startsWith 无分隔符 | :178 | **:193** |
| 144 | getFileForDocId 直接拼接无越界校验 | :243 | **:270**（`File(workspaceRoot, relativePath)`） |
| 145 | renameDocument 用 File(parent, displayName) 未消毒 | :166 | **:179** |

## 三、quality.json（13 条）

- **13/13 evidence 均为源码逐字原文**，已用脚本全量比对确认命中。
- **severity 评级合理**：3 个 high 均为真实问题（Workspace 路径穿越可读写任意应用私有文件；isChildDocument 前缀误判；非递归删除导致含文件目录删不掉抛异常）；warn 均为真实隐患；suggestion 均为真实限制。无夸大。
- **行号漂移 9 条**（evidence 为真，file:line 需修正）：
  - [0] `:243` → **:265**（getFileForDocId 定义）
  - [1] `:178` → **:192**（`child.canonicalPath.startsWith`）
  - [2] `:159` → **:172**（`if (!file.delete())`）
  - [3] `:166` → **:178**（renameDocument 定义）
  - [4] `:133` → **:145**（`File(parent, displayName)`）
  - [5] `:82` → **:79**（`.commit()`）；且 description 中"11 个键"→ **10 个键**
  - [6] `:123` → **:118**（refreshAll 定义）
  - [10] `:253` → **:236**（AVAILABLE_BYTES 0L）
  - [11] `:210` → **:223**（linearprogressindicator 分支）
  - [7] `:1061`→`:1060`、[9] `:384`→`:385`、[12] `:84`→`:83` 偏差在 ±5 内，可保留或顺手修正；[8] `:62` 正确。

## 四、其余检查（全部通过）

- **facts 机械检查**：146 条 ref 格式合法、文件存在、行号无越界；0 复合事实（启发式 0 命中，人工抽查原子化良好）；无虚构符号（抽查的符号均在源码中存在）。
- **facts 其余约 108 条**：ref±5 窗口完整支撑断言，无问题。
- **正文**：固定结构完整（概述/AI 速览/核心机制/关键符号/调用链五链路/来源）；"来源"小节文件行数与实际 `wc -l` 逐一核对一致（widget/ 1164 行、provider/ 1813 行）；10 个种子文件全覆盖 + AndroidManifest + 2 个 widget XML；双受众可读性好。
- **status.json**：`issue: 82`、`source_commit: dbf71916…`、`refs_valid: 146` 全部正确；`critic` 为空待填。
- **禁用词**：5 文件全文"通过/批准/LGTM" 0 命中。
- **lint**：0 硬失败 / 0 警告（注：lint.py 会把 `.lint.md` 本身当页面扫描，属脚本已知行为，实际页面 0/0）。

## 五、必须修的问题清单（修错员）

1. facts [29][30]："11 个偏好键"→"10 个"，ref 分别改为 `:79`、`:96`。
2. facts [115]："14 个字段"→"13 个"，ref 改为 `:843`。
3. 正文 3 处连带："14 个字段"×2 → 13；"11 个字段"×1 → 10。
4. facts §二表格 35 条 ref 行号按"正确行"列重定位。
5. quality.json 9 条 file:line 按§三修正；[5] description "11 个键"→"10 个键"。
6. 修正后重跑 lint（/tmp 隔离），确认 0/0；全文重 grep 禁用词。

修完后需另一名独立 critic 复验（writer 自检不能代替）。
