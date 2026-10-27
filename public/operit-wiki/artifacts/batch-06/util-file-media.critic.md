# Critic 复核报告：util-file-media（Issue #83）

- 复核对象：`review/batch-06/util-file-media.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 HEAD 一致）
- 复核方法：152 条 facts 全部机械校验（ref 格式/文件存在/行号不越界）+ 关键词启发式筛查 11 条人工逐条比对源码窗口 + 随机抽样 12 条逐条核对；quality 15 条 evidence 全部做源码逐字比对 + anchor ±5 校验；5 条 high 实锤逐条看源码确认。
- 总体 verdict：**FAIL**（7 项必须修，见文末清单）

## 一、facts.json（152 条）

机械检查：全部 PASS——ref 格式合法、152 个文件引用全部存在、行号无一越界、19 个去重文件与种子清单一致（19 文件共 5819 行，`wc -l` 总和吻合）、无复合事实（启发式 0 命中）、无虚构符号。

语义抽查结论：140 条 PASS；以下 6 条 ref 行号窗口不能完整支撑断言，FAIL：

1. **[75] FAIL** — `HttpMultiPartDownloader.kt:312`，窗口 307–317 只覆盖 `sanitizeHeaderName`（头名消毒）。fact 后半句"头值去掉换行符"对应 `sanitizeHeaderValue` 在 320–325 行，落在窗口之外。修：ref 改到 320，或拆成两条。
2. **[125] FAIL** — `ImageBitmapLimiter.kt:18`，窗口 13–23 只看到 `AI_MAX_DIMENSION = 4096`。"1200 万像素"（`UI_MAX_PIXELS`/`AI_MAX_PIXELS = 12_000_000L）定义在第 9/12 行，窗口之外。修：ref 改到 9–12 附近。
3. **[130] FAIL** — `MediaBase64Limiter.kt:13`，窗口 8–18 是 `LimitedMedia` 数据类。`DEFAULT_MAX_DECODED_BYTES = 20 * 1024 * 1024` 定义在第 6 行，窗口之外。修：ref 改到 6。
4. **[145] FAIL** — `OCRUtils.kt:99`，窗口 94–104 只支撑"放大 2 倍（上限 4096）"。fact 前半句"Quality 分 LOW 与 HIGH 两档"的枚举定义在 46–51 行，窗口之外。修：拆成两条或 ref 改到 46。
5. **[79] FAIL** — `SkillRepoZipPoolManager.kt:67`，窗口 62–72 只有函数签名。`keyMutexes.getOrPut(key) { Mutex() }` 在第 76 行，窗口之外。修：ref 改到 76。
6. **[96] FAIL** — `ToolPkgJsAstMinifier.kt:65`，窗口 60–70 只覆盖 `compress.passes: 3` 与 compress 的 `toplevel: false`。fact 中"不混淆"对应 mangle 的 `toplevel: false`（72–73 行），"注释全删/ascii_only"（76–77 行）都在窗口之外。修：ref 改到 70–72 附近或拆分。

边界项（不计入 FAIL，但建议修错时顺手重锚）：
- [133] `ColorQrCodeUtil.kt:555`：2/4/8/16→1/2/3/4 的数字映射在窗口内完全支撑；但"generate 支持"的函数绑定在 43/93 行，不在窗口内。建议 ref 指到 `generate` 或映射调用处。
- [117] `MediaPoolManager.kt:17`："单例对象"的 `object` 关键字在第 11 行，窗口 12–22 之外 1 行。建议 ref 改到 11–15。

抽样核对的 12 条（[8][12][21][22][32][44][48][54][79][96][117][127]）中，除上述 [79][96][117] 外其余 9 条逐字比对源码全部准确（VIDEO_EXTENSIONS 8 项、checkVideoSize 默认 30MB/失败返回 true、extractRar 加密写 EXTRACTION_FAILED.txt、createArchive rar 分支注释 license restrictions 等）。

## 二、quality.json（15 条）

- 14/15 条 evidence 为源码逐字原文且 anchor 落在 ±5 窗口内：PASS。
- **[13] FAIL** — `FileUtils.kt:212`（suggestion，isTextLikeBytes 10% 阈值）：evidence 把第 205 行注释 `// We can define "binary" as having more than 10% non-text characters.` 与第 211 行 `return (nonTextChars.toDouble() / totalChars) < 0.1` 拼接成连续两行，中间实际隔着 `if (nonTextChars == 0) return true`、空行与其它注释。**evidence 冒充逐字原文**，违反逐字铁律。修：evidence 只取真实连续行（205 单行或 211 单行），line 对应调整。
- 5 条 high 实锤逐条确认源码，评级合理：
  - [0][1][2][3] ArchiveUtil 四处 `File(targetDir, fileName)`（行 151/215/288/385）直接用压缩包条目名拼接；全文件 grep `canonical|normalize` 0 命中，确无路径校验 → Zip Slip 成立。
  - [4] PathMapper.kt:34 `linuxPath.trimStart('/')` 后 `File(ubuntuRoot, relativePath)`，`..` 未处理 → 路径穿越成立。
- 其余 warn/suggestion（[5] convertPdfToImage 失败写占位却 `return true` 已逐行确认、`[6]` DOC 改名、`[7]` setAllSecurityToBeRemoved、`[8]` checkVideoSize fail-open、`[9]` .part.N 残留、`[10]` keyMutexes 无界、`[11]` initialize 清缓存、`[12]` 非 png/webp/jpeg 丢弃、`[14]` FFmpeg 命令打日志）evidence 逐字命中，severity 恰当。

## 三、正文 util-file-media.md

- frontmatter（title/module/sources/date）齐全；固定结构完整（概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源）。
- "来源"列出 19 个种子文件，与 day-4.json 种子一致；正文覆盖页面问题（压缩解压、PDF/Office、音视频、路径映射、Base64 限流、二维码、OCR）。
- 正文无行内 file:line 引用（本页 writer 简报未强制要求行内引用；lint 0/0）。不计 FAIL，建议后续批次统一时再议。
- 代码走查未写入正文：符合规范。

## 四、status.json / lint / 禁用词

- `issue: 83`（整数）、`status: review-pending`、`source_commit: dbf71916…`、`refs_valid: 152`（= facts 实际条数）、`critic: ""`：全部正确。
- lint（4 文件隔离重跑）：0 硬失败 / 0 警告。
- 5 文件全文"通过/批准/LGTM"：0 命中（parent 已复验）。

## 总体 verdict：FAIL

修错员必须修的 7 项清单：

1. facts [75]：ref 重锚到 320（或拆成头名/头值两条）。
2. facts [125]：ref 重锚到 9–12（12_000_000L 定义处）。
3. facts [130]：ref 重锚到 6（DEFAULT_MAX_DECODED_BYTES 定义处）。
4. facts [145]：拆成两条（Quality 枚举 ref 46 / 预处理缩放 ref 99）或 ref 改到 46。
5. facts [79]：ref 重锚到 76（keyMutexes.getOrPut 行）。
6. facts [96]：ref 重锚到 70–72 附近（覆盖 mangle/format 配置）或拆分。
7. quality [13]：evidence 改为真实连续的源码行，禁止拼接不相邻行；line 对应调整。

建议顺手：facts [133] ref 指到 generate（43/93）或映射调用处；facts [117] ref 改到 11–15。

修完后 facts 条数如有变化，同步更新 `status.json` 的 `refs_valid`；4 文件（不含 lint.md）隔离重跑 lint 必须 0/0；全文复查禁用词 0 命中。然后派另一名独立 critic 复验。
