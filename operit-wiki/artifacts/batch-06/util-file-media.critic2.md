# util-file-media 第二轮独立复验报告（critic2）

- 条目：`util-file-media`，Issue #83
- 源码：~/workspace/Operit @ `dbf71916`（HEAD 一致）
- 复验范围：修错后 `util-file-media.{md,facts.json,quality.json,lint.md,status.json}`
- 结论先行：**verdict: FAIL（1 项剩余问题，需单点修正）**

## 一、第一轮 critic 7 项打回清单复验（全部修到位）

1. **[75] HttpMultiPartDownloader.kt:312→:320**：PASS。窗口 315–325 覆盖 `sanitizeHeaderName`（含换行/冒号的头名返回 null，315–317）与 `sanitizeHeaderValue`（320–325），断言"头名含换行或冒号被丢弃、头值去掉换行符"完整支撑。
2. **[126] ImageBitmapLimiter.kt:18→:9**：PASS。窗口 4–14 覆盖 `UI_MAX_PIXELS = 12_000_000L`（:9）、`UI_MAX_DIMENSION = 4096`（:10）、`AI_MAX_PIXELS`（:12）、`AI_MAX_DIMENSION`（:13），"UI 与 AI 两套上限都是 1200 万像素、单边 4096"完整支撑。
3. **[131] MediaBase64Limiter.kt:13→:6**：PASS。:6 即 `private const val DEFAULT_MAX_DECODED_BYTES = 20 * 1024 * 1024`，"20MB"完整支撑。
4. **[147]/[148] OCRUtils.kt 拆条**：PASS。[147] :48 窗口 43–53 覆盖 `enum class Quality { LOW, HIGH }`（46–51），"分为 LOW 与 HIGH 两档"完整支撑；[148] :99 窗口 94–104 覆盖 `scaleFactor = 2.0f`（:101）、`maxDimension = 4096`（:102），"放大 2 倍（上限 4096 像素）"完整支撑。
5. **[79] SkillRepoZipPoolManager.kt:67→:76**：PASS。窗口 71–81 覆盖 `val mutex = keyMutexes.getOrPut(key) { Mutex() }`（:76）与 `mutex.withLock`，同 key 并发只执行一次的机制完整支撑。
6. **[96]/[97] ToolPkgJsAstMinifier.kt 拆条**：PASS。[96] :70 窗口覆盖 `compress { passes: 3 }`（72）、`mangle { toplevel: false }`（77）——窗口 65–75 实际覆盖到 72/77 两行（行 70 锚点 ±5 = 65–75，mangle toplevel 在 77 行超出 2 行）。注：见下文微瑕说明。[97] :76 窗口 71–81 覆盖 `format { comments: false, ascii_only: true }`（81–82），"注释全删、ascii_only 输出"完整支撑。
7. **[118] MediaPoolManager.kt:11**：PASS。窗口 6–16 覆盖 `object MediaPoolManager`（:11）、`MAX_INPUT_BYTES = 20 * 1024 * 1024`（:14），"单例对象、入池上限 20MB"完整支撑。
8. **[134] ColorQrCodeUtil.kt:555**：PASS。窗口 550–560 覆盖 `bitsPerSymbol` 的 2→1、4→2、8→3、16→4 映射，"支持 2/4/8/16 四种颜色数、每符号 1/2/3/4 比特"完整支撑。
9. **quality[13] evidence 造假已修正**：PASS。evidence 现为单行逐字原文 `        return (nonTextChars.toDouble() / totalChars) < 0.1`，与 FileUtils.kt:212 逐字节一致（8 空格缩进一致）。描述为"阈值硬编码 10% 无注释说明依据"，suggestion 评级合理。

## 二、facts 随机抽查 25 条（人工逐条核窗口）

抽查编号（seed=83）：[22][96][8][12][44][77][51][121][114][127][117][32][54][48][79][21][13][105][39][90][58][42][11][7][5]，全部窗口真实支撑断言，无虚构符号、无错文件、无越界。其中关键词启发式初筛标出的弱匹配条目已逐条人工读源码窗口，逐条成立（例如 [48] DocumentConversionUtil.kt:135 窗口内有 `Bitmap.Config.ARGB_8888` 与 `OCRUtils.Quality.HIGH`；[54] :336 窗口内有 "Now directly copy the text file to DOC" 注释与 copyTo；[21] :349 窗口内有 extractRar 签名与 junrar Archive/password 分支）。

## 三、quality 全部 15 条

- 15/15 evidence 首行在 file:line ±5 窗口内逐字命中，BAD 0。
- 5 条 high 逐条源码实锤：
  - [0]–[3] ArchiveUtil.kt:151/215/288/385：四处 `val newFile = File(targetDir, fileName)`，全文件 grep 无 `canonical` 相关校验——压缩包内 `../` 条目可写出目标目录之外，high 评级成立。
  - [4] PathMapper.kt:34：`File(ubuntuRoot, relativePath).absolutePath`，`mapLinuxPath` 全程无 `..` 处理（26–39 行仅 trimStart('/')），`../../etc` 可逃逸 proot 根，high 评级成立。
- severity 仅 high/warn/suggestion 三种取值，格式合规；warn/suggestion 分级无明显膨胀。

## 四、剩余问题（1 项，必须修）

**facts[133] 锚点窗口违规**：ref `MediaBase64Limiter.kt:41`，断言"limitBase64ForAi 先估算再真实解码，两次都超限则返回 null"。:41 的 ±5 窗口为 36–46，只覆盖估算检查（42–44 `estimated > maxDecodedBytes → return null`）；"真实解码"（`Base64.decode` 在 :48、catch 返回在 :50）与第二次大小检查（`bytes.size > maxDecodedBytes → return null` 在 :54–56）全部在窗口之外。断言为真（源码 41–58 行确认），但锚点不支撑后半断言。

修正建议（二选一）：
- 方案 A（拆条，原子化）：`limitBase64ForAi 先用 estimateDecodedSizeBytes 估算，超限返回 null`（锚 :42）；`真实解码后再检查一次大小，超限返回 null`（锚 :52）。facts 数 155→156，同步更新 status.json refs_valid。
- 方案 B（重锚）：单事实改写为"limitBase64ForAi 用 estimateDecodedSizeBytes 估算，超限返回 null"并锚 :42，删除后半断言。

## 五、status.json 与合规

- `issue=83`、`source_repo=operit`、`source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、`refs_valid=155`（= facts 数组长度）、`status=review-pending`，字段全对。
- 5 个交付文件全文禁用词（通过/批准/LGTM）：0 命中。
- facts/quality 顶层数组，格式合规。
- /tmp 隔离 lint（4 文件，不含 lint.md 自扫）：0 硬失败 / 0 警告。

## 六、verdict

**FAIL**——仅剩 facts[133] 一处锚点窗口违规（第四节）。修正后无需第三轮全量复核，parent 按第四节"修正建议"改锚或拆条后逐条核窗口即可放行。本 critic 未修改任何交付文件。
