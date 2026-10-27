# Critic2 复验报告：ui-settings-chat（Issue #99）

- 复验时间：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验真 HEAD）
- 方式：115 条 facts 逐条核 ref 合法性（文件存在/行号界内），第一轮 FAIL 清单全部逐项拉源码窗口实地核对；17 条 quality evidence 程序化逐字比对 + 抽查；lint 独立隔离重跑；禁用词 grep；status 口径核对。未改动任何交付文件。

## 机械项

- facts 115 条 = `status.json refs_valid: 115` ✓；status.json `status=review-pending`，`critic=""`，`issue=99`，source_repo/source_commit 齐全 ✓
- lint（/tmp 隔离，4 文件，`lint.py --src ~/workspace/Operit --dir`）：**0 硬失败 / 0 警告** ✓
- "通过/批准/LGTM"：md/facts/quality 三文件均为 0 命中 ✓
- severity：17 条 quality 仅 high/warn/suggestion（2/8/7）✓
- frontmatter `sources: 13`，正文列出 13 个种子文件 + 11 个另引用文件 ✓
- 复合断言扫描：0 候选 ✓

## 第一轮 FAIL 项复验（逐项实地核对）

### A. evidence（3 条）
- **Q06**：PASS。evidence 与 ChatHistorySettingsScreen.kt:2562-2568 逐字一致（含 8 空格缩进），`scanBackupFiles` 虚构已清除。
- **Q14**：PASS。evidence 与 :282-287 `fun mergedFiles...distinctBy { it.name }` 逐字一致；全仓库 grep 确认 `scanBackupFiles` 不存在。
- **Q17**：**FAIL**。evidence 非逐字原文：
  - evidence 写：`enum class RawSnapshotOperation {\n        IDLE, BACKING_UP, BACKUP_SUCCESS, RESTORING, FAILED\n    }`
  - 源码实际（:134-140）：
    ```
    enum class RawSnapshotOperation {
        IDLE,
        BACKING_UP,
        BACKUP_SUCCESS,
        RESTORING,
        FAILED
    }
    ```
  - 第一轮要求只是"去掉首行 4 空格缩进"，修错时把 5 个枚举项压成一行并虚构了 8 空格缩进，属于新的非逐字。必须换成上面 7 行逐字原文（line 保持 134）。

### B. 事实性错误（2 处）
- **F16**：PASS。ref 已改为 MemoryRepository.kt:2591，窗口实测 `memoryBox.query(Memory_.isDocumentNode.equal(false))`（:2591），正文 query 写法已同步。
- **md"14 个对话框"**：已改为"11 个"。独立复数：BackupDialogs.kt 共 12 个 @Composable（含 StrategyOption/ImportFormatOption/FormatOption/ChatHistoryExportOption/SecurityWarningItem 5 个选项行组件），严格"对话框"口径为 7 个。"11 个对话框"的口径介于两者之间（12 减 SecurityWarningItem），建议改为"12 个 @Composable（含 5 个选项行组件）"以绝歧义。列为次要建议，不判 FAIL。

### C. 锚点漂移（全部实地核对，结论如下）
实锤通过：F7(:410 导出格式列表起点)/F8(:500 导入格式列表起点)/F9(:1271 exportChatHistoriesToDownloads)/F10(:1328 importChatHistoriesFromUri)/F12(:595 exportAllCharacterCardsToBackupFile)/F21(:442 importConfigs)/F24(:764 pruneExcessBackups，修错员纠正了 critic 的 :761——:761 是递减按钮行，:764 正确)/F25(:812 backupIfNeeded)/F28(:1552 重启对话框)/F32(:282 fun mergedFiles 声明行)/F33(:295，:299 证实 chat_export_ 含 zip，补列正确)/F41(:1835 onDismissRequest)/F44(:155 内部 filesDir/workspace + :215 外部 Downloads/Operit/workspace，双锚点均实锤)/F47(ChatMemoryRebuildManager.kt:61 Status 枚举)/F49(:334 绑定互斥)/F50(:1717 成功后清空选中)/F57(:136 functionMappings[FunctionType.CHAT])/F58(:168 三层提示词输入声明)/F59(FunctionalPrompts.kt:118 私有 summarySectionIds)/F60(FunctionalPrompts.kt:183 buildSummarySectionOverrides)/F70(FunctionType.kt:4)/F71(FunctionalConfigManager.kt:71)/F75(:550 stream=false, enableRetry=false)/F81(:81 CloudDownload / :87 CloudUpload)/F84(BackupManagementCards.kt:543 fun FaqCard，文件归属正确)/F86(BackupDialogs.kt:62 error 配色确认键)/F89(:754 FilledTonalButton)/F92(RoomDatabaseBackupManager.kt:127 手动命名)/F97(:18 rememberMemoryImportStrategyTexts)/F103(:60 MarkdownSyntaxColors)/F64(:171 DEFAULT_MAX_IMAGE_HISTORY_USER_TURNS=2)/F65(:172 DEFAULT_MAX_MEDIA_HISTORY_USER_TURNS=1，critic 建议的 :147/:148 是键定义行，事实断言的是默认值，修错员保留 :171/:172 正确)。

### D. 复合拆分（6 组）
全部通过：F23→[22]下限1(:761)/[23]上限100(:789)；F63→[61]-[64] 四条默认值；F76→[77]finally(:749)/[78]5秒清空(:328)；F81→[83]/[84]；F87→[90]默认SKIP(:77)/[91]冲突行为(:2684)；F92→[96]自动命名(:84)/[97]手动命名(:127)。facts 109→115 ✓。

### E. 解释性表述
- F66（现 [67]）：已改为"0 可保存（语义上等于不保留）" ✓
- F13（现 [12]）：已注记 total 为派生属性 ✓

### 两条 high 实锤
- Q01（导出明文含 API Key）：evidence 逐字命中 :657，结论成立 ✓
- Q02（快照打 SharedPreferences/DataStore 原文件）：evidence 逐字命中 :74，结论成立 ✓

## 残留问题清单

1. **[必须修] Q17 evidence 非逐字**（见上 A 节）：换成 :134-140 的 7 行逐字原文。
2. [建议] md"11 个对话框"口径含糊，建议"12 个 @Composable（含 5 个选项行组件）"。
3. [建议] 正文来源小节缺 facts/quality 数量声明行（batch-06 惯例："115 条原子事实 + 走查 17 条（高危 2/警告 8/建议 7）"）。
4. [建议] 个别 fact 行内旧行号残留：[28] 文内":1547"（ref :1552，±5 内无害）；[57] 文内":154"（ref :136，:154 窗口是 maxContextLengthInput，文内数字应为 :136）。
5. [建议] [42] 的 `deleteChatHistory` 调用点在 :2563，距锚点 :2553 有 10 行（IO 线程断言在 ±5 内成立，调用点超出），建议锚点改为 :2562 或拆分。

## 最终 verdict：FAIL

仅 1 项必须修（Q17 evidence）。修完后无需第三轮全量复验，parent 核对 Q17 一处即可翻 PASS。
