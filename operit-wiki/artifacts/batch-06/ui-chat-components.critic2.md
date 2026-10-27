# Critic2 复验报告：ui-chat-components（Issue #90）

复验对象：修错后的 `ui-chat-components.{md,facts.json,quality.json,lint.md,status.json}`，源码 `~/workspace/Operit @ dbf71916`。
复验方法：7 项修错清单逐条源码核对；facts 随机 20 条（seed=90）逐条拉 ref±5 窗口比对；quality 10 条 evidence 首行窗口命中 + severity 复核；status.json 字段核对；禁用词全文 grep。

## 一、第一轮 7 项修错复验：全部到位

1. **[38] 虚构重载**：已改写。"ChatScrollNavigator 只有两个重载（:99/:313）"，源码 `ChatScrollNavigator.kt` 内 `fun ChatScrollNavigator` 仅 :99 与 :313 两处；1126 行确为 `private fun resolveCenteredMessageIndex` 辅助函数。PASS。
2. **[45] 方向写反**：已纠正为"右滑编辑、左滑删除"（ref :2371，窗口内 `startActions = listOf(editAction)`/:2369、`endActions = listOf(deleteAction)`/:2370）。按 `me.saket.swipe.SwipeableActionsBox` 语义（startActions 为右滑露出、endActions 为左滑露出），方向正确。正文第 64 行已同步为"右滑编辑/左滑删除"。PASS。
3. **[83] 锚点错位**：ref 已改为 :827，窗口 822–832 逐字含 `"android" // 密码`、`"androidkey" // 别名`、`"android" // 密钥密码`。PASS。
4. **[90] 数量错误**：已改写为三个重载（:42 ScrollState、:97 ChatLazyListState、:156 ComposeLazyListState+reverseLayout），与源码三处 `fun ScrollToBottomButton` 完全一致。PASS。
5. **[41]/[43]/[44]/[47] 锚点错位**：已分别重锚 `ChatViewModel.kt:97`（ChatHistoryDisplayMode 三枚举值）、`ChatHistorySelector.kt:582`（`!hasTitleOrGroupMatch && trimmedQuery.length >= 2`）、`:777`（`rememberReorderableLazyListState`）、`:458`（`rememberLocal("chat_history_collapsed_groups"...)`）。4/4 窗口支撑。PASS。
6. **Q7 改写**：已改写正确。`ScrollToBottomButton` 的 ChatLazyListState 重载（:97）内部在 :147 调用 `scrollState.animateScrollToEnd()`；`ChatScrollExtensions` 的两个 `animateScrollToEnd` 只扩展 androidx `LazyListState`（:11）与 `ComposeLazyListState`（:35），lazy 类型上无对应实现——死代码路径疑似未经编译的断言成立。PASS。
7. **Q0 line**：已改为 826（`apkEditor.withSignature(` 实际行）。PASS。

## 二、随机抽查 20 条：发现 5 处锚点窗口支撑不全（断言均为真）

20 条 ref 全部存在、行号无越界；15 条窗口完整支撑。以下 5 条需修错员重锚：

1. **facts[26]** ref `ChatArea.kt:614`：窗口只有 `MessageItem` 函数签名，`ChatMessageMenuItemRegistry` 不在窗口内。断言"长按菜单含插件注册项，插件可经 ChatMessageMenuItemRegistry 添加条目与对话框"为真（`createMenuItems` 调用在 :720）。修正：ref → **:720**。
2. **facts[91]** ref `ScrollToBottomButton.kt:120`：窗口只有拖拽检测逻辑，`animateScrollToEnd` 不在窗口内。断言为真（:97 重载的点击处理在 :147 调用 `scrollState.animateScrollToEnd()`；浮现/隐藏逻辑在 :120–141）。修正：建议拆两条——浮现/隐藏锚 :120，点击调用锚 :147；或单锚 :147 并改写断言只讲点击。
3. **facts[84]** ref `ExportDialogs.kt:860`：窗口只有 `exportWindowsApp` 函数签名，`subpack/windows.zip` 在 :893。修正：ref → **:893**。
4. **facts[81]** ref `ExportDialogs.kt:766`：窗口只有 KDoc 参数说明，`subpack/android.apk` 模板在 :782。修正：ref → **:782**。
5. **facts[33]** ref `ChatScrollNavigator.kt:99`：窗口是 `ChatScrollNavigator` 函数签名，"快速滚动 chip 用 Canvas 自绘进度线与圆点"实际在 :251（`Canvas` 内 `drawLine` 进度线 + `drawCircle` 圆点）。修正：ref → **:251**。

（抽查中 facts[113]（README.md:15）初判关键词未命中，经人工读窗口确认"这次没有执行编译、构建或测试"逐字在窗口内，为真，不计问题。）

## 三、quality 10 条：全部 PASS

- evidence 首行 10/10 落在各自 ±5 窗口内；severity 合理（1 high / 3 warn / 6 suggestion）。
- high（Q0）：`exportAndroidApp` 用硬编码调试密钥（密码 android/别名 androidkey）签名导出 APK，`keyStoreFile` 来自 `KeyStoreHelper.getOrCreateKeystore` 的 assets 内置 keystore、随 App 分发、所有用户共用——更新劫持风险实锤，high 评级恰当。
- 其余 9 条（MessageEditor 正则窄于中心正则、AttachmentSelector 缓存堆积、分享 Intent 重投递静默吞等）逐字命中，评级合理。

## 四、合规

- status.json：id=ui-chat-components、issue=90（整数）、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb、refs_valid=116（= facts 数组长度）、review-pending，全对。
- 禁用词（通过/批准/LGTM）：4 个交付文件 0 命中。
- 隔离 lint：0 硬失败 / 0 警告。
- facts/quality 顶层数组；severity 仅 high/warn/suggestion。

## 结论

**verdict: FAIL**——无虚构事实，第一轮 7 项硬伤全部修到位；但随机抽查发现 5 处 facts 锚点窗口支撑不全（[26]:614→:720、[91]:120→拆条或:147、[84]:860→:893、[81]:766→:782、[33]:99→:251）。均为机械重锚，断言本身已验真。修错员按本节清单修正后，parent 核对 ±5 窗口即可，无需第三轮全量复核。
