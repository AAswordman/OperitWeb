# ui-floating 独立评审报告（critic）

- 条目：ui-floating / Issue #111
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 结论：**FAIL（需修改）** — 1 处必须修复（非推倒重来），另 2 处可选收紧。

## 1. facts 抽查：35/35 命中

抽样（seed=111）：fact[54][80][126][49][101][106][43][134][107][58][46][85][59][53][105][130][91][35][48][28][103][121][92][98][44][63][102][4][40][86][97][87][30][72][57]。

逐条用 sed 实地核对 ±5 行窗口：**35/35 全部命中，0 错位、0 编造**。另全量机械校验 138/138：键恰为 `{fact, ref}`、ref 全部 `app/src/...kt:行号` 格式、文件全部存在、行号全部不越界。

代表性核验：
- [126] `:336` = `toolHandler.executeTool(AITool(name = "capture_screenshot"))` ✓
- [49] `:228` = `delay(2000)` + "Silence timeout, sending..." ✓
- [134] `:418` = 注释"graphicsLayer { alpha = 0.99f } … BlendMode.Clear 创建挖洞效果" ✓
- [28] `:27` = 注释"3秒后自动切回球模式" + `delay(3000)` ✓
- [44] `:160` = `while (!ok && attempt < 12)` ✓
- [63] `:72` = `WakeWordPreferences.DEFAULT_VOICE_CALL_INACTIVITY_TIMEOUT_SECONDS` ✓
- [92] `:638` = `rememberNoiseBitmap(size: Int = 120)` ✓

## 2. 必须修复清单（1 项）

1. **frontmatter `sources: 28` ≠ facts 去重引用文件数（26）**。
   本批铁律：frontmatter sources = distinct 引用文件数（其余 9 页全部一致：ui-about 6=6、ui-demo 10=10、…、ui-websession 12=12）。
   两个在"来源"小节但零 facts 的文件：
   - `ui/floating/ui/fullscreen/components/GlassyChip.kt`（88 行）
   - `ui/floating/ui/window/components/ChatIndicators.kt`（62 行）
   修复（二选一，推荐前者以满足"全面覆盖"）：为两个文件各补 ≥1 条事实（补后 sources=28 自然成立）；或把 sources 改为 26。

## 3. 可选收紧（不影响 PASS）

- fact[91] `WaveVisualizerSection.kt:154` 是 `AiLoadingWaveOverlay` 声明行；断言中的"双反向旋转圆弧"（实际在 :218–240）、"多轨道圆点"（:253–256）距锚点约 60–100 行。符号名在 ±5 行内，铁律合规，但建议重锚到 :218 或拆 fact。
- quality[6] line `:233` 距证据 `LaunchedEffect(items)`（:238，正好是 N+1 协程起点）5 行，卡在 ±5 边界上，建议收紧到 :238。

## 4. quality.json 核查：8/8 证据真实

warn 4 / suggestion 4，`severity` 仅用 high|warn|suggestion，字段含 `detail`（无 `description`）。8 条 file:line 全部存在，evidence 与源码一致，severity 合理：
- Q0 `BallParticles.kt:117` = `LaunchedEffect(Unit)` + `while (true)` + `withFrameNanos` ✓
- Q1 `FloatingFullscreenModeViewModel.kt:158` = `delay(120)` + while 轮询 `isAiBusyOrSpeaking()` ✓
- Q2 `SpeechInteractionManager.kt:160` = `while (!ok && attempt < 12)` 无 isActive 检查 ✓
- Q3 `FloatingChatWindowScreen.kt:520` = 点击处理器内 `runBlocking` ✓
- Q4 `SiriBall.kt:157` = `rememberInfiniteTransition` ✓
- Q5 `FloatingChatWindowScreen.kt:454` = `while (true)` + `awaitPointerEvent()` ✓
- Q6 `FloatingChatWindowScreen.kt:233`（证据 `LaunchedEffect(items)`+forEach+launch 在 :238–245，N+1 查头像属实）✓
- Q7 `BottomControlBar.kt:399` = `withTimeoutOrNull` 内嵌 `while (true)` 手势循环 ✓

备注：8 条均缺 `category` 字段（SCHEMA §8 列为字段之一，但 `build_quality.py` 不读它；本批其他页同样缺失，建议后续统一补，不阻塞）。

## 5. md 结构核查：§9 合规

- 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源。
- AI 速览三要素齐全（核心符号清单 24 项、主入口 FloatingChatWindow→AnimatedContent 分发、数据流向一句话）。
- frontmatter：title/module/sources/date/issue 齐全。
- 禁用词（可能/大概/似乎/应该/也许）：全文 0。
- 正文种子声明"28 个 Kotlin 文件、8,093 行"：实测 28 文件（排除 ui/pet/AvatarEmotionManager.kt）共 8,093 行，精确一致。
- "来源"小节列出 28 个种子文件（含 BottomControlBar.kt、FloatingChatWindowScreen.kt 的千分位行数），非空。

## 6. status.json：合规

`refs_valid=138` = facts 数，`status=review-pending`，`issue=111`，`source_commit` 为完整 hash，`source_repo=operit`。

## 7. lint

本页 4 个真实文件（md/facts/quality/status）**0 硬失败 / 0 警告**。报错只落在 `ui-floating.lint.md` 自检报告自身（lint.py 扫描自检报告的已知工具 quirks，batch 内各页同理，不阻塞）。

## 结论

**FAIL** — 修复 §2 的 sources 计数不一致（推荐给 GlassyChip.kt、ChatIndicators.kt 补 facts），其余无需改动。修复后针对性复验即可 PASS。
