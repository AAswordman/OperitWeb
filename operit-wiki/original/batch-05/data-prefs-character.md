---
title: 角色卡与人格配置
module: 数据层
sources: CharacterCardManager.kt, CharacterGroupCardManager.kt, CharacterCardToolAccessResolver.kt, WaifuPreferences.kt, ActivePromptManager.kt, PersonaCardChatHistoryManager.kt, CharacterCardBilingualData.kt, CharacterCard.kt, CharacterGroupCard.kt, ActivePrompt.kt, WaifuMessageProcessor.kt, WaifuModeSettingsScreen.kt, FunctionalPrompts.kt, AIChatScreen.kt, ChatViewModel.kt, AIForegroundService.kt
date: 2026-10-01
---

# 角色卡与人格配置

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 的“人格”存在哪里、长什么样、怎么生效。

**角色卡**（CharacterCard）就是一套人格配置：一张卡管一个 AI 身份，里面装着名字、角色设定（引导词，决定 AI 说话的口吻和立场）、开场白、聊天和语音两套“其他内容”、挂载的提示词标签、高级自定义提示词，还能绑定专用的对话模型和记忆配置，外加一份工具白名单。用户在设置里切换角色卡，等于给 AI 换了一套人格。

**群组卡**（CharacterGroupCard）是多张角色卡的组合，用来开“群聊”：一群不同人格的 AI 同场对话。

除此之外还有三块配套机制：`WaifuPreferences` 给每张卡/每个群组存一份独立的“Waifu 模式”参数（打字机延迟、表情包、自拍等）；`ActivePromptManager` 裁定当前生效的是哪张卡或哪个群组；`PersonaCardChatHistoryManager` 给“人设卡生成”界面按卡隔离对话历史。而 `WaifuMessageProcessor` 负责把 AI 的回复切成一句一句发出去、配上打字机延迟和表情包（见第 8 节）。

## AI 速览

- 核心符号：`CharacterCardManager`（角色卡增删改查与提示词拼接）、`CharacterGroupCardManager`（群组卡与拼图头像）、`CharacterCardToolAccessResolver`（工具白名单解析）、`WaifuPreferences`（Waifu 模式参数）、`ActivePromptManager`（当前生效目标裁定）、`PersonaCardChatHistoryManager`（人设卡生成历史）、`CharacterCardBilingualData`（默认人格双语模板）
- 主入口：`CharacterCardManager.getInstance(context).combinePrompts(cardId, promptFunctionType)` 拼出系统提示词；`ActivePromptManager.getInstance(context).getActivePrompt()` 拿当前生效的卡或群组
- 数据流向一句话：角色卡字段（DataStore `character_cards`）→ `combinePrompts` 按固定顺序拼成提示词字符串 → `ConversationService` 组装进系统提示词发给模型；工具权限经 `CharacterCardToolAccessResolver.resolve` 算出白名单 → `ToolRegistration` / `ToolExecutionManager` 在执行时鉴权。

## 核心机制

### 1. 角色卡数据模型：一个人格有哪些零件

`CharacterCard` 是 Room Entity，表名为 `character_cards`。
`app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:41`

字段按作用分四类：

- **身份与展示**：`id`（主键）、`name`、`description`、`marks`。其中 `marks` 是备注，注释明确写了它不会被拼进提示词。
  `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:53`
- **人格提示词**：`characterSetting`（角色设定/引导词）、`openingStatement`（开场白）、`otherContentChat`（聊天用其他内容）、`otherContentVoice`（语音用其他内容）、`attachedTagIds`（挂载的提示词标签 ID）、`advancedCustomPrompt`（高级自定义引导词）。
  `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:47`
- **绑定**：`chatModelBindingMode`（`FOLLOW_GLOBAL` 跟随全局或 `FIXED_CONFIG` 固定配置）配 `chatModelConfigId` / `chatModelIndex`；`memoryProfileBindingMode`（`FOLLOW_GLOBAL` 或 `FIXED_PROFILE`）配 `memoryProfileId`。非法模式字符串会被 `normalize` 回退为 `FOLLOW_GLOBAL`。
  `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:69`
- **工具白名单**：`toolAccessConfig`，默认是关闭状态的空配置。
  `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:9`

### 2. 存储：三个 DataStore，各管一摊

- 角色卡存在名为 `character_cards` 的 DataStore，schema 版本 1。列表键 `character_card_list` 存全部卡 ID，`active_character_card_id` 存当前活跃卡。每张卡的字段以 `character_card_${id}_字段名` 的键存放。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:47`
- 群组卡存在 `character_groups`，整张群组卡以 Gson JSON 字符串存于 `character_group_${id}_data` 一个键里。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterGroupCardManager.kt:308`
- Waifu 参数存在 `waifu_settings`，全局键与按卡/群组前缀隔离的键共存（见第 6 节）。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WaifuPreferences.kt:16`

三类 Manager 都是双重检查锁的全局单例，`getInstance(context)` 拿实例。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:106`

### 3. 默认卡与版本迁移：第一次启动发生什么

默认卡 ID 是 `default_character`，名字叫 `Operit`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:96`

版本 0 迁移时，如果卡列表为空就创建默认卡：绑定模式全是 `FOLLOW_GLOBAL`，描述、角色设定、聊天与语音其他内容取自 `CharacterCardBilingualData` 的双语默认值。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:119`

迁移还做两件脏活：把旧版 `other_content` 字段合并进 `other_content_chat`；清理卡上已不存在的标签 ID。注意语音默认值只在该字段“从未被写入”时才播种——用户显式清空过的空串会被保留，不会被默认值覆盖。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:239`

`CharacterCardBilingualData` 按系统语言二选一：中文环境给中文模板，否则给英文。默认角色设定中文是“你是Operit，一个全能AI助手，旨在解决用户提出的任何任务。”；默认语音人格则是一套“猫娘未来人”设定，含身份锚定、不可覆盖的核心指令、语音专项要求（短句、口语、不念稿）等章节。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardBilingualData.kt:22`

### 4. combinePrompts：人格如何变成提示词

`combinePrompts(characterCardId, additionalTagIds, promptFunctionType)` 是人格生效的总装线，拼接顺序固定：角色设定 → 其他内容 → 附着标签的提示词 → 高级自定义提示词，段间用空行分隔。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:636`

`promptFunctionType` 为 `VOICE` 时取 `otherContentVoice`，否则取 `otherContentChat`——同一张卡在聊天和语音两种场景可以用两套话术。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:639`

`ConversationService` 在组装系统提示词时调用它，把返回的字符串拼进发给模型的系统提示词。
`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt:517`

### 5. 群组卡：多个人格同场

`CharacterGroupCard` 只有六个字段：`id`、`name`、`description`、`members`（`GroupMemberConfig` 列表，含 `characterCardId` 与 `orderIndex`）、`createdAt`、`updatedAt`。
`app/src/main/java/com/ai/assistance/operit/data/model/CharacterGroupCard.kt:14`

写入前 `normalizeGroup` 会过滤空白成员 ID、按 `orderIndex` 排序并重新编号，保证顺序干净。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterGroupCardManager.kt:289`

新建群组会自动生成一张拼图头像：取前 9 个成员的头像拼成 512px 九宫格，存为 `group_avatar_${id}_${时间戳}.png`。之后如果成员名单变化且当前头像仍是系统生成的这张，会重新生成一张。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterGroupCardManager.kt:379`

`duplicateCharacterGroupCard` 可以复制群组，并把主题、Waifu 配置、表情绑定一并克隆到新群组。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterGroupCardManager.kt:261`

### 6. 工具白名单：给人格配“能用什么工具”

`CharacterCardToolAccessConfig` 有四份名单：允许的内置工具名、工具包名、Skill 名、MCP 服务器名，外加一个总开关 `enabled`（默认关闭）。
`app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:9`

`CharacterCardToolAccessResolver.resolve` 的判定逻辑：

- 开关关闭 → 直接用全局工具可见性与全部外部源，不限制。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardToolAccessResolver.kt:76`
- 开关打开 → 内置工具的最终可见性 = 全局可见性 ∩ 白名单；只有白名单里包含 `use_package`，工具包/Skill/MCP 三类外部源才会进入“全局 ∩ 白名单”的交集计算，否则三类集合直接为空。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardToolAccessResolver.kt:95`
- `package_proxy` 工具特殊：只要有任一外部源被允许就放行。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardToolAccessResolver.kt:23`

调用方是 `ToolRegistration.resolveCurrentRoleCardToolAccess`，它拿当前工具调用所属的角色卡 ID 去解析，执行时再按结果鉴权。
`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:185`

### 7. Waifu 模式：每张卡独立的“表演参数”

Waifu 模式是一组影响消息呈现的参数：总开关 `enable_waifu_mode`（默认关）、每字符延迟 `waifu_char_delay`（默认 250ms）、是否移除标点、是否启用表情包、是否启用自拍、是否启用合并发送、合并等待 `waifu_merge_send_delay_ms`（默认 5000ms）、Waifu 附加提示词（默认要求纯文本、禁止动作表情）、自拍外貌提示词（一段英文二次元形象描述词）。
`app/src/main/java/com/ai/assistance/operit/data/preferences/WaifuPreferences.kt:33`

关键设计：每个角色卡/群组的 Waifu 配置以前缀 `character_card_waifu_${id}_` / `character_group_waifu_${id}_` 存在同一个 DataStore 里，与全局键隔离。切换卡时 `switchToWaifuSettingsByPrefix` 把该卡的配置覆盖到全局键上；该卡没有专属配置就删除全局键（等于清空）。`CharacterCardManager` 切换活跃卡时**总是**调用切换，即使目标卡没有配置也会清空当前配置，避免把上一张卡的参数带过来。
`app/src/main/java/com/ai/assistance/operit/data/preferences/WaifuPreferences.kt:236`

新建角色卡时会把创建时刻的当前 Waifu 配置复制给新卡。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:364`

### 8. Waifu 模式的消息呈现：分句、打字机、表情包与合并发送

人话：Waifu 模式是“让 AI 像真人一样一句一句回消息”的呈现层。第 7 节讲的是参数存在哪、怎么跟卡走；这一节讲的是 AI 的回复怎么被切开、延迟、配上表情包。

- **分句引擎**：`WaifuMessageProcessor` 是 object 单例（应用启动时由 `OperitApplication` 初始化），`streamSegments` 把模型流式输出按中英文句末标点切成句子逐个发出；`streamSegmentsWithTypingQueue` 再给每句加“打字机延迟”——从第 2 句起，每句等待 `句长 × 每字符延迟`，单句上限 3000ms，首句不等待。
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:22`
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:194`
- **切分保护**：分句前先把 Markdown 图片/链接、URL、邮箱替换成 `{WAIFUENTITY:n}` 占位符，切完再还原，避免把链接从中间切断；代码块、表格、LaTeX 块被标记为“受保护”，整块作为一个 segment 发出、不拆句；LaTeX 块还会补回 `$$` 定界符，保证气泡里能正常渲染公式。
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:27`
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:881`
- **流式一致性**：`StreamingSession` 记住已发出的句子；如果某次分句快照比已发出的还短、或前缀发生了变化（模型改写了前面已输出的文字），直接丢弃本次快照——发出去的句子永远不回滚、不重发。
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:72`
- **表情包**：模型按提示词规则在句末输出 `<emotion>happy</emotion>` 这类标签，`separateEmotionAndText` 把它转成 Markdown 图片 segment（`!` 开头、方括号里是情绪名、括号里是 file:// 表情路径）单独发送。注意：只查**自定义表情**；找不到对应情绪时该标签被直接丢弃（只打一条 warning 日志），不会保留原文。
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:950`
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:1037`
- **提示词注入**：Waifu 模式开启时，`ConversationService` 在系统提示词末尾追加 `[Extra Rules]`：开表情包→追加“每句末用 `<emotion>` 标注情绪”规则（可用情绪列表动态取自当前生效卡的表情分组，无表情时则明确告知模型不要用标签）；开自拍→追加自拍绘图规则（含外貌提示词与合影关键词）；自定义提示词原样追加。
  `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt:593`
  `app/src/main/java/com/ai/assistance/operit/core/config/FunctionalPrompts.kt:462`
- **生效链路（注意）**：`send_message_to_ai_streaming` 工具里 `effectiveWaifuMode = waifuMode == true`——只有当模型调用时显式传 `waifu=true` 参数，分句+打字机才真正走 `streamSegmentsWithTypingQueue`；传了非法值直接返回“Invalid parameter: waifu must be true/false”报错。全局开关只决定提示词里有没有 `[Extra Rules]`，不直接决定流式切分走哪条路。
  `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:2078`
- **合并发送**：Waifu 模式和合并发送都开启时，聊天界面把用户每条短消息先放进 `waifuMergeBuffer` 并即时显示为可见消息；`LaunchedEffect` 等待 `waifuMergeSendDelayMs`（默认 5000ms）且输入空闲后，把 buffer 里所有消息合并成一条真正发给 AI。合并前会删掉最后一条“乐观可见”消息再重发——如果对不上（比如用户在等待窗口内删了消息），本轮合并直接跳过。
  `app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1841`
  `app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1681`
- **复用**：`cleanContentForWaifu`（剥 thinking/状态/工具/emotion/XML 标签和 Markdown 标记，只留纯文本）也被 TTS 朗读和前台服务回复通知复用，保证“读出来、通知栏里看到的”都是干净文本。
  `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:766`
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:329`
- **设置界面**：`WaifuModeSettingsScreen` 有总开关、合并发送（间隔滑块 500~10000ms）、打字延迟（200~1000ms/字符）、去标点、自定义提示词、表情包开关（含自定义表情管理入口）、自拍开关（带外貌提示词输入框）。每次保存都会把当前全局配置同步写回当前卡/群组的前缀键。
  `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/WaifuModeSettingsScreen.kt:76`

### 9. 酒馆卡互通：导入与导出

Operit 兼容 SillyTavern（酒馆）角色卡格式。导入入口 `createCharacterCardFromTavernJson`：酒馆卡名为空直接失败。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:966`

导入有两条路径：

- 如果 JSON 里 `extensions.operit.schema` 等于 `operit_character_card_v1`，说明是 Operit 自己导出的，直接用完整载荷还原全部字段（含绑定模式、白名单）。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:994`
- 否则走通用转换：`description`+`personality`+`scenario` 进角色设定；`mes_example`+`system_prompt`+`post_history_instructions`+备用问候语进聊天其他内容；`depth_prompt` 进高级自定义提示词；`first_mes` 做开场白。世界书（`character_book`）的条目会被拼成 `[条目名]\n内容` 文本，建一个 `FUNCTION` 类型标签挂到卡上。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:1295`

PNG 图片导入（`createCharacterCardFromTavernPng`）先从 PNG 的 `tEXt` 块里找关键字为 `chara` 的条目，Base64 解码出 JSON，再走同一套 JSON 导入流程。解析前会校验 8 字节 PNG 文件头。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:1157`

导出（`exportCharacterCardToTavernJson`）生成 `chara_card_v2` / `2.0` 规范卡：开场白→`first_mes`、聊天其他内容→`mes_example`、角色设定→`system_prompt`、高级自定义→`post_history_instructions`、备注→`creator_notes`，同时把 Operit 完整载荷塞进 `extensions.operit`，保证重导入无损。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:1105`

### 10. 备份与恢复

`exportAllCharacterCardsToBackupFile` 把全部角色卡连同被引用的提示词标签导出为 JSON，schema 为 `operit_character_cards_backup_v1`，文件名为 `character_cards_backup_yyyy-MM-dd_HH-mm-ss.json`，放在备份目录的角色卡子目录。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:702`

导入（`importAllCharacterCardsFromBackupContent`）接受两种格式：含 `characterCards` + `promptTags` 的对象，或纯角色卡数组。id 或 name 为空的条目跳过；id 已存在计为更新，否则计为新增；默认卡 ID 的条目强制 `isDefault=true`，其余强制 false。导入的标签若本地已有相同内容则复用，不重复创建。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:836`

### 11. 人设卡生成历史：按卡隔离的对话槽位

`PersonaCardChatHistoryManager` 用独立 DataStore `persona_card_chat_history`，以 `chat_history_{角色卡ID}` 为键、用 Gson 存取消息列表，给“人设卡生成”界面提供每张卡独立的对话历史槽位，互不串台。
`app/src/main/java/com/ai/assistance/operit/data/preferences/PersonaCardChatHistoryManager.kt:49`

## 关键符号

- `CharacterCard`：角色卡数据模型（Room Entity，表 `character_cards`）
- `CharacterCardManager`：角色卡的增删改查、提示词拼接、导入导出、备份恢复
- `combinePrompts`：把角色卡各字段按固定顺序拼成系统提示词
- `CharacterGroupCard` / `GroupMemberConfig`：群组卡与成员配置数据模型
- `CharacterGroupCardManager`：群组卡的增删改查、复制、拼图头像
- `CharacterCardToolAccessConfig`：角色卡工具白名单配置（四份名单 + 总开关）
- `CharacterCardToolAccessResolver` / `ResolvedCharacterCardToolAccess`：白名单解析器与解析结果
- `WaifuPreferences`：Waifu 模式参数（含按卡/群组隔离的前缀存储）
- `WaifuMessageProcessor`：Waifu 模式消息呈现引擎（分句、打字机延迟、表情包标签处理）
- `StreamingSession`：流式分句一致性会话（已发出句子不回滚）
- `WaifuModeSettingsScreen`：Waifu 模式设置界面（保存时同步写回当前卡/群组）
- `ActivePrompt`：密封接口，`CharacterCard(id)` / `CharacterGroup(id)` 两种当前生效目标
- `ActivePromptManager`：裁定当前生效目标，维护群组与角色卡互斥
- `PersonaCardChatHistoryManager`：人设卡生成界面的按卡隔离对话历史
- `CharacterCardBilingualData`：默认人格的中英双语模板
- `TavernCharacterCard` / `OperitTavernExtension`：酒馆卡格式与 Operit 无损载荷（schema `operit_character_card_v1`）

## 输入→处理→输出调用链

### 链路一：聊天时人格如何生效

1. 输入：`ConversationService` 组装系统提示词前，拿到本次对话的活跃角色卡 ID 与功能类型（聊天/语音）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt:517`
2. 处理：`CharacterCardManager.combinePrompts` 从 `character_cards` DataStore 读出卡字段，按“角色设定 → 其他内容（语音/聊天二选一）→ 标签提示词 → 高级自定义”顺序拼成字符串。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:618`
3. 输出：返回完整提示词字符串，`ConversationService` 将其拼进系统提示词，随请求发给模型。
   `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt:530`

### 链路二：工具权限判定

1. 输入：`ToolRegistration.resolveCurrentRoleCardToolAccess()` 取出当前工具调用所属的角色卡 ID。
   `app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:185`
2. 处理：`CharacterCardToolAccessResolver.resolve` 读取该卡的 `toolAccessConfig`，与全局工具可见性取交集算出 `ResolvedCharacterCardToolAccess`。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardToolAccessResolver.kt:56`
3. 输出：`ToolExecutionManager` 用 `isBuiltinToolAllowed` / `isExternalSourceAllowed` 逐个判定工具调用放行或拦截。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardToolAccessResolver.kt:19`

### 链路三：切换角色卡

1. 输入：`ActivePromptManager.setActivePrompt(ActivePrompt.CharacterCard(id))`，或聊天绑定按卡名解析出目标。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/ActivePromptManager.kt:51`
2. 处理：写入 `active_character_card_id`，同时清空活跃群组（两者互斥）；`CharacterCardManager` 再调用 `switchToCharacterCardWaifuSettings`，把该卡的 Waifu 配置覆盖到全局键（无配置则清空）。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt:1406`
3. 输出：`activePromptFlow` 发出新值，下游（主题、头像、Waifu 参数）全部跟随切换。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/ActivePromptManager.kt:19`

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardManager.kt`（1435 行）：角色卡增删改查、提示词拼接、酒馆卡导入导出、备份恢复
- `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterGroupCardManager.kt`（502 行）：群组卡管理、拼图头像
- `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardToolAccessResolver.kt`（147 行）：工具白名单解析
- `app/src/main/java/com/ai/assistance/operit/data/preferences/WaifuPreferences.kt`（345 行）：Waifu 模式参数与按卡隔离
- `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt`（1045 行）：分句、打字机延迟、表情包标签处理、文本清洗
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/WaifuModeSettingsScreen.kt`（693 行）：Waifu 模式设置界面
- `app/src/main/java/com/ai/assistance/operit/core/config/FunctionalPrompts.kt`：waifu 情绪/自拍/自定义提示词规则文本
- `app/src/main/java/com/ai/assistance/operit/data/preferences/ActivePromptManager.kt`（167 行）：当前生效目标裁定
- `app/src/main/java/com/ai/assistance/operit/data/preferences/PersonaCardChatHistoryManager.kt`（108 行）：人设卡生成对话历史
- `app/src/main/java/com/ai/assistance/operit/data/preferences/CharacterCardBilingualData.kt`（322 行）：默认人格双语模板
- `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt`：角色卡、工具白名单、酒馆卡格式数据模型
- `app/src/main/java/com/ai/assistance/operit/data/model/CharacterGroupCard.kt`：群组卡数据模型
- `app/src/main/java/com/ai/assistance/operit/data/model/ActivePrompt.kt`：当前生效目标密封接口
- 调用方证据：`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt`（waifu 规则注入系统提示词）、`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`、`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt`（`waifu` 工具参数门控流式分句）、`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt`（合并发送）、`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt`（TTS 清洗）、`app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt`（回复通知清洗）
