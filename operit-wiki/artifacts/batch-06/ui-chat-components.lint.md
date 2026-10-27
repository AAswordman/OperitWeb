# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（/tmp 隔离跑 lint.py --src ~/workspace/Operit：0 硬失败 / 0 警告，一次过。facts.json 116 条、quality.json 10 条均为顶层数组；severity 仅 high/warn/suggestion；正文含完整 frontmatter（title/module/sources/date）与固定结构。）

## 修错轮（2026-10-01，critic.md 打回 7 项硬伤）

- facts[38] 重写：ChatScrollNavigator 只有两个重载（:99 接 ChatLazyListState、:313 接 ScrollState + messageAnchors），1126 行是 resolveCenteredMessageIndex 辅助函数，非重载。
- facts[45] 事实纠正：startActions=editAction / endActions=deleteAction，按 SwipeableActionsBox 语义为"右滑编辑、左滑删除"（初稿写反）；正文第 64 行同步修正。
- facts[83] 重锚：:818 → :827（withSignature 硬编码三元组实际位置）。
- facts[90] 数量纠正：ScrollToBottomButton 有三个重载（:42 ScrollState、:97 ChatLazyListState、:156 ComposeLazyListState + reverseLayout），非两个。
- facts[41]/[43]/[44]/[47] 重锚：:426（函数签名行）→ ChatViewModel.kt:97 / ChatHistorySelector.kt:582 / :777 / :458。
- quality Q7 改写：ChatScrollNavigator 的 ChatLazyListState 重载只有 1 个（:99）；ScrollToBottomButton :97 重载内 :147 的 animateScrollToEnd 在 lazy 类型上无对应实现（ChatScrollExtensions 两个 animateScrollToEnd 只扩展 androidx LazyListState），死代码路径疑似未经编译。
- quality Q0 line 字段：818 → 826。
- facts 总数保持 116，status.json refs_valid=116 不变；修正条目 ±5 窗口逐条复验全部支撑。
- 4 文件 /tmp 隔离跑 lint.py --src ~/workspace/Operit：**0 硬失败 / 0 警告**；5 文件禁用词 0 命中。
