# Critic 报告：ui-chat-input（聊天输入区，Issue #91）

- 复核对象：`review/batch-06/ui-chat-input.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 HEAD 一致）
- 复核方式：74 条 facts 全部机械校验（文件存在+行号在界）+ 逐条 ±5 窗口人工核对断言支撑；11 条 quality evidence 逐条源码逐字比对 + 行号锚点窗口校验；正文 60 处行内引用抽查；status.json 字段核对。

## 总体 verdict：FAIL（1 处事实错误 + 4 类引用/原子化问题，需修错后由另一名独立 critic 复验）

## 一、事实错误（必须修）

**F8（事实错误）**：fact 写"长度超过 26 字符时截断为前 23 字符加省略号"，源码 `AgentChatInputSection.kt:538-541` 实际是：

```
if (displayModelName.length > 26) {
    displayModelName.take(26) + "..."
}
```

`take(26)` 是前 **26** 字符（不是 23），总长 29 字符。**正文第 36 行"模型切换"段有同源错误**（"超 26 字符截断为前 23 字符加省略号"），两处一起改。

注：quality.json Q5 的描述写的是"前 26 字符 + ..."（正确），与 F8 自相矛盾，修 F8 时顺带确认 Q5 无需动。

## 二、引用窗口违规（必须修）

**F39（窗口违规）**：fact 锚 `AgentChatInputSection.kt:1966`，窗口内只有 `showAutoGlmError` 的 Toast 辅助函数；断言核心"模型名含 autoglm（忽略大小写）"的 `contains("autoglm", ignoreCase = true)` 实际在 **:2074**（单模型分支）和 **:2159**（多模型分支），拒绝选择逻辑也在那里，均在 ±5 窗口外。断言内容经核实为真，只需重锚（建议锚 :2074 或拆成"检查/拒绝"两条）。

**F40（窗口违规）**：同源问题，锚 `ClassicChatSettingsBar.kt:1472` 只有 Toast 辅助函数；实际 `contains("autoglm", ignoreCase = true)` 检查在 **:1613** 和 **:1700**，`showAutoGlmError()` 调用在 :1614/:1701。断言为真，重锚即可。

**F43（窗口违规）**：fact 锚 `ClassicChatSettingsBar.kt:354`（`CharacterCardMemoryBindingSwitchConfirmDialog` 调用），窗口 349–359 只支撑"弹对话框"断言；断言后半"确认后把卡片 memoryProfileBindingMode 改为 FIXED_PROFILE 写回"实际在 **:369–372**：

```
memoryProfileBindingMode = CharacterCardMemoryProfileBindingMode.FIXED_PROFILE,
memoryProfileId = profileId,
```

在 ±5 窗口外。断言为真，重锚到 :369 或拆成两条。

## 三、复合事实（必须修）

**F52（复合事实）**：一条 fact 含两个独立断言——"文本变化时 dispatchNotification(INPUT_CHANGED)（AIChatScreen.kt:1598）"和"发送前 dispatchSubmitRequested（AIChatScreen.kt:1810）"，ref 只给 :1810。两个断言经核实均为真（INPUT_CHANGED 派发实际在 :1597，±5 内可支撑；submit 派发在 :1815，窗口内），但违反原子化。拆成两条，每条给各自 ref。

## 四、轻微问题（建议修）

**F5（窗口支撑不足）**：fact 断言 agent 文本框"透明与非透明两个分支各写了一个，共两处"，ref :830 的 ±5 窗口只看到第一个 `OutlinedTextField(`；第二个在 **:1130**（经 grep 确认）。断言为真，但单 ref 窗口支撑不完整。建议拆成两条（各锚 :830/:1130）或补第二条 ref。

## 五、PASS 的部分

- 74/74 facts：文件存在、行号无一越界、无虚构符号；除上述 6 条外，其余 68 条 ref±5 窗口完整支撑断言、均为单断言。
- quality.json 11 条：evidence 11/11 与源码逐字比对命中（脚本逐行比对，0 缺失）；行号锚点 11/11 落在窗口内；severity 评级全部合理——7 条 warn（sendButtonEnabled 三分支恒 true 死逻辑 :186、透明双分支布局重复 :790、Regex 剥 XML 标签误伤 :328、notificationScope 高频事件协程 churn :58、两套输入区重复实现 :423、normalize 大小写敏感 :20、FIXED_CONFIG 持久副作用 :337）与 4 条 suggestion（Q5 截断魔法数字、Q6 拖拽即时写盘、Q8 权限被拒无引导、Q9 slider 静默不渲染）量级恰当，无 high 膨胀。3 条重点核实项（sendButtonEnabled、normalize、FIXED_CONFIG）均为实锤。
- 正文：60 处行内 `file:line` 引用（抽查 15 处全部准确）；双受众固定结构完整；种子目录 12 个 kt 文件（7037 行）全部覆盖——agent 1 + classic 2 + common 9，frontmatter sources 列全；页面三问（三种样式差异/输入增强/ChatInputHookRegistry 裁决机制）全覆盖；走查未写入正文。
- status.json：issue=91、source_commit、source_repo、refs_valid=74（=facts 实际条数，parent 已修正）全对；critic 字段留空正确。
- lint 0/0；5 文件禁用词（通过/批准/LGTM）0 命中；severity 枚举合规；顶层数组格式正确。

## 六、修错清单（修错员照此执行）

1. F8："前 23 字符"→"前 26 字符"；正文第 36 行同源改法。
2. F39：重锚到 :2074（或拆"检查/拒绝"两条，锚 :2074/:2159）。
3. F40：重锚到 :1613（或拆条，锚 :1613/:1700）。
4. F43：FIXED_PROFILE 断言重锚到 :369（或拆条，:354/:369）。
5. F52：拆成两条，分别锚 AIChatScreen.kt:1597（INPUT_CHANGED）和 :1810（submit）。
6. F5（建议）：拆成两条分别锚 :830/:1130。
7. facts 总数如有变化（F52 拆条后 74→75），同步更新 status.json refs_valid。
8. 每条修正后复核 ±5 窗口支撑；修完后 4 文件（md/facts/quality/status）隔离跑 lint 必须 0/0；全文不许出现"通过/批准/LGTM"。

修错后必须派**另一名**独立 critic 复验（不能由 writer 自检代替）。
