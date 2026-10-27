# Critic 复验报告：plugins（Issue #79）— 第二轮

- 复核对象：`review/batch-06/plugins.{md,facts.json,quality.json,lint.md,status.json}`（修错后版本）
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（HEAD 已确认一致）
- 方法：critic.md 第五节清单逐项独立复核；7 处重锚全部独立拉 ±5 窗口（非仅按报告抄）；[84] 拆条两处窗口核对；quality 10 条 evidence 逐字节脚本比对源码 raw bytes；正文引用核对；facts 随机 20 条抽查；两个 high 实质主张重新看过源码原文；status.json 字段核对；禁用词检查。
- 本 critic 未修改任何交付文件。

## 一、critic.md 清单复验：全部修到位

**facts 重锚（7 处）**：[34] :81（try/catch 窗口覆盖）、[58] :907（第 12 个注册调用 `ToolPkgAiProviderRegistry.register()` 在窗口内）、[61] :123（试探循环 `withIndex` 在窗口内）、[65] :301（`Channel<String>(capacity = Channel.UNLIMITED)` 在窗口内）、[82] :694（`"$runtime|$chatId"` 在窗口内）、[106] :36（`syncAndReplayToolPkgRegistrations` 在窗口内）、原 [153]（拆条后移位为 [154]）:66（`contains("timed out", ignoreCase = true)` 在窗口内）——全部独立核对，±5 窗口支撑断言。

**[84] 拆条**：facts[84]（:714，featureStates 分支 `onToggleFeature` 在窗口内）/ facts[85]（:725，JS toggle 路径在窗口内），两条均为原子事实。

**facts 总数**：181 = status.json refs_valid（整数）。

**quality evidence（10/10 逐字节一致）**：逐行脚本比对源码 raw bytes（含原始缩进），Q1–Q10 全部字节级命中。行号修正已落实：Q2 line=69、Q5 line=112、Q6 line=68（`if (timeoutMillis == null) {` 实际在 68 行，修错员纠正 critic.md 的 67 笔误，核实无误）、Q9 evidence 补回行尾 ` {`。severity 分布 2 high / 5 warn / 3 suggestion。

**正文**：`:283`→`:301`、`:703`→`:694` 两处引用已同步；概述改为"五个 hook 注册表/插件（应用生命周期、聊天视图、聊天消息菜单项、工具箱、工作流生命周期）"，与下表 5 行对齐。

## 二、两个 high 实质主张独立核实

- **Q1（ToolPkgToolLifecycleBridge.kt:86）**：`onToolCallIntercept` 中 JS hook 抛异常 → `return AIToolHookDecision.Block(...)`；`decodeToolPkgHookResult` 解码失败 → 同样直接 `Block`。同步决策点、fail-closed，无法区分故障与有意拦截——high 恰当。
- **Q2（ChatMessageMenuItemRegistry.kt:69）**：`createMenuItems` = `plugins.flatMap { plugin -> plugin.createMenuItems(params) }`，确无 try/catch，任一插件抛异常中断整个菜单构建——high 恰当。

## 三、随机抽查

facts 随机 20 条（seed=79）：符号提取后逐条核 ±5 窗口，**20/20 支撑**，无越界、无死引用。

## 四、合规

- status.json：id=plugins、issue=79、source_repo=operit、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb、status=review-pending、refs_valid=181（整数=实际条数）——全对。
- facts/quality 顶层数组；severity 仅 high/warn/suggestion。
- 5 交付文件禁用词（通过/批准/LGTM）：0 命中。

## 五、备注（不阻塞）

- critic.md 备注中的计数类锚点（[28] 12 枚举值、[113] 17 字段、[124] 11 字符串、[165] 7 子桥接、[168] 载荷字段）本轮未重新逐个数过；critic.md 已验真且锚点未动，接受其结论。
- Q6 行号以源码为准（68），critic.md 写的 67 为笔误，修错员已纠正。

## verdict: PASS
