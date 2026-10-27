# 独立 critic 报告 — ui-assistant（Day 7 / batch-09，Issue #116）

- 评审人：独立 critic（新 session，只读 facts/ref 指向的源码）
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 日期：2026-10-01

## 1. facts 抽查

- 抽查 30 条（fact 编号 7, 9, 11, 12, 14, 15, 17, 18, 22, 24, 28, 30, 38, 54, 70, 72, 73, 74, 80, 82, 93, 101, 105, 107, 111, 117, 122, 129, 132, 137），逐条用 sed 拉源码窗口实地核对。
- 命中 29 / 错位 0 / 锚点可优化 1。
- 全部 ref 为 `app/src/...kt:行号` 仓库根相对全路径，143 条事实全部 {"fact","ref"} 结构，无断言与代码不符。

### 锚点可优化（非事实错误，不影响 PASS）

- fact[11]：「uiState 以 StateFlow 对外暴露，内部为 MutableStateFlow」
  - 原 ref：`.../viewmodel/AssistantConfigViewModel.kt:51`（第 51 行为空行）
  - 实际符号在 `:49–50`（`private val _uiState = MutableStateFlow(UiState())` / `val uiState: StateFlow<UiState> = _uiState.asStateFlow()`），在铁律 ±5 行内
  - 修正建议：ref 改为 `:50`，锚到声明行

## 2. quality.json 核查（真实性，不重做走查）

- 4 条 findings 的 file:line 全部存在，evidence 与源码摘录一致：
  - [warn] AvatarConfigSection.kt:136：`while (isActive)` + `delay(300)` 轮询可用动画列表，证据真实
  - [warn] AssistantConfigViewModel.kt:138：updateScale 直写 repository 落盘，证据真实
  - [suggestion] VoiceAutoAttachComponents.kt:360：`id = "item_${System.currentTimeMillis()}"`，证据真实
  - [suggestion] HowToImportSection.kt:39：第三方编辑器 URL 硬编码，证据真实
- severity 合理（300ms 轮询、滑杆高频落盘为 warn，时间戳 id、硬编码 URL 为 suggestion），confidence 与风险匹配。
- 备注：4 条的 `category` 字段为空（SCHEMA §8 建议含 category），属格式小瑕疵，不影响真实性。

## 3. .md 结构核查（§9 双受众）

- §9 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源
- frontmatter：title/module/sources(7)/date/issue 齐全；"来源"小节列出 7 个种子文件及行数，与源码实际行数一致
- 禁用词（可能/大概/似乎/应该/也许）：全文无
- wikilink 按文件名：`[[ui-main|主界面与导航骨架]]`，合规
- 风险断言实地核验无编造：
  - "220.dp 高的实时预览区" → AssistantConfigScreen.kt:221 `.height(220.dp)`，属实
  - "从主界面侧边栏进入" → OperitScreens.kt:726 注册 `AssistantConfigScreen()`（data object Screen，NavItem），属实
  - "分两个 Tab" / "三段模板录完才能保存" 等均有源码对应

## 4. status.json 核查

- refs_valid=143 = facts.json 条数（143）✓
- status=review-pending ✓
- issue=116 ✓
- source_repo=operit、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（完整 hash）✓

## 5. lint

- `python3 scripts/lint.py --src ~/workspace/Operit --dir <仅含 ui-assistant.md>`：检查文件 1，硬失败 0，警告 0 ✓

## 结论：PASS

- 必须修复清单：无。
- 非阻塞建议：fact[11] 的 ref 从 `:51` 改为 `:50`；quality.json 4 条可补 `category` 字段（不影响当前交付）。
