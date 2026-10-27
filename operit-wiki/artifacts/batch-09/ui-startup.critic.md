# critic 报告 — ui-startup（Issue #120）

- 评审时间：2026-10-01
- 评审范围：`review/batch-09/ui-startup.md / .facts.json / .quality.json / .lint.md / .status.json`
- 源码钉住：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`

## 1. facts 抽查

随机抽查 **35 条**（seed=120），命中 **29** / 错位 **6**：

| # | 原 ref | 结论 | 正确 ref / 修正建议 |
|---|---|---|---|
| 0 | `AnimatedProgressBar.kt:45` | ⚠️ 轻微漂移 | "progress 范围 0.0-1.0" 的依据是 `max(0f, min(1f, progress))` clamp（实际 `:65`）。建议把该断言拆成独立 fact，ref 改 `AnimatedProgressBar.kt:65`。 |
| 29 | `PluginLoadingScreen.kt:279` | ✅ 容忍（±5 内） | `intermediateSteps = 20` 在 `:283`、`stepDuration = 50` 在 `:285`，均在 ±5 内。可优化为 `:283`。 |
| 55 | `PluginLoadingScreen.kt:813` | ⚠️ 部分漂移 | `MCPStarter(context)` 在 `:812`；但 `startAllDeployedPlugins(progressListener)` 实际在 **`:827`**，超出 ±5。建议 ref 改 `:827`（或拆成两条）。 |
| 63 | `PluginLoadingScreen.kt:912` | ❌ 错位 | "成功率按 (successCount*100)/totalCount 计算" 实际在 `:929-931`。ref 改 **`PluginLoadingScreen.kt:929`**。 |
| 133 | `DataRecoveryViewModel.kt:33` | ❌ 事实错误 | fact 与 .md 均称 "State 共 14 个字段"。实地数出 **13 个**（isRunning、status、error、sqlText、queryResult、affectedRows、lastSnapshotPath、restoreCompleted、两份健康报告、两份修复存档路径、healthRepairCompleted）。改为 **13**。 |
| 148 | `DataRecoveryViewModel.kt:274` | ❌ 错位 | `writableDatabase()` 实际在 **`:317`**（`AppDatabase.getDatabase(context).openHelper.writableDatabase`），原 ref 偏 43 行。ref 改 **`DataRecoveryViewModel.kt:317`**。 |

命中确认的抽查点（节选）：9 个 MutableStateFlow（实数 9）、synchronized(pluginStateLock)、startTimeoutCheck 默认 30000L、skip() 三步、2_000_000 字符 takeLast、CpuPage 四系列、MemoryPage 三系列、networkAvailable 占位、NETWORK 排序键 0.0、exportRawSnapshot 按钮禁用、SelectionContainer 等宽路径、authority 拼接、REBUILD_INDEXES/RUN_ROOM_MIGRATIONS、restartMainApp toast。机械检查：157 条 ref 全部仓库根相对全路径、文件存在、行号在范围内。

## 2. quality.json 核查（7 条）

- [0] high `DataRecoveryViewModel.kt:64`：exported Activity 执行任意 SQL。证据与 runSql 体（`:53` 起）一致，severity 合理。✅
- [1] warn `DataRecoveryViewModel.kt:273`：❌ 行号漂移。writableDatabase() 实际在 **`:317`**。evidence 文本本身与源码一致。
- [2] warn `DataRecoveryViewModel.kt:124`：❌ 行号漂移。restoreRawSnapshot() 实际在 **`:137`**。
- [3] warn `DataRecoveryActivity.kt:159`：✅（snapshotPicker.launch 在 `:163`，±5 内）。证据与源码一致。
- [4] warn `PluginLoadingScreen.kt:602`：✅ 精确命中 appendPluginLog，证据一致。
- [5] suggestion `PerformanceMonitorScreen.kt:375`：❌ 行号漂移，`NETWORK -> 0.0` 实际在 **`:384`**。断言本身为真。
- [6] suggestion `DataRecoveryViewModel.kt:315`：❌ 行号漂移，sanitizeSql 实际在 **`:361`**。断言为真。
- 字段命名：用 `description` 而 SCHEMA §8 规定 `detail`，且缺 `category`（lint 不校验；batch-08 已混用，此处仅记录，不判错）。

## 3. .md 结构核查（§9）

- 概述 / AI 速览 / 核心机制（7 节）/ 关键符号 / 调用链（4 条，输入→处理→输出）/ 来源：齐全 ✅
- frontmatter：title/module/sources=7/date/issue=120 齐全 ✅
- 人话：机制叙述有人味（"急救室""桌面任务管理器"类比准确），术语首现基本有解释 ✅
- lint：正文 0 硬失败 / 0 警告，无禁用词 ✅
- **事实错误**：§7 称 "State 一共 14 个字段"，实为 13（同上）。❌
- 次要：种子行数写"约 3,134 行"，实测 7 文件共 3,236 行（估计值，可忽略）；种子说明中 "StartupScreen.kt / PerformanceScreen.kt 在该 commit 不存在" 已用 find 验证为真 ✅；manifest `:repair`+exported=true 与 DataRecoveryActivity 条目一致 ✅

## 4. status.json 核查

- `refs_valid: 157` = facts 数 157 ✅
- `status: review-pending` ✅
- `issue: 120` ✅
- `source_commit` 完整 hash ✅

## 结论：FAIL

### 必须修复清单（writer 修后请重新 critic）

1. **fact[133]**：`DataRecoveryViewModel.kt:33` — "State 共 14 个字段" 改为 **13 个字段**；同步修 .md §7 同句。
2. **fact[63]**：ref 改 `PluginLoadingScreen.kt:929`（successRate 计算处）。
3. **fact[148]**：ref 改 `DataRecoveryViewModel.kt:317`（writableDatabase）。
4. **fact[55]**：ref 改 `PluginLoadingScreen.kt:827`（startAllDeployedPlugins），或拆成两条分别锚定 `:812` / `:827`。
5. **quality[1]**：line 改 317（writableDatabase）。
6. **quality[2]**：line 改 137（restoreRawSnapshot）。
7. **quality[5]**：line 改 384（NETWORK -> 0.0）。
8. **quality[6]**：line 改 361（sanitizeSql）。
9. （建议）**fact[0]**：把 "progress 0.0-1.0" 拆成独立 fact，ref `AnimatedProgressBar.kt:65`。

说明：quality.json 的 `description`/`category` 字段与 SCHEMA §8 不一致，但 lint 不校验且历史批次混用，不列为本次 FAIL 项；建议后续统一口径。
