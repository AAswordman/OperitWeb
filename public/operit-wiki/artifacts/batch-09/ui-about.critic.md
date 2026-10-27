# ui-about critic 评审报告（Day 7 / batch-09）

- 评审对象：`review/batch-09/ui-about.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 评审日期：2026-10-01
- 评审方式：随机抽查 40 条 facts（seed 42 随机 35 条 + 首尾 5 条），逐条 `sed` 实地核对 ref 文件存在、行号 ±5 行内符号与断言一致；quality 7 条逐条核 file:line 与 evidence；正文 71 个行内引用抽验实质断言；status/lint 机器核对。

## 1. facts 抽查：40 条，命中 36 / 错位 4（错位率 10%）

错位明细（必须修复）：

| fact | 原 ref | 正确 ref | 修正说明 |
|---|---|---|---|
| [71] 补丁源选择后回调 onDownload(mirrorKey) 进入 startPatchUpdateWithMirror | `AboutScreen.kt:1765` | `AboutScreen.kt:815` | :1765 是内部 MirrorSourceRow 组合函数；真正的 `onDownload = { mirrorKey -> … startPatchUpdateWithMirror(…` 在 :814–816 |
| [86] 下载按钮用浏览器打开 updateInfo.downloadUrl | `UpdateScreen.kt:317` | `UpdateScreen.kt:327` | :317 是按钮内部 Text 样式行；`onClick = { onOpenRelease(updateInfo.downloadUrl) }` 在 :327（原 ref 超出 ±5） |
| [83] 最新版本卡片用 primaryContainer 背景色和 4.dp 阴影 | `UpdateScreen.kt:191` | `UpdateScreen.kt:183` | primaryContainer 在 :183、4.dp 在 :186；:191 已是 Column 内容区（超出 ±5） |
| [114] shouldOverrideUrlLoading 返回 false，页面内链接由 WebView 自行处理 | `HelpScreen.kt:66` | `HelpScreen.kt:54` | :66 是 DisposableEffect 请求焦点代码；`shouldOverrideUrlLoading … return false` 在 :54–59（与 fact[115] 的锚点撞车，疑似复制粘贴错误） |

其余 36 条全部命中，抽查断言与代码一致（含 pickBestMirrorKey 速度/延迟选择逻辑、PatchUpdatePhase 7 阶段、FullUpdatePhase 3 阶段、REPO_OWNER="AAswordman"/REPO_NAME="Operit"、69 个开源库条目"约 70 个"等）。

全体 118 条 facts：ref 全部为 `app/src/` 开头的仓库根相对全路径、全部带行号、全部文件存在。

## 2. 正文行内引用：另有 3 处错位 + 1 处轻微错位（必须修复）

| 位置 | 原 ref | 正确 ref | 说明 |
|---|---|---|---|
| §5"只有探测通过的源可点击" | `AboutScreen.kt:1604` | `AboutScreen.kt:1647` | :1604 是文本样式行；`val enabled = probe?.ok == true` 在 :1647 |
| §5"速度取两者最小值，延迟取两者最大值" | `AboutScreen.kt:1698` | `AboutScreen.kt:1719` | minOf/maxOf 逻辑在 :1719/:1726；:1698 只是对话框签名附近 |
| §4"禁止返回键与点击外部关闭" | `AboutScreen.kt:1141` | `AboutScreen.kt:1147` | DialogProperties 在 :1147（6 行偏差，轻微） |

措辞问题（建议顺手改）：§4 "reduceFullUpdateState：只有 StageChanged 与 DownloadProgress 两种事件（`...UpdateScreen.kt` 外，实际位于 `...AboutScreen.kt:228`）"——括号内文字混乱，应删掉或改写为"位于 AboutScreen.kt:228"。

其余抽验的正文引用（:716 handleDownload、:769/:1339 FullUpdateMethodDialog、:1500 DownloadSourceDialog、:1680 PatchDownloadSourceDialog、:1138 PatchUpdateProgressDialog、:1044 UpdateDialog、:135 mapPatchStage、:146 reducePatchUpdateState、:228 reduceFullUpdateState、:107 HtmlText、:1532 IO 并发探测、:171 5行/200字符折叠、:320 双按钮、:943 betaPlan、:472 getInstance、:480 observeForever、:512 自动弹窗、:908 18.dp 进度条、:926 点击分流等）全部命中。

## 3. quality.json 核查：7 条全部真实，severity 合理

- [0] warn/correctness `UpdateViewModel.kt:63`：requireNotNull(published_at) 在 onSuccess 回调内抛异常会杀死协程、UI 永久 Loading——真实，warn 合理。
- [1] warn/security `AboutScreen.kt:722`：updateUrl（更新元数据下发）未经校验直接 ACTION_VIEW 打开——真实，warn 合理。
- [2] suggestion `AboutScreen.kt:717`：else 分支 updateUrl 为空时 startActivity 可能异常——真实（锚点 :717 是 if 行，实际 startActivity 在 :726，属轻微锚点偏，但 quality 不按 critic 口径打分）。
- [3] suggestion `AboutScreen.kt:1083`：newVersion 含 "+" 隐藏 releaseNotes——真实（设计观察，suggestion 恰当）。
- [4] suggestion `HelpScreen.kt:50`：onReceivedError 只关遮罩、无错误提示与重试——真实。
- [5] suggestion `HelpScreen.kt:27`：helpUrl 硬编码——真实。
- [6] suggestion `AboutScreen.kt:512`：UpToDate 也自动弹窗——真实。

格式备注：quality.json 用 `description` 字段而 SCHEMA §8 写的是 `detail`，severity 用 `warn` 而非 `warning`——历史批次口径本就混杂，lint 自检项 7 按现有字段通过；建议后续统一口径，不阻塞本页。

## 4. md 结构（§9）：合规

- frontmatter 齐全（title/module/sources=6/date/issue=119）。
- 六节齐全：概述 / AI 速览（符号清单+主入口+数据流一句话）/ 核心机制（7 小节）/ 关键符号（22 行表）/ 调用链（3 条输入→处理→输出编号链）/ 来源（6 seed 文件 + 行数 + 关联数据层标注非种子）。
- 人话到位（"门面信息页""版本编年史"等比喻准确），术语首现基本有解释，无禁用词（正文 0 命中）。
- 无编造：除上述锚点错位外，所有断言均有代码支撑；种子缺失的 4 个文件（LoginScreen/FeedbackScreen/ChangelogScreen/PrivacyScreen）已在范围说明中如实声明经 git ls-tree 查无，而非编造内容。

## 5. status.json：合规

- `refs_valid: 118` = facts 数 118 ✓
- `status: review-pending` ✓
- `issue: 119` ✓
- `source_repo: operit`、`source_commit` 为完整 hash `dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✓

## 6. lint

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`：`ui-about.md` 本身 0 错误 0 警告。
`ui-about.lint.md` 上的警告（缺 frontmatter/来源节/含禁用词字样）是 lint 把自检报告文件本身也扫了一遍的伪影——报告正文逐字列出了禁用词表，非页面问题，不计。

## 结论：FAIL（需修改）

必须修复清单：
1. facts.json 4 条锚点错位：[71]→:815、[86]→:327、[83]→:183、[114]→:54（见上表）。
2. ui-about.md 3 处行内引用错位：:1604→:1647、:1698→:1719、:1141→:1147（见上表）。
3. 建议顺手改 §4 括号内混乱措辞（非阻塞）。

修复后走独立复验（重抽错位点 + 随机 10 条）即可转 PASS。quality 7 条真实可用，无需改动。
