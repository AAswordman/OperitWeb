---
title: ui-demo Lint 报告
module: UI / 权限与演示
sources: 1
date: 2026-10-01
---

# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 自检项

- facts.json 为顶层数组，每条仅含 `fact` / `ref` 两个键，共 158 条
- 全部 ref 为仓库根相对全路径加行号，行号逐条对照源码实地核对，断言符号在引用行 ±5 行内
- `.status.json` 的 refs_valid（158）与 facts 条数一致
- quality.json 为顶层数组，每条含 title / description / file / line / severity / confidence / evidence，共 10 条，证据均为真实代码摘录
- 正文与 facts 经禁用词扫描通过
- frontmatter 齐全：title / module / sources / date / issue
- 六节结构完整：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源

## 来源

- `review/batch-09/ui-demo.md`
- `review/batch-09/ui-demo.facts.json`
- `review/batch-09/ui-demo.quality.json`
- `review/batch-09/ui-demo.status.json`
