---
title: ui-websession Lint 报告
module: app / 用户界面
sources: 12
date: 2026-10-01
---

# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 自检项

- facts.json 为顶层数组，每条仅含 `fact` / `ref` 两个键，共 110 条
- 全部 ref 为仓库根相对全路径加行号，逐条脚本验真（文件存在、行号合法、反引号符号落在引用行 ±5 行内），110/110 通过
- `.status.json` 的 refs_valid（110）与 facts 条数一致
- quality.json 为顶层数组，每条含 severity / category / file / line / title / detail / evidence / confidence，共 5 条，severity 仅用 warn/suggestion，file:line 全部实地核对
- 正文与 facts 经禁用词扫描通过
- frontmatter 齐全：title / module / sources / date / issue / batch
- 六节结构完整：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源

## 来源

- `review/batch-09/ui-websession.md`
- `review/batch-09/ui-websession.facts.json`
- `review/batch-09/ui-websession.quality.json`
- `review/batch-09/ui-websession.status.json`
