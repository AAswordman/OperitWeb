# Lint 记录（widget-provider，Issue #82）

- 运行：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-wp82f`（md/facts/quality/status 4 文件复制到 /tmp 隔离运行，避免 .lint.md 自扫）
- 结果：检查文件 1，硬失败 0 / 警告 0
- 修错后重跑（2026-10-01）：critic 打回的 3 处数字错误、35 条 facts 行号漂移、9 条 quality 行号漂移已全部修正；重跑 lint 仍为 0 硬失败 / 0 警告。
- 5 文件全文禁用词扫描：0 命中。
- 5 文件全文模糊词（可能/大概/似乎/应该/也许）扫描：0 命中。
- severity 取值检查：仅 high/warn/suggestion。
- quality 13/13 evidence 与源码逐字比对命中（含 2 处行号微调使 evidence 完整落入 ±5 窗口：[0]:265→266、[11]:223→224）。
- facts 146 条 ref 机械检查全过（文件存在、行号无越界）；修正条目 ±5 窗口逐条复验支撑断言。
- status.json refs_valid=146（facts 数无变化，无需更新）。
