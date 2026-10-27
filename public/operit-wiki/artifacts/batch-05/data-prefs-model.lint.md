# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（单页隔离重跑 scripts/lint.py，0 硬失败 / 0 警告；另用脚本逐条验真 181 条 facts 引用行号全部真实存在，quality.json 14 条走查 evidence 行号已核对源码原文）

## 修错后复跑（2026-10-01，critic 打回 4 处 facts 锚点错位 + 7 处轻微建议已修）

- scripts/lint.py 单页隔离重跑：硬失败 0 / 警告 0。
- 181 条 facts 引用行号程序化全量验真：文件存在、行号在范围内，0 坏引用；9 处改动 ref 逐个确认 ±5 窗口支撑原文。
- quality Q1 description 补调用方导出后警告说明；Q13 evidence 改为 EnvPreferences.kt:56-58 逐字原文（真实换行）。
- 5 文件全文 grep：禁用词与模糊词扫描干净，0 命中。
