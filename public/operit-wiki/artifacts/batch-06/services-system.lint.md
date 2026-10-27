# services-system lint 记录

- 运行：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-services-system`（仅复制 services-system.md 做隔离检查，避免 .lint.md 自扫误报）
- 结果：0 硬失败，0 警告
- facts.json：顶层数组，127 条，每条单一断言，ref 行号 ±5 窗口已逐条人工核验（含 15 处错位修正）
- quality.json：顶层数组，11 条，severity 仅 warn/suggestion，evidence 为源码逐字原文且已逐条核对
- 正文引用：行内 `path:line`，无死链；禁用词全文 0 命中
- 日期：2026-10-01

## 修错轮（critic FAIL → 修错员，2026-10-01）

- 按 services-system.critic.md 末尾 7 项清单全部修正并逐条复验 ±5 窗口：
  1. facts[57]："6 种模式生成不同尺寸"→"6 种模式按 4 组分支（FULLSCREEN/SCREEN_OCR 共用、BALL/VOICE_BALL 共用、WINDOW、RESULT_DISPLAY）生成"，ref 重锚 :514（窗口覆盖 when 与两组分支头）
  2. facts[49]：ref :157→:154（getChatCore 实际行）
  3. facts[93]：改写为单断言"isExpanded 初始为 false，窗口初始为悬浮球形态"，ref 重锚 :46
  4. quality[9]：line 213→215（强转实际行）
  5. quality[10]：line 38→40（return super 实际行）
  6. quality[4]：删除"互相拉活"表述，改为单向绑定（UIDebuggerService→FloatingChatService）
  7. quality[1]：软化"几乎无法彻底关闭"——划掉任务会复活，彻底停止需经窗口内关闭按钮 onClose→stopSelf()（:716）
- facts 数不变：127 条，status.json refs_valid 保持 127
- 修错后隔离重跑 lint：0 硬失败，0 警告；禁用词 0 命中
