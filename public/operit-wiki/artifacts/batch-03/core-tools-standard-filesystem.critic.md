# Critic 复核报告：core-tools-standard-filesystem（标准工具·文件系统）

- 复核对象：`review/batch-03/core-tools-standard-filesystem.{facts.json,md,quality.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 HEAD 一致）
- 复核方式：脚本全量验证 44 条 facts（文件存在 / 行号在界内 / ±5 行窗口关键字命中），未通过的 14 条逐条人工查源码定性；正文抽查 md-only 引用；走查 8 条逐条核对证据原文
- 结论：**事实 0 条造假，但 8 条引用行号错位，必须退回修正**；正文无超出 facts 的断言；走查证据全部属实

## 一、facts 逐条结论

- 通过：36 / 44（含 2 条段落锚点引用，见备注）
- **引用错位需修正：8 / 44**
- 事实错误：0

### 必须修正的 8 条（事实为真，引用行号超出 ±5 窗口）

1. **[16] fact 17** — ref `StandardFileSystemTools.kt:2065`
   - 事实原文："所有工具入口先过 PathValidator，再按环境分发到 linuxTools / safTools / 本机实现"
   - 问题：`:2065` 窗口内只有环境分发（`isLinuxEnvironment/isSafEnvironment`），`PathValidator.validateAndroidPath(path, tool.name)?.let { return it }` 实际在 **:2072**，超出窗口 7 行
   - 修正：ref 改为 `:2072`

2. **[26] fact 27** — ref `StandardFileSystemTools.kt:2314`
   - 事实原文："move_file 先尝试 sourceFile.renameTo(destFile)，失败则回退 copy+delete（跨文件系统场景），整个移动非原子"
   - 问题：`:2314` 窗口内只有 `renameTo` 成功分支；回退注释 `// If simple rename fails, try copy and delete (could be across` 在 **:2329**，copy/delete 实现在 :2334
   - 修正：ref 改为 `:2329`

3. **[27] fact 28** — ref `StandardFileSystemTools.kt:2059`
   - 事实原文："delete_file 支持 recursive 参数（默认 false），无二次确认、无回收站，直接 delete / deleteRecursively"
   - 问题：`:2059` 窗口内只有 recursive 参数解析；真正的 `file.deleteRecursively()` 在 **:2113**（`if (recursive)` 分支内 :2111–2113）
   - 修正：ref 改为 `:2111`

4. **[30] fact 31** — ref `StandardFileSystemTools.kt:3733`
   - 事实原文："unzip_files 有 ZipSlip 防护：解压条目的 canonicalPath 必须以目标目录 canonicalPath 开头，否则抛 SecurityException"
   - 问题：`:3733` 窗口内只有 `destDirCanonical` 准备代码；`throw SecurityException("Zip entry is outside of the target dir: ...")` 在 **:3745**
   - 修正：ref 改为 `:3745`

5. **[32] fact 33** — ref `StandardFileSystemTools.kt:4544`
   - 事实原文："open_file 经 FileProvider.getUriForFile 取 content Uri，再发 ACTION_VIEW Intent 调外部应用打开"
   - 问题：`FileProvider.getUriForFile` 在窗口内，但 `Intent(Intent.ACTION_VIEW)` 在 **:4550**，超出窗口 6 行，"再发 ACTION_VIEW" 一半断言无引用支撑
   - 修正：ref 改为 `:4550`

6. **[33] fact 34** — ref `StandardFileSystemTools.kt:4808`
   - 事实原文："share_file 经 FileProvider 取 Uri，再发 ACTION_SEND Intent 调系统分享"
   - 问题：同上，`Intent(Intent.ACTION_SEND)` 在 **:4814**，超出窗口 6 行
   - 修正：ref 改为 `:4814`

7. **[40] fact 41** — ref `SafFileSystemTools.kt:1486`
   - 事实原文："SAF 的 grep_code 直接返回错误，由 StandardFileSystemTools 的 find_files + read_file_full 组合接管；grep_context 在 SAF 也不支持"
   - 问题：`:1486` 只支撑前半句（`grepCode` 返回 "handled by StandardFileSystemTools (find_files + read_file_full)"）；后半句 "grep_context 在 SAF 也不支持" 的依据在 `StandardFileSystemTools.kt:4681`（`error = "grep_context is not supported for SAF/repo environment"`），单 ref 覆盖不了双断言
   - 修正：拆成两条 facts，或 ref 改为 `:4681` 并调整表述（grep_code 部分已由 :1486 支撑，建议拆分）

8. **[41] fact 42** — ref `SafFileSystemTools.kt:561`
   - 事实原文："SAF 的 move 用 copyFile 复制成功后再删除源（content Uri 走 deleteRecursive），两步实现"
   - 问题：`:561` 窗口内只有 `copyFile` 调用；"成功后再删除源" 的 `deleteRecursive(sourceUri)` 在 **:574**（`when { sourceIsContent -> ... }`），超出窗口 13 行
   - 修正：ref 改为 `:574`

### 备注（通过，但有说明）

- **[1] fact 2 / [2] fact 3**（ref `ToolRegistration.kt:1775`）：24 工具名清单与"混入 click_element/tap/http_request/multipart_request"的断言，已用脚本验证 24 个 `name = "<tool>"` 全部落在 1775–2258，且 `click_element`(:1904)、`tap`(:1935)、`http_request`(:1967)、`multipart_request`(:1989) 确实在该段内注册——**事实为真**。ref 是段落起点锚点，fact 文本已注明范围（1775–2258），按范围断言惯例予以通过。
- **[15] fact 16**（ref `PathValidator.kt:45`）：`validateLinuxPath` 声明在 :33，:45 落在函数体内，窗口 :40–50 可见 `if (!path.startsWith("/") && !path.startsWith("~"))` ——断言依据充分，通过。
- **[36] fact 37**（ref `StandardFileSystemTools.kt:626`）：`for (round in 1..3)` 在 :626 ✓；每轮 `ToolProgressBus.update`（如 "Searching (round $round/3)"）属实。轻微标注：实际循环位于 `grepContextAgentic`（:599），`symbol` 字段写 `grepContext`（:4670 为入口）不够精确，建议 symbol 改为 `grepContextAgentic`。
- **[37] fact 38 / [43] fact 44**：源码为 `BUFFER_SIZE = 10 * 1024 * 1024` / `32_000`（下划线数字分隔符），数值与事实一致，通过（系校验脚本大小写/字面匹配过严，非事实问题）。

## 二、正文核查（.md）

- `## AI 速览` 齐全：核心符号清单 ✓、主入口 ✓、数据流向一句话 ✓，另有环境速查与高风险操作提示。
- 正文断言均有 facts 对应，未发现超出 facts 的说法；抽查的 md-only 引用全部属实：
  - `type` 非法值报错 `StandardFileSystemTools.kt:4155`（"Unsupported type ... expected replace | delete | create"）✓
  - 调用链示例 `readFile` 入口 `:1566` ✓；`download_file` 为注册段最后一个（:2257–2258）✓
  - `sshFileManager` 字段名（:102）、`typeParam`（:3873）/`startLineParam`（:1685）局部变量名与源码一致 ✓
- 跨页 wikilink 目标均为 v3 id（core-tools / core-tools-registry / core-tools-standard-webchat / core-tools-standard-system / core-tools-execmodes），无死链写法。

## 三、走查核查（quality.json，8 条）

8 条证据逐条核对源码原文，**全部属实**，无编造：

| # | 标题 | 证据行 | 核验 |
|---|---|---|---|
| 0 | PathValidator 无路径穿越防护 | PathValidator.kt:20 | 证据文本逐字匹配 :17–25；`line` 锚点 :20 落在证据块内但为块中部，建议改为 :17（轻微） |
| 1 | delete_file 无二次确认无回收站 | StandardFileSystemTools.kt:2061 | `recursive` 参数解析 ✓，`deleteRecursively` 在 :2113 ✓ |
| 2 | download_file 仅 scheme 校验（SSRF） | :4395 | `if (!resolvedUrl.startsWith("http://") && ...)` ✓ |
| 3 | open/share 数据外泄面 | :4544 | `FileProvider.getUriForFile` ✓（ACTION_VIEW 在 :4550，见 facts 修正项 5） |
| 4 | SAF guessPermissions 写死 | SafFileSystemTools.kt:1045 | `return "r--r--r--"` ✓ |
| 5 | move_file 回退非原子 | :2314 | `renameTo` ✓，回退注释 :2329 ✓ |
| 6 | write_file 默认覆写 | :1809 | `?: false` ✓（注册侧 ToolRegistration.kt:4207 为传参处，已在 writer 自检中澄清） |
| 7 | SAF 抛异常而非返回失败结果 | SafFileSystemTools.kt:179 | `throw IllegalArgumentException("Unsupported file extension for SAF create: ...")` ✓；"通知钩子后重新抛出"已核 AIToolHandler.kt:410–412（`notifyToolExecutionError(tool, e); throw e`）✓ |

## 四、退回修正清单（writer 必做）

1. 修正上述 8 条 facts 的 `ref` 行号（逐条目标行号已给出）。
2. [36] fact 37 的 `symbol` 改为 `grepContextAgentic`（或补充说明）。
3. quality.json 第 0 条 `line` 由 20 改为 17（证据块起始行）。
4. 修正后重新跑 lint（引用行变更不影响 lint，但需确认 JSON 仍可解析）。

修正完成后本 critic 可直接复验，无需重走全文。

## 修正记录（2026-10-01）
- 8 处引用行号已修正（idx16→:2072、idx26→:2329、idx27→:2111、idx30→:3745、idx32→:4550、idx33→:4814、idx41→:574），修正前已用脚本逐条验真新行号。
- idx40 拆成两条：grep_code 部分保留 SafFileSystemTools.kt:1486；grep_context SAF 不支持部分 ref 改为 StandardFileSystemTools.kt:4681。
- 次要项：idx36 symbol 改为 grepContextAgentic；quality.json Q0 line 20→17。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
