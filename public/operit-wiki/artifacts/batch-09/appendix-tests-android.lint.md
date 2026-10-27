---
title: appendix-tests-android 自检报告
module: 附录
sources: 152
date: 2026-10-01
---

# Lint 自检报告（appendix-tests-android）

- 检查文件：appendix-tests-android.md（正文）
- 硬失败：0
- 警告：0
- 检查命令：python3 scripts/lint.py --src ~/workspace/Operit --dir（隔离目录，仅含本页，避免同批其他条目干扰）
- 检查项：frontmatter 齐全（title/module/sources/date/issue）、全部 file:line 引用真实存在且行号不越界、引用行 ±5 行内出现断言符号、无死链、有"来源"小节、无禁用模糊词

附加自检：

- facts.json：174 条，全部为顶层 {"fact","ref"} 结构；174 条 ref 逐条校验文件存在 + 行号不越界，0 异常；refs_valid=174 与 status.json 一致；frontmatter sources=152 为去重引用文件数
- quality.json：24 条走查（高危 0 / 警告 10 / 建议 14），全部带 file:line 与 ±5 行证据
- status.json：id=appendix-tests-android，issue=124，status=review-pending，source_repo=operit，source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb，critic 为空（待独立 critic）

自检过程中修复：1 条 lint 警告（关键符号节中 JsExecutionScriptBuilder 为文件名而非代码符号，去反引号后警告清零）。

## 来源

本报告由 writer 自检产出，数据来源为同目录下 appendix-tests-android.md、appendix-tests-android.facts.json、appendix-tests-android.quality.json、appendix-tests-android.status.json 四个文件。
