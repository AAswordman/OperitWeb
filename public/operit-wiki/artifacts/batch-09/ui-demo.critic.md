# ui-demo critic 评审报告（Day 7 / batch-09，Issue #117）

- 评审人：独立 critic（subagent）
- 评审时间：2026-10-01
- 源码钉住：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（本地 HEAD 已确认一致）
- 评审对象：`review/batch-09/ui-demo.md` / `.facts.json`（158 条）/ `.quality.json`（10 条）/ `.lint.md` / `.status.json`

## 一、facts 抽查（随机 30 条，seed=117）

抽查编号：61、46、42、53、102、40、142、104、30、134、144、84、89、116、8、32、95、111、17、41、140、98、108、106、1、152、135、156、36、123。

**命中 21 / 需修正 9。**

### 必须修正（违反引用铁律 ±5 行 / 锚点错位）

1. **fact[32]** — 原 ref `DemoStateManager.kt:359` 错位。该行处是 Shizuku 权限检查代码，与断言（"OperitTerminal 已安装状态被 NodeJS/Python 环境就绪度检查替代，结果写入 isOperitTerminalInstalled"）完全无关。正确行：`:403`（`updateOperitTerminalInstalled(isNodejsPythonEnvironmentReady)`）。→ ref 改为 `:403`。
2. **fact[36]** — 原 ref `DemoStateManager.kt:421` 错位。该行是位置权限检查，与断言（"电池优化豁免用 PowerManager.isIgnoringBatteryOptimizations(packageName) 判断"）无关。正确行：`:436`。→ ref 改为 `:436`。
3. **fact[95]** — 原 ref `DialogComponents.kt:34`，断言符号 `LinearProgressIndicator` 实际在 `:43–45`，超出 ±5 范围。→ ref 改为 `:41`（`if (isExecuting)` 块起点）。
4. **fact[106]** — 原 ref `PermissionLevelCard.kt:107` 错位。该行是卡片 elevation 动画，与断言（"首次加载时把浏览级别同步为激活级别"）无关。正确行：`:115`（`LaunchedEffect(Unit) { displayedPermissionLevel = preferredPermissionLevel.value ... }`）。→ ref 改为 `:115`。
5. **fact[144]** — 原 ref `RootWizardCard.kt:354` 锚在错误分支。该行处是 `isDeviceRooted ->` 分支（设备已 Root、应用未授权，首文本为 `root_wizard_device_rooted_message`），但断言写的是"未 Root 态"。真正的"未 Root 态"是 `else ->` 分支（`:387` 起，`root_wizard_device_not_rooted` 在 `:392`），且断言中提到的 errorContainer 风险提示（`:407`）与查看教程 ElevatedButton（`:457`）也都在 else 分支。→ ref 改为 `:392`。
6. **fact[156]** — 原 ref `OperitTerminalWizardCard.kt:119`，该行是顶部状态头图标，断言（"未就绪时逐项显示 pnpm 与 pip 的安装状态行"）的证据在 `:133`（`if (!isEnvironmentReady)`）/ `:139`（pnpm 状态行）。超出 ±5 范围。→ ref 改为 `:133`。
7. **fact[61]** — 多证据断言部分漂移。`ShizukuDemoScreen`（:44）、`ShizukuDemoViewModel.Factory`（:48）在 ±5 内，但 `navigateTo` 可空回调的证据在 `:53`（`navigateTo: ScreenNavigationHandler? = null`），超出 ±5。→ ref 改为 `:53` 或拆条。
8. **fact[116]** — 断言"四态为未安装、未授权、待更新、已授权"经核对为真（`:797–803` 的 statusText when：status_not_installed / status_not_granted / status_update_needed / status_granted），但 ref `:657` 只是函数签名，证据超出 ±5。→ ref 改为 `:797`。
9. **fact[123]** — 断言含 `FeatureGrid`，其调用在 `:1333`，ref `:1286` 为函数签名，超出 ±5。→ ref 改为 `:1333` 或拆条。

> 说明：9 条 facts 需改（61、116、123 为多证据断言部分证据越界 ±5；32、36、95、106、144、156 为锚点错位/越界）。

### 命中（内容与锚点均正确，示例）

- fact[46] `:33` 三属性代理 ✓；fact[42] `:21` 继承 AndroidViewModel ✓；fact[53] `:112–116` Root 授权后 Toast + 执行 `id` ✓；fact[102] `:149` SampleCommandsCard 签名 ✓；fact[40] `:504` 终端示例 6 条（实数 6）✓；fact[41] `:515` Root 示例 8 条（实数 8）✓；fact[142] `:246` 已授权分支测试按钮复用 onRequestRoot ✓；fact[104] `:92` collectAsState(STANDARD) ✓；fact[30] `:316`（符号在 :319，±5 内）✓；fact[134] `:169` AnimatedVisibility ✓；fact[84] `:380` IO 线程调 requestRootPermission ✓；fact[89] `:509–513` getLaunchIntentForPackage("moe.shizuku.privileged.api") ✓；fact[8] `:90–93` showRootWizard 置 true ✓；fact[111] `:296–304` 五级别 when 切 Section ✓；fact[17] `:194` 协程包装 ✓；fact[140] `:47` 签名 ✓；fact[98] `:82` 确定按钮条件 ✓；fact[108] `:209–230` 保存偏好/清缓存/Toast/回调四步齐 ✓；fact[1] `:41` ✓；fact[135] `:175` ✓；fact[152] `:363`（签名参数与 body 的 installedVersion/bundledVersion/onUpdate 一致）✓。

## 二、quality.json 核查（只看真实性）

10 条 finding 的 file:line 全部存在，符号在 ±3 行内可见；逐条核对了证据链：

- [0] 双重注册：屏幕 `:82` DisposableEffect 与 Manager `:57` init 注册并存，属实。
- [1] onInstallFromStore 全文件仅 `:27` 声明一处，步骤一按钮只用 onInstallBundled，属实（high 置信度合理）。
- [4] isInitialized 仅 `:93` 声明、`:107` 一次写入、无读取，属实。
- [9] PermissionStatusItem.kt 独立文件与 PermissionLevelCard.kt:534 内版本并存，属实。
- 其余 [2][3][5][6][7][8] 行号与证据代码均对上，severity（warn×3 / suggestion×7）与 confidence 标注合理，无夸大。

结论：**quality 10/10 验真通过**。字段为 title/evidence/line/description/confidence/file/severity（SCHEMA §8 字段齐全，缺 category 字段——§8 要求 `severity/category/file/line/title/detail/evidence/confidence`，建议补 `category`，但属轻微格式问题，不影响真实性）。

## 三、.md 结构与内容（SCHEMA §9）

- 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源；AI 速览含核心符号清单、主入口、数据流向一句话；调用链为输入→处理→输出编号步骤。
- frontmatter 齐全：title / module / sources: 10 / date / issue: 117。
- 禁用词扫描：无（可能/大概/似乎/应该/也许零命中）。
- 来源节列出 10 个 seed 文件，与 frontmatter sources 一致。
- 抽查正文引用：关键符号节 23 个符号锚点抽查（PermissionLevelCard.kt:59、PermissionStatusItem.kt:17 等）命中；调用链 #7 的 onInstallBundled（:424，handler 在 :427，±5 内）与 #8 的无障碍风险确认框（:276–282）属实。#8 称"输入确认文本匹配才执行 launchProviderInstall"——实际 launchProviderInstall 由屏幕侧回调（ShizukuDemoScreen.kt:225/349/365）经 UIHierarchyManager 调用，卡片只负责风险对话框；属可接受的概括，未构成编造。
- 未发现超出引用支撑的发挥。

## 四、status.json

- `refs_valid`: 158 = facts 条数 158 ✓
- `status`: review-pending ✓
- `issue`: 117 ✓
- `source_repo`: operit ✓，`source_commit`: dbf71916fae9750cfdc9f9a774f5a0fee56633fb（完整 hash）✓

## 五、lint

单独对 ui-demo.* 跑 `scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint_demo`：**0 硬失败 / 0 警告**。（注：整批 batch-09 目录混跑有 73 硬失败/547 警告，均来自其他 writer 的 `.lint.md` 被误扫及 ui-startup 的坏引用，与本页无关。）

## 结论：FAIL（需修改）

必须修复清单（writer 修完后需复验）：

1. fact[32] ref → `DemoStateManager.kt:403`
2. fact[36] ref → `DemoStateManager.kt:436`
3. fact[95] ref → `DialogComponents.kt:41`
4. fact[106] ref → `PermissionLevelCard.kt:115`
5. fact[144] ref → `RootWizardCard.kt:392`（同时确认断言"未 Root 态"描述的是 else 分支内容）
6. fact[156] ref → `OperitTerminalWizardCard.kt:133`
7. fact[61] ref → `ShizukuDemoScreen.kt:53` 或拆条
8. fact[116] ref → `PermissionLevelCard.kt:797`
9. fact[123] ref → `PermissionLevelCard.kt:1333` 或拆条

建议（非阻塞）：quality.json 补 `category` 字段以完全符合 SCHEMA §8。
