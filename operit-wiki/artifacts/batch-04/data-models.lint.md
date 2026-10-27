# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 修错记录（2026-10-01，critic 退回后修错）

- 修正 2 条事实错误：[101] writeToParcel 15→17 个字段（亲手逐数 `parcel.write*` 17 次，读取侧 17 次含 2 个 helper）；[116] SerializableColorScheme 30→29 个 Long 字段（亲手逐数）。
- 修正 25 条引用错位（按 critic §1.2 对照表重锚，MnnModelDownloadManager 尾部系统性漂移）；[196] 拆成两条（HEAD :414 / 跳过 :432）；[92] 按 parent 纠正拆成两条（`fromChatHistory` 函数名 :62 / displayOrder 逻辑 :83，critic 原建议 :83 对函数名断言不合规）。
- 正文：`ChatEntity.kt:62`→2 处拆分引用（函数名 :62 / displayOrder 行为 :83）；`MnnModelDownloadManager.kt:354`→:345（2 处）；`:405` 拆成 :414/:432 两条；`:497`→:517。
- 全部改动 fact 的 ±5 窗口逐条 sed/脚本验真；TEMP_SUFFIX=".tmp" 已核实；facts 210→212 条。
- 单页隔离重跑 scripts/lint.py：0 硬失败 / 0 警告。
