# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 修错后复跑记录（2026-10-01）

- 按独立 critic 报告（api-chat-enhance.critic.md §A）修正 81 条 facts 引用（54 处重锚定 + 27 处复合事实拆分），facts 126 → 168 条。
- quality.json：B-0 evidence 追加 486–492 放行段；B-1 line 959→958；B-3 line 26→25；B-4 evidence 经 diff 核实已与源码逐字一致，无需改动。
- 正文：删第 40 行"（见代码走查 high 项）"（§8 擦边）；符号表 `executeInvocations` :384→:504。
- 单页隔离重跑 `scripts/lint.py --src ~/workspace/Operit`：0 硬失败 / 0 警告。
- 未改 `.status.json`（review-pending），未动 `review-queue.json`。

## 复检退回 4 项修正记录（2026-10-01 14:0x CST）

- Fact 148（ToolExecutionManager.kt:310）拆成两条：(a) StreamXmlPlugin 切分字符流 → `:310`；(b) 按 `toolCallPattern`（321）/`toolParamPattern`（326）提取工具名与参数 → `:321`（窗口 316–326 全覆盖）。
- Fact 150（ToolExecutionManager.kt:388）拆成两条：(a) 参数校验失败直接返回失败 ToolResult → `:394`；（b) 执行异常被 `.catch` 转为 ToolResult 并通知 `toolHandler` → `:407`。
- Fact 149（ToolExecutionManager.kt:357）拆成两条：(a) 剥离 CDATA 包裹标记 → `:360`；(b) `.replace` 链还原五种 XML 转义字符 → `:374`。
- quality.json B-4：`line` 15→13（evidence 文本不动，已逐字 diff 确认与 FileBindingService.kt 13–20 行一致）。
- facts 168 → 171 条；6 个新 ref 全部用 sed 核实 ±5 窗口完全支撑断言。
- 单页隔离重跑 `scripts/lint.py`：0 硬失败 / 0 警告。
- 未改 `.status.json`（review-pending），未动 `review-queue.json`。
