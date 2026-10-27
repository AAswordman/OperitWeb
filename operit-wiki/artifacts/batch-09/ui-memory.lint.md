---
title: ui-memory 自检报告
module: UI / 记忆
sources: 12
date: 2026-10-01
issue: 112
---

# ui-memory 自检报告（writer 自检）

- 种子目录 12 个 Kotlin 文件全部通读（约 5,150 行），无遗漏。
- facts.json：210 条，全部经脚本逐条验真（ref 文件存在、行号在界、断言中的反引号符号全部落在引用行 ±5 行窗口内），失败 0。
- quality.json：8 条走查（高危 1 / 警告 2 / 建议 5），每条带 file:line 与 ±5 行证据。
- status.json：refs_valid = 210，与 facts 数一致；source_commit 为完整 hash。
- 模糊词扫描（SCHEMA 指定的 5 个）：0 命中。
- 一行一引用纪律：每行断言只有一个 `*.kt:N` 引用，反引号符号全部落在该引用 ±5 行内。
- 待 scripts/lint.py 机器复核。

## 来源

- 自检对象：`review/batch-09/ui-memory.*` 5 个文件
- 校验脚本：`scripts/lint.py`
