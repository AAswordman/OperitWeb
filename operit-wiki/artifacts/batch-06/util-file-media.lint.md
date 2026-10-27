---
title: Lint 报告
module: util
sources: FileUtils.kt, ArchiveUtil.kt, OperitPaths.kt, PathMapper.kt, AssetCopyUtils.kt, AndroidUserPathUtils.kt, DocumentConversionUtil.kt, HttpMultiPartDownloader.kt, SkillRepoZipPoolManager.kt, ToolPkgArtifactMinifier.kt, ToolPkgJsAstMinifier.kt, ToolPkgWasmRuntime.kt, ImagePoolManager.kt, MediaPoolManager.kt, ImageBitmapLimiter.kt, MediaBase64Limiter.kt, ColorQrCodeUtil.kt, OCRUtils.kt, FFmpegUtil.kt
date: 2026-10-01
---

# Lint 记录 — util-file-media

- 运行时间：2026-10-01
- 命令：`scripts/lint.py --src ~/workspace/Operit --dir <隔离目录>`（5 个交付文件复制到 /tmp 隔离目录后运行）
- 结果：0 硬失败，0 警告
- 禁用词全文 grep：0 命中
- facts 引用自检：152 条 ref 逐条核对（文件存在、行号在文件范围内、±5 行窗口支撑断言），重锚 60+ 处行号偏差、拆分 3 条复合事实、修正 2 处越界行号与 1 处证据原文。

## 修错轮（2026-10-01，critic FAIL 后）

- 按 `util-file-media.critic.md` 末尾 7 项清单全部修正：facts [75] 重锚 :320、[125]→:9、[130]→:6、[79]→:76、[96] 拆成两条（ascii_only 实际在 78 行，:72 窗口够不着）、[117]→:11；[145] 拆成两条（Quality 枚举 :48 / HIGH 放大 :99）；[133] 拆成两条（generate 调用 :52 / 颜色数映射 :557）；quality [13] evidence 改为 FileUtils.kt:212 真实单行逐字原文。
- facts 152→155，`status.json` refs_valid 同步为 155。
- 修正条目 ±5 窗口逐条复验全部支撑；quality 15/15 evidence 逐字命中。
- 4 文件隔离重跑 lint：0 硬失败 / 0 警告；禁用词 0 命中；facts/quality 顶层数组；severity 仅 high/warn/suggestion。

## 来源

本页的自查记录基于源码 commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb` 下 `app/src/main/java/com/ai/assistance/operit/util/` 的 19 个种子文件，全部已全文阅读并在 `tracking/read-status.json` 登记。
