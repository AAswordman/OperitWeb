---
title: ui-tokenstats 自检报告
module: UI / 统计
sources: 9
date: 2026-10-01
issue: 113
---

# ui-tokenstats 自检报告（lint.md）

- 条目 ui-tokenstats，Issue 113；源码 Operit @ dbf71916。
- 阅读覆盖：tokenstats 目录 9 个 Kotlin 文件、约 4,700 行，逐行读完。

## 机械校验

- ui-tokenstats.facts.json：181 条 facts，脚本逐条验真：ref 文件存在、行号合法、±5 行窗口内出现事实主语符号名。
- ui-tokenstats.md：按 lint.py 口径复刻校验（ref 所在整行每个反引号符号在源码 ±5 行内），73 个引用，0 警告。
- frontmatter 四键齐全；含"来源"小节，列出 9 个种子文件。

## 本轮迭代修复

1. 正文初版长段落触发 120 条符号检查警告，按"一行一断言"重写正文后清零。
2. TokenStatsSegmentedControl 行号误记 229，实为 216；TokenStatsDateRangeDialog 误记 105，实为 68；正文与 facts.json 同步修正。
3. "日期范围弹窗最大宽度 360.dp"事实 ref 精确到 widthIn 行 105。
4. TokenActivitySection.kt 130 行断言符号误写 mode，实为 when (state.viewMode)，改为 viewMode。

## 代码走查结论

见 ui-tokenstats.quality.json：5 条，severity 全为 suggestion，无 high：

1. 折线图与面积图在无样本桶判断处每帧为每个标签 new Paint，高频分配，低端机下存在掉帧风险。
2. actionMessage 单值覆盖：连续两次操作时第二条消息吞掉第一条。
3. 汇率编辑行无上限：极大值转 Infinity 后显示异常。
4. 趋势汇总可点击但无无障碍语义。

## 结论

- 硬失败：0
- 警告：0

## 来源

- app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/
