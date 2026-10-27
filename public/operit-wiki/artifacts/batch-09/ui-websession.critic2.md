# ui-websession 复验报告（critic2）— PASS

- 评审对象：`review/batch-09/ui-websession.*`（Issue #115），源码 ~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 首轮 critic FAIL 的修复点已全部由 parent 修正，本轮逐条 sed 实地复验。

## 修复点复验（6 条 facts + quality[1]，全部精确命中）

1. **fact[24]** `WebSessionBrowserScreen.kt:765` — 命中。`:765` 为 `about:/blob:/data:` → null 分支，非 http(s) → null 在 `:767-768`，±5 窗口内；空输入 → null 在 `:760-762`。✓
2. **fact[25]** `WebSessionBrowserScreen.kt:777` — 命中。`:776-780` 为 portPart 的 when 分支：http 80 / https 443 → ""。✓
3. **fact[27]** `WebSessionTopUrlBar.kt:152` — 命中。`:152` = `keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go)`，`:153-157` onGo → onSubmitUrl。✓
4. **fact[28]** `WebSessionTopUrlBar.kt:181` — 命中。`:181` = `.clickable(onClick = onStartEditing)`。✓
5. **fact[30]** `WebSessionTopUrlBar.kt:189` — 命中。`:189-192` 为 `if (url.startsWith("https://")) Icons.Filled.Lock else Icons.Filled.Language`。✓
6. **fact[75]** `WebSessionDownloadSheet.kt:131` — 命中。`:131` = `highlighted = item.status == "downloading" || item.status == "connecting"`。✓
7. **quality[1]** line 152 — 命中。地址栏 keyboardOptions 只设 imeAction=Go、未设 keyboardType，与 detail 断言一致；evidence 为同一输入框。✓

## 随机抽查 5 条（seed=115，全部命中）

- **[41]** `:103` — 命中：`currentTabNumber > 0` 用 `web_session_tabs_with_index` 带序号，否则 `web_session_tabs`。✓
- **[29]** `:164` — 命中：右侧箭头 IconButton `onClick = onSubmitUrl`。✓
- **[105]** `:74` — 命中（核心断言）：`externalOpenPrompt != null` → 展开 Surface 确认卡片。✓
- **[14]** `:351` — 命中：注释原文 "WebSession lives in an overlay window, so using ModalBottomSheet would create a dialog window that does not have a valid activity token here." ✓
- **[73]** `:212` — 命中：`onDeleteDownload(item.id, false)` 仅删记录（连文件删传 true 逻辑在相邻行）。✓

## 一致性

- facts 110 条 = status.json `refs_valid` 110；status=review-pending；issue=115；source_commit 为完整 hash。✓

## 非阻塞建议（不影响 PASS）

- fact[105] 的"含取消与仅允许一次"按钮证据在 `:132/:135`，距锚点 `:74` 达 58 行（±5 口径偏松）。断言为真，可后续把"按钮"部分拆成独立 fact 并锚到 `:132`。

## 结论：PASS
