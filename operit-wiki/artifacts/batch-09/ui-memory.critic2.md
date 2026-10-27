# 复验报告：ui-memory（Issue #112）— critic2

- 复验时间：2026-10-01
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 复验范围：首轮 FAIL 的 8 条 facts 重锚 + md 调用链 ref + lint.md 数字修正
- 方法：sed 实地核对源码窗口（±5 行口径）

## 修复点核对（8/8 精确命中）

| # | ref | 实地窗口 | 结论 |
|---|-----|---------|------|
| 61 | MemorySearchSettingsDialog.kt:214 | `:214 if (cloudEnabled) {`，:215-216 出 endpoint 输入框 | HIT |
| 107 | FolderNavigator.kt:308 | `:308 if (contextMenuFolder != null && !showRenameDialog && !showDeleteDialog)`，注释"右键菜单（不与其他对话框同时显示）" | HIT |
| 108 | FolderNavigator.kt:571 | `:571 onClick = { if (folderName.isNotBlank()) onCreate(folderName.trim()) }` | HIT |
| 129 | MemoryScreen.kt:397 | `:397 preferencesManager.setActiveMemorySpace(id)` | HIT |
| 144 | MemoryViewModel.kt:271 | `:271 newConfig.normalized()`，:272-275 `coerceIn(MIN..MAX)` 钳制间隔 | HIT |
| 147 | MemoryViewModel.kt:351 | `:351 repository.getEmbeddingDimensionUsage()`，随后 update 刷新 `embeddingDimensionUsage` | HIT |
| 160 | MemoryViewModel.kt:620 | `:620 fun importDocument(title, filePath, fileContent)`，:624 用 `selectedFolderPath` 建记忆 | HIT |
| 161 | MemoryViewModel.kt:644 | `:644 repository.createMemory(..., folderPath = currentFolder)` | HIT |

## md / lint.md 修正核对

- ui-memory.md：无残留 `:166`；MemoryScreen.kt:167（调用链第 1 条）与 MemoryViewModel.kt:167（`getGraphForMemories` 调用处，均实地确认）正确。
- ui-memory.lint.md：数字已为 210，无 208 残留。

## 随机抽查 5 条（seed=112）

| # | ref | 结论 |
|---|-----|------|
| 123 | MemoryScreen.kt:282 | HIT（`toggleBoxSelectionMode`） |
| 170 | MemoryViewModel.kt:902 | HIT（`.folder_placeholder` 占位记忆） |
| 148 | MemoryViewModel.kt:397 | HIT（空串选中态=全部注释） |
| 158 | MemoryViewModel.kt:591 | HIT（Gson pretty printing） |
| 76 | MemorySearchSimulationDialog.kt:58 | HIT（`CircularProgressIndicator()`） |

5/5 命中，文件未改坏。

## 一致性

- facts 210 条 = status.json refs_valid 210
- status=review-pending，issue=112，source_commit 为完整 hash

## 结论：PASS
