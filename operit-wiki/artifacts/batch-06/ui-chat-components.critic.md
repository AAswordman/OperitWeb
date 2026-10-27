# Critic 报告：ui-chat-components（Issue #90）

- 评审对象：`review/batch-06/ui-chat-components.md` / `.facts.json`（116 条）/ `.quality.json`（10 条）/ `.status.json`
- 源码基线：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 核查方式：全部 116 条 facts 做文件存在性+行号越界机械检查（116/116 合法），再逐条取 ref ±5 行窗口人工核对断言支撑；10 条 quality evidence 逐字比对源码；高危项独立深挖到 KeyStoreHelper；零调用断言做全仓库 grep 复核。
- **总体 verdict：FAIL** —— 存在事实错误与锚点错位，必须修完后复验。

## 一、facts.json 逐条结论

图例：PASS=断言成立且 ref ±5 窗口完整支撑；FAIL=必须修；NOTE=事实成立但有瑕疵（建议修）。

### ChatScreenContent.kt（[0]–[15]）

- [0] PASS。`fun ChatScreenContent(` 正在 :96 行。
- [1] PASS。:160 `mutableStateOf(false)`。
- [2] PASS。:166-168 只有 sender=="user"||"ai" 入选。
- [3] PASS。:191 `LaunchedEffect(currentChatId, messageOrder)` 取消复制协程并退出多选。
- [4] PASS。:628-631 `buildSelectedMessagesPlainText` + `markdownToPlainTextForCopy` + `LatexMathMlConverter.convertAll`。
- [5] PASS。:679 `enqueueSelectedMessagesForMemoryAutoSave(selectedMessages)`。
- [6] PASS。:901 `actualViewModel.shareMessages(`；`ShareImagePreviewDialog(` 在 ChatScreenContent.kt:936 被调用，链路成立。
- [7] PASS。:757-758 `rememberSaveable` 存悬浮按钮偏移；:760-761 `coerceAtLeast` 钳制。
- [8] NOTE。事实成立（`pauseSpeaking` :799、`resumeSpeaking` :824、`stopSpeaking` :842 均存在），但 ref :799 的 ±5 窗口只覆盖到暂停，建议把锚点拆成三条或改注"三处调用"。
- [9] PASS。:283-284 `onSpeakMessage→speakMessage`、`onAutoReadMessage→enableAutoReadAndSpeak`。
- [10] PASS。:1126 `updateMessage(index, editedMessage)`。
- [11] PASS。:1137 `hasWorkspace` 分支，无工作区直调 `rewindAndResendMessage`（:1142）。
- [12] PASS。:1148 `showResendButton = editingMessageType == "user"`。
- [13] NOTE。`previewWorkspaceChangesForMessage` :229 成立；`WorkspaceChangeConfirmDialog(` 在 ChatScreenContent.kt:1153/1170 成立。但 ref :229 窗口只覆盖前半句，建议补第二锚点。
- [14] NOTE。导出链成立（`ExportPlatformDialog` :986-987 → `AndroidExportDialog` :996 / `WindowsExportDialog` :1034 → `showExportCompleteDialog=true` :1024/:1059 → `ExportCompleteDialog` :1077）。但 ref :1007 窗口只覆盖其中一环，建议注明链路多锚点。
- [15] NOTE。280.dp 在 ChatScreenContent.kt:1212（`ChatHistorySelectorPanel` 函数体内，该函数起于 :1192），事实成立；但 ref :1192 的 ±5 窗口（1187–1197）够不到 1212。必须把 ref 改为 :1212。

### ChatArea.kt（[16]–[29]）

- [16] PASS。:129 `cleanMessageContentForCopy`，注释"清理复制文本中的内部标记"。
- [17] PASS。:161-162 `cleanMessageContentForXmlCopy`，"保留结构化标记"。
- [18] NOTE。函数签名 :174 成立；但**排序不在该函数内**——函数体（174-187）只做 filter/map/join，`sortedBy { it.timestamp }` 在调用方 ChatScreenContent.kt:678。事实把排序归于函数本身，表述不精确，建议改为"调用方先按时间戳排序，函数内过滤拼接"。
- [19] PASS。:194-197 `enum class ChatStyle { CURSOR, BUBBLE }`。
- [20] NOTE。事实成立（:396 `Column(` + :401 `.verticalScroll(scrollState)`），但 ref :200 只是 `fun ChatArea(` 签名行，窗口内无 Column/verticalScroll。建议 ref 改为 :401（Q8 已用该锚点）。
- [21] PASS。:275 `mutableStateMapOf<Long, ChatScrollMessageAnchor>()`。
- [22] PASS。:276 声明；清零在 :287/:336/:587 三处均有 `pendingJumpToMessageTimestamp = null`。
- [23] PASS。:429-432 `key(message.timestamp, timestampKeyOccurrence)`。
- [24] PASS。:383-387 `shouldHideLastAiMessage` 要求 `chatStyle == ChatStyle.BUBBLE` 且最后一条为 ai 消息。
- [25] PASS。:706 `.combinedClickable(`、:716 `onLongClick = {`。
- [26] PASS。:720 `ChatMessageMenuItemRegistry.createMenuItems(`（import 见 :107）。
- [27] PASS。:1265 `MessageCopyMode` 枚举三值（PLAIN_TEXT/MARKDOWN_SOURCE/XML_SOURCE），:1287-1300 三模式切换成立。
- [28] PASS。:1438 `MessageFooterBar`，参数含四组统计开关。
- [29] PASS。:1581 `LoadingDotsIndicator`；keyframes 见 :1598 起 `infiniteRepeatable` + `keyframes`。

### ChatScrollNavigator.kt（[30]–[38]）

- [30] PASS。:99 `internal fun ChatScrollNavigator(... scrollState: ChatLazyListState ...)`。
- [31] PASS。ChatArea.kt:559 调用 `ChatScrollNavigator(chatHistory/currentChatId/scrollState/messageAnchors/...)`，确为 ScrollState 重载。
- [32] PASS。:86 `NAVIGATOR_HIDE_DELAY_MS = 1200L`。
- [33] PASS。:251-262 `Canvas` 内 `drawLine` + `drawCircle` 自绘进度线与圆点。
- [34] PASS。:604 `ChatMessageLocatorDialog`。
- [35] PASS。:681 `delay(180)`。
- [36] PASS。:1260 `content.take(72)`。
- [37] PASS。:84 `LOCATOR_PREVIEW_CHAR_COUNT = 48`。
- [38] **FAIL**。:1127 根本不是 `ChatScrollNavigator` 的重载——该行是 `private fun resolveCenteredMessageIndex(scrollState: ChatLazyListState, ...)` 辅助函数。`ChatScrollNavigator` 全文件只有两个重载（:99 接 ChatLazyListState，:313 接 ScrollState+messageAnchors）。"第三个重载"纯属误认，必须删除或重写。

### ChatHistorySelector.kt（[39]–[48]）

- [39] PASS。:141 `resolveBindingForCreate`。
- [40] PASS。:155 `sealed interface HistoryListItem`，含 CharacterHeader/Header（:162 起，Item 在后续行）。
- [41] **FAIL（锚点错位）**。事实本身成立：`ChatHistoryDisplayMode` 枚举确有 BY_CHARACTER_CARD / BY_FOLDER / CURRENT_CHARACTER_ONLY 三值（定义在 ChatViewModel.kt:97-101）。但 ref 写的 ChatHistorySelector.kt:426 是 `fun ChatHistorySelector(` 签名行，±5 窗口内无任何显示模式信息。必须重锚到 ChatViewModel.kt:97。
- [42] PASS。:589-590 注释"延迟400ms"+`delay(400)`。
- [43] **FAIL（锚点错位）**。事实成立（:575-583：`hasTitleOrGroupMatch` 先做标题/分组本地匹配，`shouldSearchByContent = !hasTitleOrGroupMatch && trimmedQuery.length >= 2` 才调 `searchChatIdsByContent`）。但 ref :426 窗口完全不支持。必须重锚到 :582。
- [44] **FAIL（锚点错位）**。事实成立（:116-117 `import sh.calvin.reorderable.ReorderableItem` / `rememberReorderableLazyListState`，:777 起拖拽回调）。但 ref :426 窗口完全不支持。必须重锚到 :777。
- [45] **FAIL（事实错误，方向写反）**。:2369-2371 `startActions = listOf(editAction)`、`endActions = listOf(deleteAction)`。按 SwipeableActionsBox（saket）语义，start 侧动作是内容**向 end 方向滑动（LTR 下即右滑）**时露出，end 侧动作是**左滑**时露出。故应为"右滑编辑、左滑删除"，事实写的"左滑编辑、右滑删除"正好相反。
- [46] NOTE。事实成立（:484-487 `promptDeleteChat`：`if (history.locked) { onDeleteChat(history.id); return }` 跳过确认）；220ms 在 :477。但 ref :477 窗口只覆盖前半句，建议补 :484 锚点。
- [47] **FAIL（锚点错位）**。事实成立（:458-459 `rememberLocal("chat_history_collapsed_groups", ...)` / `rememberLocal("chat_history_collapsed_characters", ...)`）。但 ref :426 窗口完全不支持。必须重锚到 :458。
- [48] NOTE。事实成立（:296/:307 `listState.dispatchRawDelta(...)` 在 `HistoryQuickScroller` 函数体内，该函数起于 :209）。但 ref :209 的 ±5 窗口够不到 296。建议 ref 改为 :296。

### ChatHeader / ChatScreenHeader / ChatToastHost（[49]–[55]）

- [49] PASS。ChatHeader.kt:55 `if (runningTaskCount >= 2)`。
- [50] PASS。ChatHeader.kt:28 `CHAT_HEADER_CHARACTER_NAME_MAX_LENGTH = 12`，:30-31 `take(maxLength) + "…"`。
- [51] PASS。ChatHeader.kt:174-176 `rememberAsyncImagePainter`（Coil）。
- [52] PASS。ChatScreenHeader.kt:191-195 `>90→error`、`>75→tertiary`。
- [53] NOTE。事实成立（ChatScreenHeader.kt:221 `DropdownMenu`，:228-235 input/output/total 三个 `DropdownMenuItem`）。但 ref :192 窗口只覆盖颜色逻辑。建议 ref 改为 :221。
- [54] PASS。ChatScreenHeader.kt:140 `useFloatingWindowLauncher(actualViewModel, permissionLauncher)`。
- [55] PASS。ChatToastHost.kt:145-150 `(2500L + estimatedLines * 850L).coerceIn(3500L, 12000L)`。

### AttachmentPreview / AttachmentChip（[56]–[58]）

- [56] NOTE。事实成立（AttachmentPreview.kt:57 `LazyRow`，:76-78 `camera_`/`image/`/`screen_` 三前缀配图标）。但 ref :40 只是函数签名。建议 ref 改为 :76。
- [57] PASS。AttachmentChip.kt:55-58 `Modifier.size(52.dp)`；:67-74 右上角（`Alignment.TopEnd`）删除角标。
- [58] NOTE。两处都成立（:89 `Modifier.height(26.dp)`，:116 `Modifier.widthIn(max = 80.dp)`），但 ref :116 窗口只覆盖文件名限宽。建议补 :89 锚点。

### MessageEditor.kt（[59]–[66]）

- [59] PASS。:53 `ParsedMessagePart` 四字段（type/content/tag/attributes）。
- [60] PASS。:54 `enum class PartType { TEXT, XML }`。
- [61] PASS。:76-79 `parseMessageContentForEditor`，正则支持带属性标签。
- [62] PASS。:106-111 `recomposeMessageFromParts` 拼回。
- [63] NOTE。事实成立（:132 `isRawEditMode`，:178-179 可视化/纯文本切换按钮）。但 ref :118 只是函数签名。建议 ref 改为 :132。
- [64] PASS。:453-454 `XmlTagItem`。
- [65] PASS。:586 `TagEditorDialog`。
- [66] PASS。12 个建议实数 12（61-74 行区间内 `XmlTagSuggestion("` 恰 12 处）。

### AttachmentSelector.kt（[67]–[75]）

- [67] NOTE。8 个选项成立（:175-224 共 8 处 `AttachmentPanelItem(`：图片/拍照/记忆/文件/屏幕内容/通知/位置/安装包）。但 ref :88 只是函数签名。建议 ref 改为 :175。
- [68] PASS。:231 `chunked(8)` + :234 `HorizontalPager`。
- [69] PASS。:111-112 `ActivityResultContracts.GetMultipleContents()`。
- [70] PASS。:537 起 `rememberCameraCaptureLauncher`；权限检查见 :580-584（`checkSelfPermission CAMERA`→无权限则 `Toast` 提示 `camera_permission_denied_toast`）。
- [71] PASS。:588-595 `File.createTempFile("temp_image_", ".jpg", context.cacheDir)` + FileProvider。
- [72] PASS。:598-603 `getAttachmentSource` 三分支与事实一致。
- [73] PASS。:326-327 `AttachmentSelectorPopupPanel`。
- [74] NOTE。事实成立（`buildAttachmentPackageOptions` 内三类：PACKAGE :815-824、SKILL :826 起、MCP :832 起；`isToolPkgContainer` 排除容器）。但 ref :656 只是 `PackageSelectorDialog` 签名。建议 ref 改为 :806。
- [75] PASS。:806-811 `linkedMapOf` + `putIfAbsent` 按包名去重；`toSortedMap()` 排序。

### ExportDialogs.kt（[76]–[85]）

- [76] PASS。:57-60 `ExportPlatformDialog(onSelectAndroid/onSelectWindows)`。
- [77] PASS。:171-175 `rememberLocal("export_*_${workDir.absolutePath}", ...)` 五处。
- [78] PASS。:361 正则 `^\\d+(\\.\\d+){0,2}(-[a-zA-Z0-9]+)?$`（Kotlin 转义后与事实一致）。
- [79] PASS。:398 `enabled` 条件与事实一致。
- [80] NOTE。事实成立（:428 `rememberLauncherForActivityResult(contract = CropImageContract())` 位于 `WindowsExportDialog` 函数体内，该函数起于 :408）。但 ref :408 只是签名。建议 ref 改为 :428。
- [81] NOTE。事实成立（:782 `ApkEditor.fromAsset(context, "subpack/android.apk")`）。但 ref :766 只是 `exportAndroidApp` 签名。建议 ref 改为 :782。
- [82] PASS。:813-816 公共 Download/Operit/exports；:822 `WebApp_${Date().time}.apk`。
- [83] **FAIL（锚点错位，事实本身成立）**。硬编码三元组经核实全部成立：ExportDialogs.kt:827-831 `.withSignature(keyStoreFile, "android" /*密码*/, "androidkey" /*别名*/, "android" /*密钥密码*/)`。但 ref :818 是 `if (!outputDir.exists())` 行，±5 窗口（813–823）根本不含签名调用。必须重锚到 :827。
- [84] NOTE。事实成立（:893 `assets.open("subpack/windows.zip")`，:920-923 改 `assistance_subpack.exe` 图标）。但 ref :860 只是 `exportWindowsApp` 签名。建议 ref 改为 :893。
- [85] NOTE。事实成立（:942 `data/flutter_assets/assets/web_content`，:958 `"${safeName}_${timestamp}.zip"`）。但 ref :942 窗口够不到 958。建议补 :958 锚点。

### 选择器/对话框/小组件（[86]–[100]）

- [86] PASS。CharacterSelectorPanel.kt:57-60 `CharacterSelectorTarget` 密封接口两子类型。
- [87] NOTE。事实成立（slideInVertically `initialOffsetY = { -it }` 见 :126-127；顶部 `padding(top = 60.dp)` 见 :137；遮罩点击关闭见 :120-122 `detectTapGestures { onDismiss() }` + 半透明背景）。但 ref :78 只是签名。建议 ref 改为 :120。
- [88] PASS。CharacterSelectorPanel.kt:95-98 `rememberLocal` 存排序选项。
- [89] PASS。MemoryFolderSelectionDialog.kt:63-67 `rememberLocal(key = "folder_navigator_expanded_state", ...)`，注释写明与 FolderNavigator 共享 key。
- [90] **FAIL（数量错误）**。`ScrollToBottomButton` 实际有**三个**重载：:42 接 `ScrollState`、:97 接自研 `ChatLazyListState`、:156 接 `ComposeLazyListState`（androidx 别名，:162 起 `reverseLayout` 参数）。事实只列两个，遗漏了 :42 的 ScrollState 重载。
- [91] NOTE。事实成立（:120-131 拖拽离底浮现逻辑；:147/:221 `scrollState.animateScrollToEnd()`）。但 ref :120 窗口只覆盖前半。建议补锚点。
- [92] PASS。SharedFileTargetDialog.kt:218-224 `sortedWith(compareByDescending(updatedAt).thenByDescending(createdAt)).take(5)`。
- [93] PASS。SharedFileTargetDialog.kt:54 `screenHeightDp.dp * 0.8f`。
- [94] PASS。SharedFileTargetDialog.kt:196-198 `pendingShared*` 排队状态；消费后置空逻辑在 :202-214。
- [95] PASS。WorkspaceChangeConfirmDialog.kt:32-35 `ROLLBACK` / `EDIT_AND_RESEND`。
- [96] PASS。WorkspaceChangeConfirmDialog.kt:44-45 `120.dp` / `260.dp`。
- [97] PASS。MessageInfoDialog.kt:55 `String.format(..., "%.2f s (%d ms)", ...)`。
- [98] PASS。LinkPreviewDialog.kt:105 `data = Uri.parse(url)`（经 Intent 跳转）。
- [99] PASS。FullscreenInputDialog.kt:35-38 `finishEditing`；:41 `onDismissRequest = { finishEditing() }`，确无丢弃路径。
- [100] PASS。FullscreenInputDialog.kt:42 `usePlatformDefaultWidth = false`；:31 `rememberMentionVisualTransformation`。

### 流/进度/高度/小工具 + lazy/（[101]–[115]）

- [101] PASS。RevisableTextStreamRemember.kt:45/51 `TextStreamEventType.SAVEPOINT` / `ROLLBACK`；:65-70 回滚换新流。
- [102] PASS。:70 `previousOutputStream.resetReplayCache()`；:65-68 `RollbackTailStream(rollbackPrefix = snapshot)`。
- [103] PASS。:87-89 注释"Keep completed replay available..." + `(currentOutputStream as? MutableSharedStreamImpl<String>)?.close()`。
- [104] PASS。CompactDialogLayout.kt:27-30 默认 320/560/0.9f。
- [105] NOTE。事实成立（ReferencesDisplay.kt:46 `LazyRow`、:67 `SuggestionChip`、:53 `uriHandler.openUri(reference.url)`）。但 ref :24 只是签名。建议 ref 改为 :46。
- [106] PASS。SimpleLinearProgressIndicator.kt:47-51 `fillMaxWidth(0.3f)` 静态 30%，注释写明无动画。
- [107] PASS。ChatScrollExtensions.kt:11-16 `LazyListState.animateScrollToEnd()` 先 `animateScrollToItem` 再补 `animateScrollBy`。
- [108] PASS。ChatMessageHeightMemory.kt:10 `linkedMapOf<Long, Int>()`。
- [109] PASS。:19-24 `prune(validMessageIds)` 删保留集之外。
- [110] PASS。PastedTextAttachment.kt:25 `extractClipboardPastedText`，前后缀匹配见 :20-22。
- [111] PASS。TokenHitRateFormat.kt:11-16 `floor` 截断 + `input <= 0L` 返回 `"-"`。
- [112] PASS。lazy/README.md:0-4 来源版本 1.10.4、入口重命名、本地包名。
- [113] PASS。lazy/README.md:16 "这次没有执行编译、构建或测试"。
- [114] PASS。全仓库 grep：`RecyclerLazyColumn(` 仅出现在 lazy/RecyclerLazyColumn.kt 定义处，零调用方。
- [115] NOTE。核心成立：`ChatScrollNavigator` 的 ChatLazyListState 重载（:99）与 `ScrollToBottomButton` 的 ChatLazyListState 重载（:97）经全仓库 grep 确认零调用。但表述有瑕疵：`ChatScrollExtensions` 并没有 ChatLazyListState 专属函数（两个 `animateScrollToEnd` 是给 androidx `LazyListState` 及其别名 `ComposeLazyListState` 的，见 :11/:35）。建议改写为"ChatScrollNavigator(:99)/ScrollToBottomButton(:97) 的 ChatLazyListState 重载零调用"。另附带发现：`ChatLazyListState` 是 `lazy.LazyListState` 的 import 别名（ChatScrollNavigator.kt:69），而 :147 `scrollState.animateScrollToEnd()` 在该 lazy 类型上无对应扩展（lazy/ 内无此函数，ChatScrollExtensions 只扩展 androidx 类型）——该死代码路径很可能根本未经编译，与 README"没有执行编译"自述吻合。

## 二、quality.json 逐条结论

- Q0 [high] ExportDialogs.kt — evidence 逐字相符（:826-832 `withSignature` 块）。深挖 `keyStoreFile` 来源：`KeyStoreHelper.getOrCreateKeystore`（ExportDialogs.kt:802）优先从 **assets 内置**的 `pkcs12.keystore`/`jks.jks` 加载（KeyStoreHelper.kt:178-187），即密钥库随 App 分发、所有用户共用同一密钥；凭证硬编码（密码 android/别名 androidkey/密钥密码 android）；任何拿到 App 安装包的人都能解出该 keystore 给同包名导出应用签发伪造更新。描述中"Android 公开的默认调试密钥"措辞略欠精确（别名 androidkey 并非 AOSP 标准 androiddebugkey），但"硬编码共享密钥→更新劫持"的风险实质成立。severity=high 合理。**小瑕疵：`line` 字段 818 应为 826**（evidence 起始行）。
- Q1 [warn] MessageEditor.kt:79 — evidence 逐字相符；非贪婪 `([\\s\\S]*?)` + 回溯引用在同名嵌套标签下提前闭合的分析正确。PASS。
- Q2 [warn] AttachmentSelector.kt:591 — evidence 逐字相符（`deleteOnExit()`）；Android 进程多被直接杀掉、exit 钩子极少执行的分析成立。PASS。
- Q3 [warn] SharedFileTargetDialog.kt:202 — evidence 逐字相符；`LaunchedEffect(sharedFiles, sharedFileText)` key 相等不重触发→同值重发被静默吞掉的分析成立。PASS。
- Q4 [suggestion] AttachmentSelector.kt:598 — evidence 逐字相符；`content://` 直接 toString 充 path 的风险描述合理。PASS。
- Q5 [suggestion] FullscreenInputDialog.kt:35 — evidence 逐字相符；三条关闭路径全走 `finishEditing()` 回写、无丢弃路径（:41 `onDismissRequest` 亦然）。PASS。
- Q6 [suggestion] SimpleLinearProgressIndicator.kt:47 — evidence 逐字相符；静态 30% 无动画、用户难区分进行中/卡住的判断合理。PASS。
- Q7 [suggestion] ChatScrollNavigator.kt:99 — **FAIL（描述事实错误）**：`ChatScrollNavigator` 的 ChatLazyListState 重载只有 **1 个**（:99），不是 2 个（:313 是 ScrollState+messageAnchors 重载）；`ChatScrollExtensions` **没有** ChatLazyListState 专属重载（两个 `animateScrollToEnd` 是给 androidx `LazyListState` / 别名 `ComposeLazyListState` 的）。只有"ScrollToBottomButton 一个"是对的（:97）。必须改写。
- Q8 [suggestion] ChatArea.kt:401 — evidence 相符；Column+verticalScroll 全量组合、无 UI 虚拟化的判断成立（数据层显示窗口的缓解措施描述也准确）。PASS。
- Q9 [suggestion] MessageEditor.kt:142 — evidence 逐字相符；纯文本切回可视化重跑解析、非法标签静默降级 TEXT 的判断成立。PASS。

## 三、正文、种子覆盖、页面问题

- 正文行内 `file:line` 引用：全文仅 1 处（`ChatArea.kt:559`），经核对准确（对应 facts[31]）。
- 正文结构：概述 / `## AI 速览` / `## 核心机制`（11 节）/ `## 关键符号` / `## 输入→处理→输出调用链` / `## 来源`，符合 §9 双受众固定结构。
- 种子覆盖：顶层 29 个 kt 中 28 个有 facts ref；**`ShareImagePreviewDialog.kt` 零 facts ref**（正文提及 4 次但无原子事实锚定该文件）——覆盖缺口，建议补 2–3 条该文件的事实（如对话框参数、预览生成链）。
- `lazy/`（50 文件）：writer 按"README 溯源 + 零调用验证"处理，未逐文件精读。抽查确认：README 自述（来源版本/包名本地化/未编译）与源码一致（[112][113] PASS）；`RecyclerLazyColumn` 零调用经全仓库 grep 复核成立（[114] PASS）；包名确已本地化（lazy/LazyList.kt 与 RecyclerLazyColumn.kt 均为 `...components.lazy`）。属文档化的范围决策，可接受，不计为缺漏。
- 页面三个问题覆盖情况：消息内容区（ChatArea/MessageItem/锚点滚动 ✓）、交互组件（多选/附件/编辑器/定位器/抽屉 ✓）、导出对话框（ExportPlatformDialog→Android/Windows→签名打包链 ✓）。`ShareImagePreviewDialog.kt` 的事实缺位是本维度唯一缺口。

## 四、status.json

- `issue`: 90 ✓；`source_commit`: `dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✓；`source_repo`: operit ✓；`refs_valid`: 116（整数，与 facts 条数一致）✓；`critic` 为空（待闭环，正确）；`status`: review-pending ✓。

## 五、必须修的问题清单（复验前置条件）

**Facts（5 处硬伤）：**
1. [38] 删除或重写：1127 行是 `resolveCenteredMessageIndex` 辅助函数，不是 `ChatScrollNavigator` 重载；该组件只有 :99/:313 两个重载。
2. [45] 事实纠正：滑动方向写反，应为"右滑编辑、左滑删除"（`startActions=editAction` 右滑露出，`endActions=deleteAction` 左滑露出）。
3. [83] 重锚：ref 由 :818 改为 :827（`withSignature` 硬编码三元组实际位置）。
4. [90] 数量纠正：`ScrollToBottomButton` 有三个重载（:42 ScrollState、:97 ChatLazyListState、:156 ComposeLazyListState+reverseLayout），不是两个。
5. [41]/[43]/[44]/[47] 重锚（±5 窗口违规，当前 ref :426 是函数签名行，完全不支持断言）：[41]→ChatViewModel.kt:97；[43]→ChatHistorySelector.kt:582；[44]→ChatHistorySelector.kt:777；[47]→ChatHistorySelector.kt:458。

**Quality（1 处硬伤 + 1 小瑕疵）：**
6. Q7 改写：`ChatScrollNavigator` 的 ChatLazyListState 重载为 1 个（:99）；删掉"ChatScrollExtensions 两个"的错误表述（其两个 `animateScrollToEnd` 是给 androidx LazyListState 的）；可补一句"ScrollToBottomButton :97 重载内 :147 调用的 `animateScrollToEnd` 在 lazy 类型上无对应实现，该死代码疑似未经编译"。
7. Q0 `line` 字段：818 → 826。

**建议修（不阻塞复验，但修了更好）：**
- [8][13][14][15][20][46][48][53][56][57][58][63][67][74][80][81][84][85][87][91][105] 的弱锚点收紧（详见逐条 NOTE）。
- [18] 表述修正：排序在调用方（ChatScreenContent.kt:678），函数内只做过滤拼接。
- 补 `ShareImagePreviewDialog.kt` 的 2–3 条原子事实， closure 28/29 的种子缺口。
- [115] 改写，去掉"ChatScrollExtensions 重载"的错误归类。

**Verdict：FAIL** —— 上述 7 项硬伤修完后需独立复验（重点复核 [38][45][83][90] 与 Q7 的改写是否准确）。
