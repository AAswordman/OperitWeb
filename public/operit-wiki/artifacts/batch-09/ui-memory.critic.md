# ui-memory 独立 critic 报告

- 评审对象：`review/batch-09/ui-memory.md / ui-memory.facts.json / ui-memory.quality.json / ui-memory.lint.md / ui-memory.status.json`
- 评审人：独立 critic（subagent）
- 评审时间：2026-10-01
- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核验 commit 存在）
- 结论：**FAIL**（需修复清单见末尾；全部为锚点行号错位与自检报告数字过期，断言本身无一编造，修完即 PASS，无需重审全文）

## 一、facts 抽查（35/210，随机种子 7）

抽查编号：9, 12, 14, 15, 17, 18, 22, 23, 24, 31, 38, 54, 56, 57, 61, 82, 93, 101, 107, 108, 111, 129, 137, 141, 144, 147, 149, 160, 161, 166, 181, 187, 200, 205, 207。

- 命中（断言准确、锚点可接受）：27 条
- 错位（断言为真，但 ref 行号偏离证据）：8 条，逐条如下
- 编造/断言与代码不符：0 条
- 全量 210 条机器核：文件全部存在、行号全部在界、ref 全部为 `app/` 根相对全路径、字段全部为 `fact/ref` —— 0 异常

### 错位清单

1. **fact[61]** 原 ref `MemorySearchSettingsDialog.kt:196`（落在云开关 Switch 行附近，证据不在此）
   - 正确 ref：`:214`（`if (cloudEnabled) {`，endpoint/apiKey/model 三个输入框的实际条件）
   - 断言"云开关打开时才显示 endpoint、apiKey、model 三个输入框"为真。

2. **fact[107]** 原 ref `FolderNavigator.kt:330`（落在 `FolderTreeItem` 函数签名，完全无关）
   - 正确 ref：`:308`（`if (contextMenuFolder != null && !showRenameDialog && !showDeleteDialog)`）
   - 断言"右键菜单与重命名/删除对话框不同时显示"为真。

3. **fact[108]** 原 ref `FolderNavigator.kt:566`（落在 TextField 闭合括号）
   - 正确 ref：`:571`（`enabled = folderName.isNotBlank()`，另 :570 `if (folderName.isNotBlank())`）
   - 断言"创建文件夹要求输入非空"为真。

4. **fact[129]** 原 ref `MemoryScreen.kt:395`（落在 lambda 起始行）
   - 正确 ref：`:397`（`preferencesManager.setActiveMemorySpace(id)`）
   - 断言"切换记忆空间时调 `setActiveMemorySpace`"为真。

5. **fact[144]** 原 ref `MemoryViewModel.kt:268`（落在参数列表尾）
   - 正确 ref：`:271`（`normalizedInterval = autoSaveIntervalMinutes.coerceIn(...)`，:269–270 另有两次 `normalized()`）
   - 断言"`saveSearchSettings` 对配置调 `normalized()` 并钳制自动保存间隔"为真。

6. **fact[147]** 原 ref `MemoryViewModel.kt:348`（落在重建进度回调内部，非"完成后"）
   - 正确 ref：`:351`（`val usage = repository.getEmbeddingDimensionUsage()`；提示完成条数在 :357–360）
   - 断言"重建完成后刷新维度用量并提示完成条数"为真。

7. **fact[160]** 原 ref `MemoryViewModel.kt:623`（落在 `try {` 行）
   - 正确 ref：`:620`（`fun importDocument` 声明）或 `:624`（`val currentFolder = _uiState.value.selectedFolderPath`）
   - 断言"`importDocument` 导入到当前选中文件夹并刷新图谱与文件夹"为真（证据 :624–628）。

8. **fact[161]** 原 ref `MemoryViewModel.kt:643`（落在 try 块内）
   - 正确 ref：`:644`（`repository.createMemory(title, content, contentType, folderPath = currentFolder)`）
   - 断言"`createMemory` 用当前选中文件夹作为 folderPath"为真。

### 抽查中验证为真的代表性断言（抽样证据）

- fact[9] `GraphModels.kt:24`：`isCrossFolderLink: Boolean = false // 标记是否为跨文件夹连接` —— 逐字命中
- fact[15] 12 参数：`DocumentViewDialog(` :38–50 逐数 12 个参数 —— 准确
- fact[23] :110 `OutlinedTextField`，标签 `document_block_label, chunk.chunkIndex + 1` 在 :116 —— "标签带序号"为真
- fact[38] :245 `InputChip`，删除按钮 `trailingIcon` 在 :249–255 —— 为真
- fact[56] MIN/MAX：`:158-159`（valueText）/`:161-164`（valueRange）均取自 `MemorySearchSettingsPreferences` —— 为真
- fact[93] :125 注释"默认为空，即全部折叠" —— 逐字命中
- fact[141] :185–187 `loadSearchSettings()` / `loadCloudEmbeddingSettings()` / `refreshEmbeddingDimensionUsage()` —— 三样齐全，为真
- fact[200] `NODE_HIT_PADDING_PX = 12f` 定义在 :73，:918 传入 `extraPadding` —— "外扩 12px"为真

## 二、quality.json 核查（8 条全部为真）

| # | finding | 核查 |
|---|---------|------|
| Q1 | 导入 fileName 未净化、`..` 穿越 cacheDir（high） | :215 `File(context.cacheDir, fileName)` 逐字命中；fileName 取自 `OpenableColumns.DISPLAY_NAME`（:191–198）未净化 —— 为真，high 合理（与 batch-08 同类发现口径一致），confidence medium 公允 |
| Q2 | 连接模式可选超 2 节点致建边对话框永不出现（warn） | `selectNode` :475–481 只追加无上限、无单删；`MemoryScreen.kt:522` `linkingNodeIds.size == 2` 弹框 —— 为真，warn 合理 |
| Q3 | `.folder_placeholder` 占位记忆污染图谱与搜索（warn） | `createFolder` :900–906 创建真实记忆 —— 为真，warn 合理 |
| Q4 | ToolTestDialog 死代码（suggestion） | 仅定义于 `ToolTestDialog.kt`、`MemoryViewModel` 有配套 state/fun，`MemoryScreen.kt` 无组合点 —— 为真 |
| Q5 | `Node.color` 渲染中被忽略（suggestion） | `GraphVisualizer.kt` 全文件无 `node.color` 读取，`drawNode` 全用 `nodePalette` —— 为真 |
| Q6 | `FolderNode.isExpanded` 从未被读取（suggestion） | 该字段仅 :91 声明、:231/:489 具名写入；渲染用 :336 `node.fullPath in expandedPaths` 局部变量 —— 为真 |
| Q7 | 边权重非法输入静默回退 1.0f（suggestion） | :162 `weight.toFloatOrNull() ?: 1.0f` —— 为真 |
| Q8 | 文档标题 remember 缺 key 切选中显示旧标题（suggestion） | :444 `remember { mutableStateOf(uiState.selectedMemory!!.title) }` 无 key —— 为真，medium 公允 |

severity 全部合理，无夸大。只核真实性，不重做走查。

## 三、.md 结构核查（§9）

- 结构齐全：概述 / AI 速览（符号清单+主入口+数据流向一句话）/ 核心机制 10 节 / 关键符号表（14 行，ref 逐核 5 个全部命中：GraphVisualizer :212、LinkMemoryDialog :170、FolderNavigator :104、MemoryAppBar :49）/ 调用链 6 条（输入→处理→输出三段式）/ 来源（12 文件，与 facts distinct 引用数一致）
- 人话：术语首现均有解释（"记忆空间（profile）"、"力导向布局"、"分块（chunk）"），调用链叙事清晰
- 无编造：种子声明"12 文件、约 5,150 行"实测 `wc -l` 合计恰为 5,150 行
- 小瑕疵：调用链第 1 条 ref `MemoryScreen.kt:166` 落在空行，证据 `LaunchedEffect` 在 :167（差 1 行，建议顺手改 :167）

## 四、status.json 核查

- `refs_valid: 210` = facts 实际数 210 —— 一致
- `status: review-pending` —— 正确
- `issue: 112` —— 正确
- `source_repo: operit`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（完整 hash）—— 正确

## 五、lint

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`：ui-memory.* 零提及，即 **0 硬失败 / 0 警告**（同目录其他 writer 文件的 68 硬失败与本页无关）。

但 `ui-memory.lint.md` 自检报告内容已过期：写的是"facts.json：208 条"、"refs_valid = 208"，实际为 210/210。writer 在自检后又加了 2 条 facts 未更新该文件。须同步修正。

## 六、必须修复的清单（FAIL → 修复后即 PASS）

1. facts.json 8 条 ref 重锚：[61]→`:214`、[107]→`:308`、[108]→`:571`、[129]→`:397`、[144]→`:271`、[147]→`:351`、[160]→`:620`（或 `:624`）、[161]→`:644`。
2. `ui-memory.md` 调用链第 1 条 ref `:166` → `:167`（可选顺手）。
3. `ui-memory.lint.md` 自检数字 208 → 210（两处），并重跑自检口径。
4. 修复后无需重审全文；建议抽查本次指出的 8 条确认命中即可。

## 七、总体评价

writer 功底扎实：35 条抽查断言 100% 为真，8 条走查全部实锤且 severity 公允，§9 双受众结构完整，无编造。主要问题是行号锚点漂移（23% 抽查命中错位，多为函数声明行 vs 证据行、条件行 vs 被条件包裹的行），属可快速修复的机械问题。修复上述清单后可直接转复验 PASS。
