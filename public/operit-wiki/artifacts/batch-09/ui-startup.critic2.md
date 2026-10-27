# ui-startup 复验报告（critic2）

- 条目：ui-startup（Issue #120），Day 7 / batch-09
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 复验方式：sed/grep 实地核对源码窗口，±5 行口径

## 首轮 FAIL 修复点核验（8/8 精确命中）

| # | 修复内容 | 实地核对 | 结论 |
|---|---|---|---|
| fact[134] | "State 共 13 个字段"（原 14） | `awk '/data class State\(/,/\)/'` 数出 13 个 val/var（:30–43）；ref :33 落在类体内 | ✅ 命中，数字正确 |
| fact[64] | 插件成功率 `(successCount*100)/totalCount`，ref → :929 | :929–932 `val successRate = if (totalCount > 0) { (successCount * 100) / totalCount }` | ✅ 0 行偏差 |
| fact[149] | `writableDatabase()` 取 openHelper.writableDatabase，ref → :317 | :317 `private fun writableDatabase() = AppDatabase.getDatabase(context).openHelper.writableDatabase` | ✅ 0 行偏差 |
| fact[56] | `startAllDeployedPlugins(progressListener)`，ref → :827 | :827 `mcpStarter.startAllDeployedPlugins(progressListener)` | ✅ 0 行偏差 |
| fact[0]/[1] | 拆条：介绍（原 ref）+ progress 钳制（:65） | :65 `val clampedProgress by remember(progress) { derivedStateOf { max(0f, min(1f, progress)) } }` | ✅ 0 行偏差 |
| quality[1] | line 273 → 317 | :317 writableDatabase（双进程 Room 访问证据点） | ✅ |
| quality[2] | line 124 → 137 | :137 `fun restoreRawSnapshot(uri: Uri)`（快照恢复入口） | ✅ |
| quality[5] | line 375 → 384 | :384–386 `PerformanceTab.NETWORK -> 0.0`（排序无操作证据） | ✅ |
| quality[6] | line 315 → 361 | :361–363 `sanitizeSql` → `sql.trim().removeSuffix(";")` | ✅ |

注：fact 索引因拆条整体 +1（首轮 #133→#134、#63→#64、#148→#149、#55→#56），已按断言关键词重新定位，无串位。

## 随机抽查 5 条（seed=120）

| fact | 断言要点 | 实地核对 | 结论 |
|---|---|---|---|
| [131] :664 | QueryResultPanel 320.dp 高 / 180.dp 列宽 / 等宽字体 | 函数声明 :663；320.dp 在 :671、180.dp 在 :704、Monospace 在 :707/:709，内容全部属实 | 内容✅，锚点松散（见建议 1） |
| [63] :911 | onAllPluginsStarted 处理 NODEJS_MISSING、BRIDGE_FAILED | 回调声明 :910；两枚举分支在 :918/:921，内容属实 | 内容✅，锚点松散（见建议 2） |
| [48] :697 | show() 置 isVisible=true、hasTimedOut=false | :696–698 逐行对应 | ✅ 精确命中 |
| [150] :319 | executeQuery 用 writableDatabase().query(sql).use | :319–320 逐行对应 | ✅ 精确命中 |
| [118] :304 | 修复按钮 enabled=!isRunning && 任一 canRepair；点击弹二次确认 | 按钮 :279、enabled 逻辑 :281–284、onClick→showHealthRepairConfirmation :280，内容属实 | 内容✅，锚点松散（见建议 3） |

## 一致性

- facts 158 条 = status.json refs_valid 158；status=review-pending；issue=120；source_commit 完整 hash
- md 正文"14 个字段"残留 0 处，"13 个字段" 1 处（:141），与 facts 一致

## 非阻塞建议（内容均已验真，可后续顺手收紧）

1. fact[131]：多细节断言（320.dp/:671、180.dp/:704）距锚点 :664 超 ±5，建议拆条或锚点移到 :671
2. fact[63]：枚举分支在 :918/:921，建议锚点 :911 → :918
3. fact[118]：按钮证据在 :279–284，建议锚点 :304 → :279

## 结论：PASS

首轮 FAIL 的全部修复点精确命中源码；抽查 5 条内容 100% 属实；计数与状态一致。3 条松散锚点为修复前既有、内容无误，不阻塞。
