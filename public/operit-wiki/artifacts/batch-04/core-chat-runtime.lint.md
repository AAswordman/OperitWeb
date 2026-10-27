# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 修错后复跑记录（2026-10-01）

- 按独立 critic 报告（`core-chat-runtime.critic.md` §1.2/§5）完成修错：16 条 ref 重锚、14 条复合事实拆分（→30 条）、删除 2 对完全重复、1 条改述（[70] 去掉"7 种"计数，改为以 `PromptInputHook` 为例）。
- 修错中额外优化 7 处锚点（critic 意图不变、证据覆盖更完整）：audio(a) :262→:260、video(a) :281→:279、`sendMessage` 拆成 :345（定义）/:373（返回类型）、limitMediaLinks :594→:593、limitImageLinks 两处 :405/:612→:617、ChatRuntimeHookRegistry `dispatch` :61→:58。
- facts：98 → 113 条；逐条复验：ref 文件存在、行号不越界、±5 窗口完整支撑断言（反引号符号检查 113/113 通过，其中 5 条的主语符号为窗口外上下文、行为证据全部在窗内，已用 sed 逐条确认：[45]/[46] 的两个取消调用、[79] 的四个字段、[83] 的 metadata 合并与字段覆盖、[88] 的 runCatching/onFailure/return@forEach 均在窗内）。
- quality.json Q0 detail 措辞修正：角色隔离分支只有 other-role 子分支用了清理后的内容，current-role 子分支同样返回原始 `message.content`。
- 正文：AI 速览 `SharedStream<String>` 引用 :346→:373（关键符号表中的 `sendMessage` 行保留 :346，其窗口含 `fun sendMessage` 定义）。
- 单页隔离重跑 `scripts/lint.py`：0 硬失败 / 0 警告。
- `.status.json` 未动（保持 review-pending），`review-queue.json` 未动。


## 复检后小修复跑记录（2026-10-01 14:05 CST）

- 按复检结论（`core-chat-runtime.critic.md` 末尾"## 复检"段）完成 5 项机械小修：
  1. [73] ref `ChatRuntimeHookRegistry.kt:45`→`:34`（接口实际在 31–37 行，:34 窗口 29–39 覆盖 `interface ChatRuntimeHook`/`id`/`onEvent` 全声明，已用 sed 核实）。
  2. 删 [94]（与 [90] 重复：`ActivePrompt.CharacterGroup(boundGroupId)`）。
  3. 删 [95]（与 [91] 重复：`ActivePrompt.CharacterCard(resolvedRoleCardId)`）。
  4. 删 [96]（与 [92] 重复：`findCharacterCardByName` 解析角色卡名）。
  5. 删 [32]（与 [43] 软重复：`limitImageLinksInChatHistory`；且 [32] 参数名与源码不符）。
- facts：113 → 109 条；JSON 合法，重载验证通过；保留的 [90]/[91]/[92]/[43] 均在位且无重复。
- 单页隔离重跑 `scripts/lint.py`：**0 硬失败 / 0 警告**。
