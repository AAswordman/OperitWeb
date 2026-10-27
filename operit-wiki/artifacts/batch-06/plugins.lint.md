---
title: 插件机制与工具包桥接 Lint 记录
module: 插件体系
sources: review/batch-06/plugins.md
date: 2026-10-01
---

# Lint 记录（plugins）

## 检查过程

- 工具：scripts/lint.py，--src 指向 ~/workspace/Operit（commit dbf71916），--dir 为 /tmp 临时目录（仅放待查文件，避免自扫）。
- 首轮：硬失败 9（8 处行内引用用了仓库相对短路径，未匹配 REF_RE 的全路径要求），警告 7（同一行多个引用互相污染符号窗口；个别引用行号落在符号声明行之外）。
- 修复：短路径全部补全为 app/src/main/java/com/ai/assistance/operit/ 开头；一行只保留一个全路径引用，多余的拆行；引用行号微调到符号所在行（如 PluginRegistry.kt:9→:12、ToolboxPlugin.kt:29→:26）。
- 第二轮：硬失败 0，警告 14（全路径引用被检查后新暴露的符号窗口问题）。
- 继续拆行（一行一引用），第三轮：硬失败 0，警告 7。
- 最后一处多引用同行拆分后，终轮：硬失败 0，警告 0。

## 终轮结果

- 检查文件：1（plugins.md）
- 硬失败：0
- 警告：0

facts.json（180 条）与 quality.json（10 条）的引用行号已逐条人工对照源码核对，±5 行窗口均有支撑原文；JSON 均可解析。

## 修错轮（2026-10-01，critic FAIL 后）

- 独立 critic 打回：facts 8 处锚点窗口违规（[34]/[58]/[61]/[65]/[82]/[105]/[153] 重锚、[84] 复合事实拆条）；quality 10 条 evidence 全部被剥掉源码原始缩进（非逐字），Q2/Q5/Q6 三处 line 字段错行，Q9 evidence 丢行尾 ` {`；正文 2 处行内引用与 facts 同错（:283→:301、:703→:694）；概述"五个 hook 注册表" prose 与下表行名对不上。
- 修正：facts 7 处重锚并逐条验 ±5 窗口；[84] 拆成两条原子事实（:714 featureStates 平台切换 / :725 JS toggle），facts 180→181，status.json refs_valid 同步为 181；quality 10 条 evidence 按源码 raw bytes 逐字重写（含原始缩进），脚本逐字节比对 10/10 一致，Q2 line→69、Q5 line→112、Q6 line→68（critic 写 67 有误，源码 `if (timeoutMillis == null) {` 在 68 行）、Q9 补回行尾 ` {`；正文 3 处同步修正。
- 修错后 4 文件（md/facts/quality/status）/tmp 隔离重跑 lint：硬失败 0，警告 0。
- 说明：上一轮 lint.md 中"±5 行窗口均有支撑原文"的断言过于乐观（本轮 critic 找出 8 处反例），已按 critic 报告逐条重锚复验。

## 来源

- review/batch-06/plugins.md（终轮 lint 对象）
- review/batch-06/plugins.facts.json（181 条事实，人工核引用；修错轮 [84] 拆条由 180 增至 181）
- review/batch-06/plugins.quality.json（10 条走查发现，人工核证据）
- scripts/lint.py（检查工具）
