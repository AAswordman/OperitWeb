# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（2026-10-01 修错后重跑：critic 退回的 1 条事实错误[53]已重写（convert 存 Double 0.0 而非 fromUnit/toUnit，与 quality.json warning 口径一致，另补读取端 as? String 恒 null 伴随事实）、26 处引用错位已重锚/拆分、16 处轻微已重锚/拆分、正文 2 处 `AIService.sendMessage` 已统一为 `uiService.sendMessage`；facts 由 134 增至 156 条；单页隔离重跑，保持 0 硬失败 / 0 警告。）

（2026-10-01 复检退回 4 项微调后重跑：fact[50] ref → `JsCalculator.kt:117`（窗口 112–122 含 9 个日期函数枚举）、fact[51] → `:129`（窗口 124–134 含 6 个统计函数枚举）、fact[52] → `:143`（窗口 138–148 含 8 个 JS 特性枚举；另补上断言遗漏的"JavaScript 关键字（true/false/null/NaN）"第 8 项，按源码顺序插入）、fact[96] → `CliToolModeSupport.kt:173`（窗口 168–178 含 176 行"Use `search` first, then call `proxy`"关键句）；单页隔离重跑，保持 0 硬失败 / 0 警告。）
