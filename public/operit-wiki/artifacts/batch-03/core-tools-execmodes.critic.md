# Critic 复核报告：core-tools-execmodes（工具执行模式）

- 复核人：独立 critic（与 writer 无关）
- 源码版本：Operit @ `dbf71916`（v1.12.2）
- 复核日期：2026-10-01
- 方法：脚本全量核验 80 条 facts（引用文件存在性、行号越界、±5 行窗口断言依据），失败项逐条人工读源码判定；md 全文逐段核对；quality.json 8 条证据逐条核源码。

## 结论：退回修正（1 条事实引用违规 + 2 处同源行号笔误）

- facts：80 条中 **79 通过 / 1 失败**
- quality.json：8 条走查断言全部属实，但其中 1 条的证据行号指针与失败事实同源，需同步修正
- md 正文：断言与 facts/源码一致，无超出、无矛盾；`## AI 速览` 齐全（核心符号清单、主入口、数据流向一句话均有）

---

## 必须修正（硬失败）

### F1 — facts #63：引用行号指向了错误的函数

- 事实原文：「Debugger 的 clickElementWithUiautomator 用 XmlPullParser 逐节点匹配 resourceId/class/contentDesc，支持短 id（:id/ 后缀）与 partialMatch。」
- 当前引用：`app/.../debugger/DebuggerUITools.kt:724`，symbol `clickElementWithUiautomator`
- 问题：第 724 行是另一个函数 `simplifyLayoutFromXml` 的函数体（XmlPullParserFactory 初始化），与 `clickElementWithUiautomator` 相隔 367 行。±5 行窗口（719–729）内看不到 partialMatch、`:id/` 后缀匹配等任何断言依据，违反"file:line ±5 行内看到断言依据"的引用铁律。
- 断言本身为真：真正的匹配代码在 `clickElementWithUiautomator` 内——
  - 第 1142 行：`// 用XmlPullParser逐节点匹配，避免正则跨节点匹配的问题`（XmlPullParser 逐节点匹配）
  - 第 1098 行：`partialMatch` 参数读取；第 1162–1175 行：`partialMatch` 分支与 `actualId.endsWith(":id/$resourceId")` 短 id 匹配
- 修正建议：把该 fact 拆成两条——
  - 「clickElementWithUiautomator 用 XmlPullParser 逐节点匹配（避免正则跨节点匹配）」→ ref `:1142`
  - 「支持短 id（`:id/` 后缀）与 partialMatch 参数」→ ref `:1162`

### F2 — md 正文同源笔误（同一位置）

- md「UI 三层差异」段：「Debugger 的元素定位用 `XmlPullParser` 逐节点匹配 resource-id/class/content-desc，支持短 id 与 partialMatch。`.../DebuggerUITools.kt:724`」
- 与 F1 同因，第 724 行不是该函数的证据。同步改为 `:1142`（或按 F1 拆分后分别引用）。

### F3 — quality.json Q2 证据行号同源笔误

- Q2（RootUITools 正则匹配）detail 末尾写道：「Debugger 版 clickElementWithUiautomator 已改用 XmlPullParser 逐节点解析（第 724 行起）」
- 断言为真（Debugger 确实用 XmlPullParser），但行号指针同样错指 `simplifyLayoutFromXml`，应为「第 1142 行起」。

---

## 次要建议（非硬失败，可顺手修）

1. facts #4/#5/#6 的 ref（`:47`/`:63`/`:79`）实际函数起始行是 45/61/77（`getUITools`/`getSystemOperationTools`/`getDeviceInfoToolExecutor`），各差 2 行；断言内容无误。
2. facts #36（moveFile 双重校验「第 1315 行与 1321 行」）实际在 1313–1314 行与 1320 行；断言内容无误（确为两次 `validateAndroidPath(destPath, …)`）。
3. facts #40（zip-slip 防护，ref `:2499`）：窗口内可见 `canonicalPath` 校验（2499–2501），属实；但「拒绝以 `/` 开头、含 `..` 或 `\` 的 entry」的直接证据在第 2491 行（距引用 8 行，略超 ±5）。建议 ref 改为 `:2491` 或拆成两条。
4. md「核心机制」段「`getUITools` / `getSystemOperationTools` / `getDeviceInfoToolExecutor` 是同样的五路分发（第 47、63、79 行起）」——实际为 45、61、77 行起。

---

## 已验证通过的要点（抽样实录）

- 全量脚本：80 条引用文件全部存在、无行号越界；除 #63 外其余 79 条的 ±5 行窗口内均可见断言依据（writer 引用的是"证据行"而非函数声明行，符合引用铁律）。
- 走查 8 条逐条核源码属实：
  - Q0（高危，shell 单引号未转义）：`ls -la '$normalizedPath'`（:121）、`shQuote` 定义确在第 71 行且仅少数处使用；
  - Q1（高危，系统操作拼接无引号）：`pm install -r $apkPath`（:171）、`settings put $namespace $setting $value`（:45）原文确认；
  - Q2（Root 正则匹配）：`val nodeRegex = "<node[^>]*?$attributes[^>]*?>".toRegex()`（RootUITools.kt:587）原文确认；
  - Q3（Root"无回退"声明与截图继承矛盾）：RootUITools 未重写任何 `captureScreenshot*`，继承的 Debugger 实现在 shell 失败后调 `super.captureScreenshotToFile`（:521 附近 `falling back to accessibility`），与类文档 "operates without accessibility fallbacks"（:25）矛盾——属实；
  - Q4（moveFile 对 destPath 双重校验）：:1313 与 :1320 两次 `validateAndroidPath(destPath, …)` 原文确认；
  - Q5（shareFile 暂存不删）：shareFile 函数体（2716–2855）内无任何删除 stagedFile 的代码——属实；
  - Q6（无障碍 endsWith 宽松匹配）：:268 `!actualId.endsWith(resourceId)` 原文确认；
  - Q7（PathValidator 无规范化）：:17 仅 `startsWith("/")`、:42 仅 `/`/`~` 检查——属实。
- 数量型断言抽验：4 getter × 5 级分发（ROOT/ADMIN/DEBUGGER/ACCESSIBILITY/STANDARD + null 回退）✓；`MAX_RETRY_COUNT=3`/`RETRY_DELAY_MS=300L` ✓；无障碍 pressKey 6 个键 ✓；`duration` 默认 300 ✓；base64 阈值 32768/分块 16384 ✓；9 个纯继承空壳类（admin×4、root×3、accessibility×3 的非 UI/非 Debugger 类）`override`/`fun` 计数为 0 ✓。
- md 正文：`## AI 速览` 含核心符号清单、主入口、数据流向一句话；调用链为编号"输入→处理→输出"式；跨页 wikilink 指向 batch-02 已批准页与兄弟页；`## 来源` 列出 18 个种子文件。

## 退回动作

writer 需修正 F1–F3（改 facts.json #63 的 ref、md 对应行引用、quality.json Q2 证据行号），建议顺手处理 4 条次要建议；修正后本 critic 结论转为通过。`.status.json` 未动，仍为 `review-pending`。

## 修正记录（2026-10-01）
- idx63 拆成两条：XmlPullParser 逐节点匹配→DebuggerUITools.kt:1142；短 id（:id/ 后缀）与 partialMatch→:1162。修正前已用脚本逐条验真新行号。
- 正文同源笔误同步修正（:724→:1142，并拆成两行对应两条 facts）；quality.json Q2「第 724 行起」→「第 1142 行起」。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
