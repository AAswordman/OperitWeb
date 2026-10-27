# ui-about critic 复验报告（Day 7 / batch-09，critic2）

- 评审对象：`review/batch-09/ui-about.{md,facts.json,status.json}`
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（源码未动，无需重钉 commit）
- 评审日期：2026-10-01
- 评审方式：首轮 critic FAIL 的 4 条 facts + 4 处 md 行内引用逐条 `sed` 实地核对 ref 窗口（±5 行内见断言符号）；md 旧锚点全量残留 grep；随机 5 条其他 facts 抽查确认修复轮未改坏文件；status `refs_valid` 机器核对；lint 重跑。
- 原则：只评审，不改文件。

## 1. 修复点复验：4 条 facts 全部精确命中 ✅

| fact | 修正后 ref | 实地窗口核对 | 结论 |
|---|---|---|---|
| [71] 补丁源选择后回调 onDownload(mirrorKey) 进入 startPatchUpdateWithMirror | `AboutScreen.kt:815` | :814–816：`onDownload = { mirrorKey ->`（:815）→ `startPatchUpdateWithMirror(`（:816） | ✅ 命中 |
| [86] 下载按钮用浏览器打开 updateInfo.downloadUrl | `UpdateScreen.kt:327` | :327：`onClick = { onOpenRelease(updateInfo.downloadUrl) }` | ✅ 精确命中 |
| [83] 最新版本卡片用 primaryContainer 背景色和 4.dp 阴影 | `UpdateScreen.kt:183` | :183：`containerColor = … primaryContainer …`；:186：`defaultElevation = … 4.dp` | ✅ 命中（2 符号均在 ±5 内） |
| [114] shouldOverrideUrlLoading 返回 false，页面内链接由 WebView 自行处理 | `HelpScreen.kt:54` | :54：`override fun shouldOverrideUrlLoading(`；:59：`return false`（注释"让WebView处理所有链接"在 :58） | ✅ 命中 |

## 2. 修复点复验：md 4 处行内引用全部命中 ✅

| md 位置 | 修正后 ref | 实地窗口核对 | 结论 |
|---|---|---|---|
| md:90 §5"只有探测通过的源可点击" | `AboutScreen.kt:1647` | :1647：`val enabled = probe?.ok == true` | ✅ 精确命中 |
| md:96 §5"速度取两者最小值，延迟取两者最大值" | `AboutScreen.kt:1719` | :1719：`minOf(patchRes.bytesPerSec, metaRes.bytesPerSec)`；:1725：`maxOf(…latencyMs)` | ✅ 命中 |
| md:90 §4"禁止返回键与点击外部关闭" | `AboutScreen.kt:1147` | :1147–1149：`DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)` | ✅ 精确命中 |
| md:96 §5"选源后回调 mirrorKey 进入 startPatchUpdateWithMirror" | `AboutScreen.kt:815` | 与 fact[71] 同窗口：:815 `onDownload = { mirrorKey ->` → :816 `startPatchUpdateWithMirror(` | ✅ 命中 |

旧锚点残留检查：grep `AboutScreen.kt:1604|:1698|:1141|:1765` 在 ui-about.md 中——**无残留**。

## 3. 随机抽查 5 条（确认修复轮未改坏文件）：2 命中 / 3 为修复前既有松散锚点

| fact | ref | 核对 | 结论 |
|---|---|---|---|
| [41] handleDownload 在 Available 且 downloadUrl 以 .apk 结尾时弹出完整包更新方式选择 | `AboutScreen.kt:716` | :716 `fun handleDownload() {`；:717–718 `is UpdateStatus.Available` + `endsWith(".apk")` | ✅ 命中 |
| [50] 更新日志行点击调用 navigateToUpdateHistory() 跳转更新历史页 | `AboutScreen.kt:986` | :986 `onClick = { navigateToUpdateHistory() }` | ✅ 精确命中 |
| [6] HtmlText 通过 AndroidView 嵌入原生 TextView 渲染 HTML 字符串 | `AboutScreen.kt:107` | :107 为 `fun HtmlText(` 签名；`AndroidView(` 在 :115（8 行外），`TextView` 在 :118（11 行外） | ⚠️ 超出 ±5（修复前既有，首轮 40 抽查未抽中） |
| [19] SettingsRow 左侧为 38.dp 圆角图标块，图标底色为 iconTint 的 0.16 透明度 | `AboutScreen.kt:400` | :400 为 `private fun SettingsRow(` 签名；`size(38.dp)` 在 :417、`alpha = 0.16f` 在 :419（17–19 行外） | ⚠️ 超出 ±5（修复前既有，首轮未抽中） |
| [85] releaseUrl 非空时卡片底部显示查看 Release 与下载按钮 | `UpdateScreen.kt:320` | `releaseUrl.isNotEmpty()` 条件在 :297（23 行外）；`onOpenRelease(releaseUrl)` 在 :307（13 行外）；:320±5 内只有"查看 Release" Text（:319–322）与 downloadUrl 按钮（:325） | ⚠️ 条件符号超出 ±5（修复前既有，首轮未抽中） |

说明：3 条 ⚠️ 均非修复轮引入（修复轮只改了 §1–§2 的 8 个点），属修复前既有锚点松散。断言内容本身与代码一致（非编造），仅行号不够紧贴。建议 parent 酌情顺手收紧（[6]→:115、[19]→:417、[85]→:297），**不阻塞本轮结论**。

## 4. status.json 与 lint

- `refs_valid: 118` = facts 数 118 ✅
- lint 重跑：`ui-about.md` 本身 0 错误 0 警告；告警仅出现在 `ui-about.lint.md` 自检报告自身（frontmatter/模糊词伪影，首轮已说明），非页面问题 ✅

## 结论：PASS

首轮 FAIL 的全部 8 个修复点（4 facts + 4 md 引用）已精确命中源码窗口，旧锚点无残留，refs_valid=118 一致，lint 干净。发现 3 条修复前既有的松散锚点（[6]/[19]/[85]），内容真实、非阻塞，建议顺手收紧。
