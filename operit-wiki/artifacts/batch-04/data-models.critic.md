# data-models 独立 critic 复核报告

- 条目：data-models（数据模型与实体类），Issue #61
- 源码钉住：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 `git rev-parse HEAD` 核实，工作树干净）
- 复核人：独立 critic（与 writer 无关）
- 复核日期：2026-10-01
- 方法：210 条 facts 逐条导出 `ref ±5` 行窗口全文核对；数量断言用脚本实数；quality 5 条证据与源码逐字 diff；正文按 SCHEMA §9 结构与行号精度检查；status.json 字段检查。

## 结论

**退回修正**：facts 28 条问题（26 条引用错位 + 2 条事实内容错误），正文 4 处行号引用错误。quality 5 条全部成立。修正 facts 引用行号、两处错误数字、正文行号后可重新送审。

## 一、facts 核验（210 条：182 通过 / 28 问题）

### 1.1 事实内容错误（2 条，断言本身与源码不符）

- **[101]** `ChatMessage.kt:62`「writeToParcel 按固定顺序写 15 个字段」——**错误**。`writeToParcel`（:60–79）实际执行 **17 次** `parcel.write*`（sender、content、timestamp、roleName、selectedVariantIndex、variantCount、provider、modelName、inputTokens、outputTokens、cachedInputTokens、sentAt、outputDurationMs、waitDurationMs、displayMode.name、isFavorite、completedAt）；读取侧构造函数（:41–57）同样读取 17 个字段。15 → **17**。
- **[116]** `SerializableColorScheme.kt:9`「30 个 Long 型颜色字段」——**错误**。该 data class（:9–38）实际只有 **29 个** `Long` 字段（primary…scrim，逐个数为 29）。30 → **29**。

### 1.2 引用错位（26 条：断言内容属实，但 ref 行 ±5 窗口不支持断言）

MnnModelDownloadManager.kt 尾部存在系统性行号漂移（越往后偏得越远，如 :726 实为 :794，疑似按旧版本文件估的行号）；另有 8 条分散在 model/ 文件。逐条修正建议（均为实测定位，窗口已验证可覆盖断言）：

| # | 原 ref | 断言 | 应改为 |
|---|--------|------|--------|
| 35 | EmbeddingDimensionUsage.kt:17 | fraction/isFinished 行为 | **:24**（fraction :23–24、isFinished :26–27） |
| 53 | ApiKeyFormatValidator.kt:10 | 多 key 优先选 AVAILABLE | **:20**（filter isEnabled :18、AVAILABLE :23） |
| 84 | OperitNodeInfo.kt:39 | getBounds 解析逻辑 | **:47**（函数体 :47–56） |
| 88 | MessageVariantEntity.kt:48 | fromChatMessage | **:59** |
| 92 | ChatEntity.kt:70 | fromChatHistory displayOrder 保留逻辑 | **:83** |
| 96 | MessageEntity.kt:54 | fromChatMessage | **:68** |
| 168 | ModelConfigData.kt:149 | llama 默认值 | **:167**（四个默认值 :167–170） |
| 171 | ModelConfigData.kt:228 | getValidModelIndex | **:238** |
| 188 | MnnModelDownloadManager.kt:156 | loadPersistentStates 按 .tmp 重算字节 | **:166**（tempFile :164、finalFile :168） |
| 189 | MnnModelDownloadManager.kt:195 | 恢复 Paused / 已完成清理 | **:186**（Paused 更新 :184–185、清理 :187–189） |
| 190 | MnnModelDownloadManager.kt:211 | 无状态删状态文件 | **:203**（isEmpty→delete :202–204） |
| 193 | MnnModelDownloadManager.kt:286 | repo/files 接口 Recursive=1 | **:294**（URL :296 在窗口内） |
| 194 | MnnModelDownloadManager.kt:354 | 去重判断 | **:345**（判断 :344–348） |
| 195 | MnnModelDownloadManager.kt:380 | 先持久化子任务再 downloadAllFiles | **:394**（持久化 :390–391、调用 :399） |
| 196 | MnnModelDownloadManager.kt:405 | HEAD 取长度、大小匹配跳过 | **:432**（跳过逻辑 :432–436；HEAD 请求在 :414，属复合事实，建议拆成两条） |
| 198 | MnnModelDownloadManager.kt:497 | 500ms 更新进度 | **:517**（判断 :516–518） |
| 200 | MnnModelDownloadManager.kt:557 | pause/cancel | **:565**（pauseFlags :563–564、cancel :567–570） |
| 201 | MnnModelDownloadManager.kt:565 | deleteModel | **:584**（deleteRecursively :580、removePersistentState :589） |
| 202 | MnnModelDownloadManager.kt:586 | getDownloadedModels | **:598** |
| 203 | MnnModelDownloadManager.kt:592 | isModelDownloaded | **:605** |
| 204 | MnnModelDownloadManager.kt:600 | getFileName | **:617** |
| 205 | MnnModelDownloadManager.kt:604 | formatSpeed | **:621** |
| 206 | MnnModelDownloadManager.kt:611 | formatFileSize | **:629** |
| 207 | MnnModelDownloadManager.kt:625 | getLastFileName | **:638** |
| 208 | MnnModelDownloadManager.kt:656 | 跳过已存在且大小匹配 | **:682** |
| 209 | MnnModelDownloadManager.kt:726 | 全部完成置 Completed 并清理 | **:794**（Completed :794、清理 :795） |

### 1.3 抽查通过的断言（实数核验）

枚举/数量断言全部与源码一致：FunctionType 11、WorkflowLogLevel 3、WorkflowExecutionFailureStage 4、ParameterValueType 5、ParameterCategory 4、ConditionOperator 10、ExtractMode 6、DownloadState 6、ApiProviderType 38、DEFINITIONS 7、SerializableTypography 15 个 TextStyle；MemorySearchConfig 四权重、ModelConfigDefaults 三阈值、Range 断点续传（:465 在窗口内）等均成立。

## 二、quality 核验（5 条：5 通过 / 0 问题）

5 条证据均与源码逐字一致（已做字节级 diff，含缩进与中文注释），line 定位准确，severity/confidence 合理：

- **Q0** warning/correctness `MnnModelDownloadManager.kt:787`：`downloadAllFiles` 内 `if (tempFile.exists()) { tempFile.renameTo(targetFile) }` 返回值被忽略，随后 :794 无条件置 Completed。证据逐字命中，high 合理。**成立**
- **Q1** warning/correctness `:390`：`files.map { PersistentFileTask(it.Path!!, it.Size) }`，`MsFileInfo.Path` 为可空（:59 `val Path: String? = null`），null 直接 NPE 中断整单。medium 合理。**成立**
- **Q2** warning/correctness `EmbeddingConverter.kt:16`：`buffer.asFloatBuffer()` 的 `remaining()` 为容量整除 4，非 4 倍数尾字节被静默丢弃。medium 合理。**成立**
- **Q3** suggestion/maintainability `:113`：`val MODEL_DIR` 无 private 修饰，以 public 暴露。high 合理。**成立**
- **Q4** suggestion/correctness `:145`：`loadPersistentStates()` 内 `applicationScope.launch` 异步执行，`init` 返回后 `getDownloadState` 仍可能读到旧初态，竞态真实存在。medium 合理。**成立**

## 三、正文核验（data-models.md）

- §9 结构完整：概述 / AI 速览（核心符号清单 + 主入口 + 数据流向一句话）/ 核心机制 / 关键符号 / 调用链（输入→处理→输出三段式编号）/ 来源，六节齐全。
- 术语首现给解释（如 sealed 接口、ObjectBox、Parcelable），符号名保留英文原文，未复述 [101]/[116] 的两个错误数字。
- **4 处行号引用错误**（与 facts 同源，需同步修正）：
  1. 核心机制「`fromChatHistory` 在 displayOrder 非零时保留」`ChatEntity.kt:62` → 应为 **:83**（调用链第 3 条同错）。
  2. MNN 节「已在下载或连接中时忽略重复调用」`MnnModelDownloadManager.kt:354` → 应为 **:345**（调用链第 5 条同错）。
  3. MNN 节「先发 HEAD 取 Content-Length，大小匹配则跳过」`:405` → 应为 **:414**（或拆分，见 1.2 [196]）。
  4. MNN 节「进度每 500ms 更新一次」`:497` → 应为 **:517**。
- 其余行号引用抽查准确（如 `getBounds :47`、`pauseDownload :563`、`cancelDownload :567`、`deleteModel :573`、`getDownloadedModels :598` 均为实测正确行号——正文这部分反而比 facts.json 准确）。

## 四、status.json 核验

字段齐全且正确：`id: data-models`、`issue: 61`、`status: review-pending`、`source_repo: operit`（小写，符合 check_staleness.py 要求）、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`。lint 报告 0 硬失败 / 0 警告。**通过**

注：status.json 内自述 `refs_valid: "210/210 引用行号真实存在…md 引用符号 ±5 行窗口全命中"` 与本次实测结论不符（实为 26 条引用错位 + 2 条事实错误 + 正文 4 处行号错），该自述字段待 writer 修正 facts 后一并更新（critic 按规则不改动该文件）。

## 五、给 writer 的修正清单

1. 按 §1.2 表格修正 26 条 facts 的 `ref` 行号；[196] 建议拆成两条（HEAD 请求一条、大小匹配跳过一条）。
2. [101]「15 个字段」→「17 个字段」；[116]「30 个 Long 型颜色字段」→「29 个」。
3. 正文 4 处行号按 §三 修正（`ChatEntity.kt:62→:83` 两处、`MnnModelDownloadManager.kt:354→:345` 两处、`:405→:414`、`:497→:517`）。
4. 修正后更新 status.json 的 `refs_valid` 自述，重新跑 lint。

## 复检（2026-10-01 14:01 CST，修错后复验）

- 复检人：独立复检 critic（与修错员无关）
- 范围：只复检修错项（critic 退回的 28 项 + 修错员 2 处偏离处理），未重走全文。
- 方法：22 条改动 fact 逐条 sed 导出 ±5 窗口人工核对；2 条事实错误亲手逐数；程序化全量校验 212 条 facts（文件存在/行号不越界/反引号符号落 ±5 窗口）；正文 7 处改动逐条核对。

### 结论：通过

**未通过条目：无。**

### 1. 两条事实错误——亲手逐数确认

- **[102]（原 [101]）writeToParcel 17 个字段**：亲手数 `ChatMessage.kt:60–79` 的 `parcel.write*` 调用共 **17 次**（sender、content、timestamp、roleName、selectedVariantIndex、variantCount、provider、modelName、inputTokens、outputTokens、cachedInputTokens、sentAt、outputDurationMs、waitDurationMs、displayMode.name、isFavorite、completedAt）；读取侧 :41–57 同样 17 次读取（含 `readDisplayModeFromParcel`/`readBooleanFromParcel` 两个 helper）。**"17 个字段"正确。**
- **[117]（原 [116]）SerializableColorScheme 29 个 Long 字段**：亲手数 `SerializableColorScheme.kt:9–38` 的 `val ...: Long` 共 **29 个**（primary…scrim）。**"29 个"正确。**

### 2. [92]/[196] 两处拆分——合规

- **[92]→[92]/[93]（fromChatHistory）**：修错员按 parent 纠正拆成两条，**正确且是唯一合规写法**。我亲验：`fun fromChatHistory` 声明在 :62，`displayOrder` 逻辑在 :83，相隔 21 行，任何单行 ±5 窗口都盖不住二者（critic 原建议的 :83 对函数名断言不合规，lint 曾报警）。现 [92] `:62` 窗口（57–67）含函数声明；[93] `:83` 窗口（78–88）含 `displayOrder = if (chatHistory.displayOrder != 0L) ... else -now` 全逻辑，且 [93] 断言不再写 `fromChatHistory` 反引号。**接受。**
- **[196]→[197]/[198]（HEAD/跳过）**：[197] `:414` 窗口含 HEAD 请求 + `Content-Length` 读取；[198] `:432` 窗口含"大小匹配则跳过"全逻辑。**合规。**

### 3. 引用错位抽查（22 条）——全部通过

逐条 sed 核实 ±5 窗口完全支撑断言：[35]:24（fraction/isFinished 双 getter）、[53]:20（filter isEnabled + AVAILABLE）、[84]:47（`getBounds` 方括号解析）、[88]:59（`fromChatMessage` 声明）、[97]:68（MessageEntity.fromChatMessage 三参签名）、[169]:167（llama 四默认值）、[172]:238（`getValidModelIndex` 越界回 0）、[189]:166（.tmp/finalFile 重算字节）、[190]:186（Paused 恢复 + 已完成清理）、[191]:203（isEmpty→删状态文件）、[194]:294（Recursive=1 URL）、[195]:345（下载中忽略重复调用）、[196]:394（持久化子任务 + downloadAllFiles 调用）、[200]:517（500ms 进度）、[202]:565（pauseFlags/cancel）、[210]:682（存在且大小匹配跳过）、[211]:794（Completed + 清理）。程序化全量校验：**212/212 通过，0 失败**。

### 4. 正文 7 处改动——全部到位

- 核心机制 `fromChatHistory` 一句拆成两行：`:62`（55 行）/ displayOrder 行为 `:83`（56 行，无 `fromChatHistory` 反引号）；
- 调用链第 3 条 `:62`（175 行）；MNN 节 `:345`（108 行）、HEAD `:414`（109 行）、跳过 `:432`（110 行）、500ms `:517`（112 行）；调用链第 5 条 `:345`（177 行）。
- 全目录 lint：`data-models.md`/facts/quality/status **0 问题**（仅 `.lint.md`/`.critic.md` 被 lint.py 误当条目页的已知 quirk，与本页无关）。

### 5. 遗留（非阻塞，交 parent 收尾处理）

- `data-models.status.json` 的 `refs_valid` 自述仍写 "210/210"，实际 facts 已是 **212 条**；按规则 critic 不改动该文件，请 parent 在整批收尾时统一更新计数。

**本页已达收货标准，可进入发布队列。**
