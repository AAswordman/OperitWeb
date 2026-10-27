# ui-chat-input 第二轮独立复验报告（Issue #91）

- 复验对象：`review/batch-06/ui-chat-input.{md,facts.json,quality.json,lint.md,status.json}`（修错后版本）
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（HEAD 已确认一致）
- 第一轮结论：FAIL（F8 事实错误、F39/F40/F43/F52 复合或窗口违规、F5 轻微）
- 修错员动作：F8 改"前 26 字符"；F39/F40/F43/F52/F5 全部拆条重锚；facts 74→79，status.json refs_valid=79

## 一、第一轮 6 项修错复验（全部修到位）

1. **F8（事实错误）**：fact 已改为"长度超过 26 字符时截断为前 26 字符"，ref `:535`。源码 `AgentChatInputSection.kt:530-541` 确为 `if (displayModelName.length > 26) { displayModelName.take(26) + "..." }`，±5 窗口完整支撑。正文第 36 行同步为"超 26 字符截断为前 26 字符加省略号"。**PASS**
2. **F39/F40（autoglm 拦截重锚）**：现为 4 条原子事实——agent 单模型分支 `:2074`、agent 多模型分支 `:2159`、classic 单模型分支 `:1613`、classic 多模型分支 `:1700`。逐条核窗口，`contains("autoglm", ignoreCase = true)` 均在窗口内。**PASS**
3. **F43（FIXED_PROFILE 拆条）**：现为 4 条原子事实——`:354` 角色卡锁定记忆弹确认对话框、`:371` 确认后 `memoryProfileBindingMode = FIXED_PROFILE` 写回、`:337` `chatModelBindingMode = FIXED_CONFIG` 写回、`CharacterCardModelBindingSwitchConfirmDialog.kt:17` 对话框定义。窗口逐条支撑。**PASS**
4. **F52（hook 接线拆条）**：现为两条——`AIChatScreen.kt:1596` 文本变化 `dispatchNotification(INPUT_CHANGED)`、`:1813` 发送前 `dispatchSubmitRequested`。窗口内分别有 `INPUT_CHANGED` 与 `dispatchSubmitRequested` + `BLOCK` 裁决分支。**PASS**
5. **F5（两处 OutlinedTextField 拆条）**：现为两条——`:830` 与 `:1130`，窗口内均为 `OutlinedTextField(`。**PASS**

## 二、facts 随机抽查 20 条（seed=91）

抽查索引：10、75、22、20、51、58、56、59、73、32、31、24、47、62、27、64、67、48、5、49。

逐条拉出 ref±5 窗口人工比对：

- 全部 20 条：ref 文件存在、行号不越界、窗口完整支撑断言、无虚构符号、无复合事实。**20/20 PASS**
- 其中 [27]（`sendButtonEnabled` when 三分支全 `true`）与源码 `:186-190` 逐行一致，死逻辑实锤；[59] `normalize` 只做 `trim()`、大小写敏感、未知槽位归 `DEFAULT`，窗口 `:20-27` 完整支撑；[62] @mention 高亮 `0.88f`/`primary`/`0.14f` 均在窗口内。

## 三、quality 11 条复验

evidence 逐条与源码比对（锚点行 ±5 窗口 + 全 evidence 逐行连续匹配）：

- 11/11 evidence 为源码逐字原文，连续行匹配，行号锚点正确。**全部 PASS**
- severity 合理性：7 warn（sendButtonEnabled 死逻辑、透明双分支布局重复、Regex 粗暴剥 XML、dispatchNotification 每 hook 起协程、两套输入区实现重复、normalize 大小写静默错配、FIXED_CONFIG 持久副作用）与 4 suggestion（26 字符截断魔法数字、拖拽排序每次落点写盘、麦克风拒权限仅 Toast、滑杆不适用静默 return）分级恰当，无 high 膨胀，取值仅 high/warn/suggestion 枚举内。**合理**

## 四、status.json / lint / 合规

- `issue=91`（整数）、`source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、`refs_valid=79`（= facts 数组实际长度）、`status=review-pending`。**全对**
- facts.json / quality.json 均为顶层数组。**合规**
- 隔离 lint（/tmp，不含 lint.md 自扫）：**0 硬失败 / 0 警告**
- 禁用词（通过/批准/LGTM）5 文件全文：**0 命中**

## 五、微瑕 1 条（不阻塞）

- facts [43]（`ClassicChatSettingsBar.kt:320`）："角色卡锁定模型时（characterCardBoundChatModelConfigId 非空），在设置里选其他模型会先弹 CharacterCardModelBindingSwitchConfirmDialog"。窗口 314–325 覆盖对话框挂载（`visible = showCharacterCardBindingSwitchConfirm`），断言本体为真；但"非空"锁定条件（`:167`）与"选其他模型"触发点（`:291`）均在窗口外。建议后续顺手重锚到 `:291` 或拆条。不影响放行。

## verdict：PASS

6 项修错全部修到位；20 条随机抽查全过；11 条 quality evidence 逐字命中、severity 合理；status/lint/禁用词合规。可进入评审队列。critic 未修改任何交付文件。
