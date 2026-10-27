---
title: 聊天输入区
module: app
sources: AgentChatInputSection.kt, ClassicChatInputSection.kt, ClassicChatSettingsBar.kt, ChatInputHookRegistry.kt, InputMenuTogglePluginRegistry.kt, MentionVisualTransformation.kt, PendingMessageQueuePanel.kt, ToolPromptManagerDialog.kt, ThinkingQualitySlider.kt, CharacterCardMemoryBindingSwitchConfirmDialog.kt, CharacterCardModelBindingSwitchConfirmDialog.kt
date: 2026-10-01
---

# 聊天输入区

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

聊天输入区是聊天页底部的消息输入组件：文本框、发送按钮、附件入口、语音入口、模型/记忆/工具等快捷设置都收拢在这里。它有两种外观样式——**agent**（新式：输入区内嵌模型胶囊 + 设置弹窗）和 **classic**（旧式：输入框 + 右下角齿轮设置菜单），由用户偏好 `inputStyle` 切换；另有 9 个 `common/` 共享组件（hook 注册表、开关插件注册表、@mention 高亮、待发送队列、思考质量滑杆、工具提示词管理对话框等）被两种样式复用。

## AI 速览

- **核心符号**：AgentChatInputSection（agent 样式顶层）、ClassicChatInputSection（classic 样式顶层）、ClassicChatSettingsBar（classic 设置菜单）、ChatInputHookRegistry（输入 hook：三事件 + 四种裁决）、InputMenuTogglePluginRegistry（设置开关插件注册表，6 槽位）、MentionVisualTransformation（@mention 高亮）、PendingMessageQueuePanel（待发送队列）、ThinkingQualitySlider（思考档位滑杆）、ToolPromptManagerDialog（工具提示词开关+排序）。
- **主入口**：AIChatScreen 按 inputStyle 二选一渲染，inputStyle == INPUT_STYLE_AGENT 时用 agent 样式，否则用 classic 样式。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1873`
- **样式常量**：INPUT_STYLE_CLASSIC = "classic"、INPUT_STYLE_AGENT = "agent"。
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:277`
- **数据流向一句话**：用户输入文本 → 输入区 Composable 本地状态 → AIChatScreen 经 ChatInputHookRegistry 派发 hook（可拦截/改写）→ ChatViewModel.sendUserMessage() 发送；设置项变更直接写回偏好/角色卡并刷新 AI 服务。

## 核心机制

### 三种样式的差异

**文本框**：agent 用 OutlinedTextField，maxLines = 6；classic 用 BasicTextField，maxLines = 5，用 decorationBox 绘制边框，形状为 RoundedCornerShape(14.dp)。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:830`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:846`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:524`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:535`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:492`

**模型切换**：agent 在输入区底部工具行内嵌“模型胶囊”，显示 displayModelName，超 26 字符截断为前 26 字符加省略号；点击打开 AgentModelSelectorPopup。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:535`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:1479`
classic 在设置菜单的模型分组里用 ModelSelectorItem 下拉。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:564`

**设置入口**：agent 是工具行的 Tune 齿轮按钮，点击弹 AgentExtraSettingsPopup，内部分组为记忆/模型/工具/行为/插件。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:2219`
classic 是输入区右下角 28dp 的 Tune 齿轮按钮，右边距由 chatSettingsBarRightMargin 偏好控制；点击弹 280dp 宽的 Popup 设置菜单。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:411`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:441`
设置菜单内含 5 个 ClassicSettingsFoldSection 折叠分组：记忆、模型、工具、行为、插件。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:457`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:551`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:647`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:675`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:719`
开关按 InputMenuToggleSlots.normalize(it.slot) 分组到各分区。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:212`

**附件面板**：classic 用内嵌展开的 AttachmentSelectorPanel；agent 用弹窗式的 AttachmentSelectorPopupPanel；两者是不同组件。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:749`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/AttachmentSelector.kt:88`

**外观**：agent 深色主题用自定义 Modifier.topEdgeHighlight 在卡片顶部描高光线，浅色用 Modifier.outerDiffuseShadow 做 5 层漫射外阴影。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:3175`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:3124`
classic 用 chatInputTransparent / chatInputFloating / chatInputLiquidGlass / chatInputWaterGlass 四个布尔参数控制透明、悬浮、液态玻璃、水玻璃。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:103`

**全屏输入**：classic 文本框右上角小图标按钮打开 FullscreenInputDialog；agent 把全屏按钮放在 OutlinedTextField 的 trailingIcon。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:768`

**行为一致的部分**：发送按钮四态（取消 error 红 Close / 排队 tertiary Add / 发送 primary Send / 空输入 Mic），showQueueAction = isProcessing && hasDraftText。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:184`
agent 的 sendButtonEnabled = true 是直接量，恒为 true。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:425`
token 上限预警：maxTokens = (maxWindowSizeInK * 1024)，ChatUtils.estimateTokenCount 估算的 projectedTokens 超限时发送前弹确认框，用户可选择继续发送；classic 的提示文案取 token_limit_exceeded_message。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:410`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:738`
回复预览用正则剥除消息内容里的 XML 标签，超 50 字截断。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:328`
AutoGLM 拦截：模型名含 "autoglm"（忽略大小写）时弹 Toast chat_autoglm_warning 并拒绝选择，agent 和 classic 都有。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/agent/AgentChatInputSection.kt:1966`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:1472`

### 输入增强：语音 / 附件 / 工具快捷入口

- **语音**：空文本时 action 按钮变 Mic 图标，点击先走 voicePermissionLauncher 请求麦克风权限，再调 onFloatingButtonClick(FloatingMode.FULLSCREEN) 进入全屏语音；权限被拒弹 microphone_permission_denied_toast。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:199`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatInputSection.kt:204`
- **附件**：+ 按钮切换附件面板；已选附件在输入区上方渲染为附件 chips 行，可删除、可插入文本。
- **工具快捷入口**：模型胶囊一键换模型；Tune 设置菜单；工具权限 FORBID/ASK/ALLOW 三段开关。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:1047`
ToolPromptManagerDialog 管理工具提示词的开关与拖拽排序。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:660`
插件经 InputMenuTogglePluginRegistry 向 THINKING/MEMORY/MODEL/TOOLS/GENERAL 槽位注入开关。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/InputMenuTogglePluginRegistry.kt:10`

### 输入 hook 机制（插件拦截点）

ChatInputHookRegistry 是 object 单例，内部用 CopyOnWriteArrayList<ChatInputHook> 保存 hook。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ChatInputHookRegistry.kt:57`
三事件：INPUT_CHANGED="input_changed"、SUBMIT_REQUESTED="submit_requested"、SUBMITTED="submitted"；四种裁决：ALLOW、BLOCK、REPLACE、CONSUME。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ChatInputHookRegistry.kt:12`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ChatInputHookRegistry.kt:20`
AIChatScreen 接线：文本变化时 dispatchNotification(INPUT_CHANGED)，发送前 dispatchSubmitRequested(SUBMIT_REQUESTED) 并执行 BLOCK/CONSUME 裁决。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1598`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1810`
BLOCK 中止发送；CONSUME 由 hook 接管；REPLACE 改写文本并把光标移到末尾（selectionStart/End = replacement.length）。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ChatInputHookRegistry.kt:116`
通知用 SupervisorJob()+Dispatchers.IO 的 notificationScope 为每个 hook 起协程并发通知，单个 hook 抛异常只记日志不中断其他 hook。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ChatInputHookRegistry.kt:58`
ChatInputHook.onEvent 有缺省实现返回 null，未注册或返回 null 的 hook 不影响输入流程。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ChatInputHookRegistry.kt:53`

### 思考质量与角色卡绑定

- **思考档位**：ThinkingQualitySlider（internal）仅当 mapping.control == ThinkingQualityControl.LEVELS 且 options 非空才渲染；滑杆位置四舍五入到最近 option，只有 onValueChangeFinished 才提交 option id。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ThinkingQualitySlider.kt:78`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ThinkingQualitySlider.kt:151`
reasoningRequired 时思考开关被锁死（onToggleThinkingMode 传空 lambda）。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:591`
- **角色卡锁定**：characterCardBoundChatModelConfigId 非空时换模型先弹 CharacterCardModelBindingSwitchConfirmDialog，确认后把卡片 chatModelBindingMode 改为 FIXED_CONFIG 写回。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:320`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:337`
记忆同理：先弹 CharacterCardMemoryBindingSwitchConfirmDialog，确认后改写为 FIXED_PROFILE 并刷新 AI 服务。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/classic/ClassicChatSettingsBar.kt:354`

## 关键符号

- AgentChatInputSection / ClassicChatInputSection：两种样式的顶层输入区 Composable，参数几乎同构（viewModel、userMessage、onSendMessage/onQueueMessage/onCancelMessage、inputState、attachments、回复/工作区/外观等）。
- ClassicChatSettingsBar：classic 样式的 280dp 设置菜单，5 个折叠分组。
- AgentModelSelectorPopup / AgentExtraSettingsPopup：agent 样式的模型选择 / 额外设置弹窗。
- ChatInputHookRegistry / ChatInputEvents / ChatInputSubmitActions：输入事件与发送裁决。
- InputMenuTogglePluginRegistry / InputMenuToggleSlots / InputMenuToggleDefinition：设置开关的插件化注册；changeVersion: StateFlow<Int> 在注册/注销时自增驱动 UI 刷新；register 先 unregister(plugin.id) 再添加，同 id 覆盖。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/InputMenuTogglePluginRegistry.kt:56`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/InputMenuTogglePluginRegistry.kt:59`
- PendingMessageQueuePanel / PendingQueueMessageItem(id: Long, text: String)：待发送队列，空队列直接 return 不渲染，展开后列表最大高度 220dp。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/PendingMessageQueuePanel.kt:37`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/PendingMessageQueuePanel.kt:54`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/PendingMessageQueuePanel.kt:92`
- ToolPromptManagerDialog：工具提示词开关 + 长按拖拽排序；拖拽落点即时调用 onSaveToolOrder 持久化，每行 Switch 即时调用 onSaveToolPromptVisibilityMap 保存。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ToolPromptManagerDialog.kt:77`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/ToolPromptManagerDialog.kt:159`
- rememberMentionVisualTransformation：@mention 高亮，字号为基准字号 × 0.88f、颜色 primary、背景 primary 14% 透明、FontWeight.Medium；无 token 时返回原文 + OffsetMapping.Identity。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/MentionVisualTransformation.kt:30`
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/common/MentionVisualTransformation.kt:43`

## 调用链（输入 → 处理 → 输出）

1. **输入**：用户在 AgentChatInputSection / ClassicChatInputSection 的文本框键入（@mention 经 MentionVisualTransformation 高亮）；AIChatScreen.commitUserMessageChange 更新 ViewModel 并派发 INPUT_CHANGED hook 通知。
2. **处理**：点击发送（或回车）→ AIChatScreen 先 dispatchSubmitRequested(SUBMIT_REQUESTED)，hooks 可 BLOCK（中止）、CONSUME（接管）、REPLACE（改写文本）；token 预估超限则先弹确认框。
3. **输出**：ChatViewModel.sendUserMessage() 发送 → 派发 SUBMITTED hook 通知；处理中 action 按钮变取消（可中断）或排队（进 PendingMessageQueuePanel）。

## 来源

- 种子文件：app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/input/ 下全部 12 个 kt 文件（agent 1 + classic 2 + common 9），共 7037 行，100% 全文阅读。
- 样式切换与 hook 接线：app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt。
- 附件选择器：app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/AttachmentSelector.kt。
- 源码版本：Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb。
