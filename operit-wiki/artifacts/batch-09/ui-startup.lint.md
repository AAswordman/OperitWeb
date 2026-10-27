# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

自检说明：
- `python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09` 对 ui-startup.md：引用有效率 100%（157 条 facts 的 ref 经逐条实地重锚，md 内全部引用 ±5 行符号校验通过）。
- frontmatter 齐全（title/module/sources/date/issue），含"来源"小节。
- 全文无禁用词（可能/大概/似乎/应该/也许）。
- 种子说明：任务单原列 StartupScreen.kt / PerformanceScreen.kt 在 commit dbf71916 下不存在（全仓 find 无同名文件），实际按 tracking/shards/day-7.json 分片种子（startup/、performance/、recovery/ 三目录，共 7 文件）阅读写作。
