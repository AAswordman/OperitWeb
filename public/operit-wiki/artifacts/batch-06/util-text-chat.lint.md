---
title: util-text-chat lint 记录
module: app
sources: scripts/lint.py
date: 2026-10-01
---

# Lint 报告

- 检查文件：2（util-text-chat.md、util-text-chat.lint.md）
- 硬失败：0
- 警告：0

## 过程

1. 5 个交付文件复制到 /tmp/util-text-chat-isolated 隔离运行 `scripts/lint.py --src ~/workspace/Operit --dir /tmp/util-text-chat-isolated`。
2. 首轮：硬失败 3（正文两处 Markdown 链接语法被判死链）、警告 335（多符号同行超出引用 ±5 行窗口）。
3. 修复：改写正文为"一行一符号"格式、去掉链接语法、修正 6 处引用行号（getNodeDescription 107、simplifyNode 141 等）。
4. 终轮：硬失败 0 / 警告 0。

## 来源

- `scripts/lint.py`（引用真实性 / frontmatter / 死链 / 来源小节 / 模糊词检查）
- 5 文件全文禁用词扫描（评审触发词）：0 命中

## 修错轮（2026-10-01）
- 按 critic.md 第七节 26 项清单修正：20 处 facts 重锚（§A 对照表）+ 4 处数字断言重锚（:23/:36/:128/:147）+ facts[186] 拆两条（plus(String):24 / plus(Char):37）。
- facts[80] 实测 `closed` 在 :19 而非 critic 表的 :18，锚点定为 :14（窗口 9–19 覆盖全部字段）。
- 正文数字断言行拆成"符号声明行（:24/:119/:138）+ 数字断言行（:36/:128/:147）"，兼顾 lint 符号归属检查。
- facts 191→192，status.json refs_valid=192。
- 4 文件 /tmp 隔离重跑 lint：硬失败 0 / 警告 0；5 文件禁用词 0 命中。
