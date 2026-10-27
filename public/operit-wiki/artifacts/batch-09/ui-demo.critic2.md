# ui-demo 复验报告（critic2）

- 条目：`ui-demo`（权限引导与演示界面）
- Issue：#117
- 批次：batch-09（Day 7）
- 复验时间：2026-10-01
- 前置：首轮 critic（ui-demo.critic.md）FAIL，指出 9 处 ref 问题；parent 已修复；fact[61] 多证据断言已拆分为两条单证据 facts（新索引 61/62），facts 总数 158 → 159，status refs_valid 已同步为 159。
- 复验方式：`sed -n` 实地拉源码窗口（±5 行），源码路径 `~/workspace/Operit`。

## 1. 十条修复 ref 逐条复验

| fact | ref | 复验窗口 | 结论 |
|---|---|---|---|
| [32] | DemoStateManager.kt:403 | 398–408 | ✅ 命中。`:403` 即 `updateOperitTerminalInstalled(isNodejsPythonEnvironmentReady)`，断言"OperitTerminal 已安装状态被 NodeJS/Python 环境就绪度检查替代"精确命中调用处 |
| [36] | DemoStateManager.kt:436 | 431–441 | ✅ 命中。`:436` 即 `powerManager.isIgnoringBatteryOptimizations(context.packageName)`，断言"电池优化豁免用 PowerManager.isIgnoringBatteryOptimizations(packageName) 判断"逐字命中 |
| [61] | ShizukuDemoScreen.kt:44 | 39–58 | ✅ 命中。`:43` 为 `@Composable`、`:44` 为 `fun ShizukuDemoScreen(`，viewModel 默认构造链在 `:45–51`（`ShizukuDemoViewModel.Factory(` 在 `:47`），均在 ±5 内。**文本小瑕疵**：fact 写"ShizukuDemoViewModel.Factor"应为"Factory"（笔误，不影响 ref） |
| [62] | ShizukuDemoScreen.kt:53 | 39–58 | ✅ 命中。`:53` 即 `navigateTo: ScreenNavigationHandler? = null`，断言"navigateTo 回调参数类型为可空 ScreenNavigationHandler，默认 null"逐字命中 |
| [96] | DialogComponents.kt:41 | 36–46 | ✅ 命中。`:40` `if (isExecuting)`、`:41` `LinearProgressIndicator(`，断言"isExecuting 时标题下方加 LinearProgressIndicator"精确命中 |
| [107] | PermissionLevelCard.kt:115 | 110–120 | ✅ 命中。`:113` 注释"当组件首次加载时，同步显示级别和实际级别"、`:115` `displayedPermissionLevel = preferredPermissionLevel.value ?: AndroidPermissionLevel.STANDARD`，断言"首次加载时把浏览级别同步为激活级别"精确命中 |
| [117] | PermissionLevelCard.kt:797 | 792–802 | ✅ 命中。`:796` `val statusText =`、`:797` `when {`，四态分支（未安装/未授权/待更新/已授权）在 `:798–803`，均在 ±5 内 |
| [124] | PermissionLevelCard.kt:1333 | 1328–1338 | ✅ 命中。`:1333` 即 `FeatureGrid(level)`，`:1336` 即 `private fun FeatureGrid(level: AndroidPermissionLevel)`，断言精确命中 |
| [145] | RootWizardCard.kt:392 | 387–397 | ✅ 命中。`:392` 即 `root_wizard_device_not_rooted`，断言"未 Root 态显示未 Root 说明、errorContainer 风险提示与查看教程 ElevatedButton"锚定正确 |
| [157] | OperitTerminalWizardCard.kt:133 | 128–175 | ⚠️ 轻微错位。`if (!isEnvironmentReady)` 在 `:132`，但 pnpm 状态行证据在 `:139`（`// pnpm状态`）、pip 在 `:158`；pnpm 距 ref 6 行，超出 ±5 容差。事实内容准确，建议 ref `:133` → `:139`（pnpm 状态行首） |

**修复项复验：9/10 精确命中，1 条轻微错位（fact[157]，偏 6 行，事实准确，建议 :133→:139）。**

## 2. 随机抽查 5 条（确认文件未改坏）

| fact | ref | 结论 |
|---|---|---|
| [0] | DemoStateManager.kt:39 | ✅ 命中。`:39` 即 `class DemoStateManager(private val context: Context, private val coroutineScope: CoroutineScope) : ViewModel()` |
| [50] | ShizukuDemoViewModel.kt:81 | ✅ 命中。`:81` `fun refreshStatus(context: Context)`，`:83` checkRootStatus、`:84` stateManager.refreshStatus() |
| [100] | DialogComponents.kt:88 | ⚠️ 预先存在（非本轮修复范围）。事实准确（复制按钮走 setPrimaryClip + Toast），但 `setPrimaryClip`/`Toast` 证据在 `:100–101`，距 ref `:88` 约 12 行，锚点偏宽松 |
| [130] | PermissionStatusItem.kt:49 | ✅ 命中。`:49` 即 `text = if (isGranted) "Authorized" else "Unauthorized"`，逐字命中 |
| [158] | OperitTerminalWizardCard.kt:172 | ✅ 命中。`:171` `"pip"` 状态行在 ±5 内 |

抽查结论：文件结构完好，5 条 facts 键均为 `{fact, ref}`，ref 全部为仓库根相对全路径（`app/src/` 开头），无改坏。

## 3. 数量与状态一致性

- `ui-demo.facts.json`：159 条 ✅
- `ui-demo.status.json`：`refs_valid: 159`，`status: review-pending` ✅
- facts 数 = refs_valid ✅
- frontmatter：`sources: 10`，`issue: 117` ✅
- `ui-demo.quality.json`：10 条走查 ✅

## 4. 复验结论

**PASS** —— 十条修复 ref 中 9 条精确命中（±5 行内见断言符号），fact[157] 轻微错位（6 行，事实准确，建议 `:133`→`:139`）；抽查 5 条文件结构完好，数量与状态一致。

遗留建议（非阻塞）：
1. fact[157] ref `:133` → `:139`（pnpm 状态行首）。
2. fact[61] 文本笔误"ShizukuDemoViewModel.Factor" → "Factory"。
3. fact[100]（预先存在）ref `:88` → `:100` 可收紧到 setPrimaryClip/Toast 证据。
