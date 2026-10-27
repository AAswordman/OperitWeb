---
title: 偏好与其他设置界面
module: 设置 / 杂项
sources: 14
date: 2026-10-01
---

# ui-settings-misc（偏好与其他设置界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/settings/`（14 个 Kotlin 文件，约 9,989 行）@ `dbf71916`

> 覆盖设置主页（导航中枢）、外部 HTTP 聊天、GitHub 账号、人设卡生成小助手、标签市场、工具权限、记忆空间档案管理、语音服务（TTS/STT）、Waifu 模式，以及角色卡编辑/分配对话框与头像选择器。

## 概述

Operit 的设置体系以 `SettingsScreen` 为导航中枢：它本身不存业务状态，只做分组与跳转——8 个分组、19 个导航回调，把用户送往各功能设置页。真正的"杂项"设置页各管一摊：

- **外部 HTTP 聊天**：把手机变成局域网里的一个 HTTP/A2A 服务端，对外暴露 `/api/external-chat` 等接口，可用 curl 或 adb 广播调用。
- **GitHub 账号**：只做登录态展示与退出，登录流程在弹窗 `GitHubLoginDialog` 里完成。
- **人设卡生成**：一个"角色卡小助手"聊天界面，用户用自然语言描述想要的角色，LLM 回复里夹带的 `<tool>` 调用会被自动执行，直接把字段写进角色卡。
- **标签市场**：无网络，13 条中英双语预设标签存在本地，点"添加"就复制进本地标签库。
- **工具权限**：全局三档开关（允许/询问/禁止，默认询问）+ 单工具差量覆盖；`package_proxy`、`proxy`、`search` 三个工具被硬编码排除在外。
- **用户偏好设置**：名字是"偏好"，实际是**记忆空间档案管理器**——多档案的新建/切换/删除，人设文档编辑器（Markdown 高亮），自动更新与锁定两个策略开关。
- **语音服务**：TTS 9 种引擎、STT 3 种引擎，全部走"档案（profile）"管理：新建/重命名/切换/删除；任何输入改动经 500ms 防抖自动落盘，没有保存按钮。
- **Waifu 模式**：二次元聊天的显示与行为开关（打字机效果、合并发送、自拍等），每次修改双写全局偏好和当前角色卡。
- **角色卡对话框**：1860 行的角色卡全字段编辑器（开场白一键翻译、模型/记忆空间两档绑定、四页签工具权限）；另有两个"分配"对话框（角色卡/角色组二选一绑定未绑定聊天），结构同构；`AvatarPicker` 是纯回调的头像选择器。

## AI 速览

- **核心符号**：`SettingsScreen`（导航中枢，19 回调）、`ExternalHttpApiPreferences`（外部聊天配置）、`LocalCharacterToolExecutor`（人设卡小助手的本地工具执行器，仅处理 `save_character_info`）、`ToolPermissionSystem`（权限持久化）、`SpeechServiceProfilesPreferences`（语音档案 DataStore）、`WaifuPreferences`（二次元模式偏好）、`CharacterCardDialog`（角色卡编辑器）。
- **主入口**：`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/SettingsScreen.kt:40`；各子页均为独立 Composable，经回调导航进入。
- **数据流向一句话**：设置页 UI 状态 → 各 `*Preferences` 单例/DataStore 落盘 → 需要即时生效的（如语音服务）调 `*Factory.resetInstance()` 重建运行时实例。

## 核心机制

### 1. 设置主页：纯导航中枢

`SettingsScreen` 接收 19 个 `() -> Unit` 导航回调，自己不持有业务状态。滚动位置存在文件级 `SettingsScreenScrollPosition`（`mutableStateOf(0)`），靠 `LaunchedEffect + snapshotFlow` 写回，跨重组保留。登录态来自 `GitHubAuthPreferences.isLoggedInFlow`：已登录显示 `@login` 并提供"退出"（直接 `githubAuth.logout()`），未登录显示"登录 GitHub"并弹 `GitHubLoginDialog`。8 个分组：账号与外部调用、个性化（用户偏好/语言/主题外观/全局显示/布局调整）、AI 模型配置（模型参数/功能模型/语音服务）、提示词（系统提示词/人设卡生成/Waifu 模式）、上下文和总结设置、数据和权限（工具权限/数据备份/聊天记录管理/Token 用量统计/性能监控）、隐私与数据清理（清除 Cookies）、外部调用。"清除 Cookies"确认后调 `CookiePrivacyManager.clearAllCookies()`。

### 2. 外部 HTTP 聊天：把手机变成局域网服务端

配置状态来自 `ExternalHttpApiPreferences` 单例。打开服务开关时先 `ensureBearerToken()`（无 token 则按 `UUID.randomUUID().toString().replace("-","")` 生成 32 位 hex），再启动服务；关闭时调 `AIForegroundService.stopExternalHttp(context)`。端口输入框只收数字、最多 5 位，保存时校验 1..65535（默认 8094），非法 Toast 提示。Token 最短 6 字符；"复制"按钮把完整 token 明文写剪贴板，"重置"后新 token 也自动进剪贴板。

页面把访问方式直接教给用户：本机 LAN IPv4 拼 `http://$ip:$savedPort`（**明文 HTTP**）；A2A 地址 `$baseUrl/.well-known/agent-card.json` 与 `$baseUrl/a2a`；同步示例 `POST /api/external-chat` 带 `Authorization: Bearer` 头；异步示例 `response_mode: async_callback` 加 `callback_url`；健康检查 `GET /api/health`；还有 adb 广播示例（action `com.ai.assistance.operit.EXTERNAL_CHAT`，参数 `request_id/message/show_floating/initial_mode/reply_package`）。该广播接收器 `ExternalChatReceiver` 在 manifest 里 `exported="true"` 且无权限保护（见代码走查）。

### 3. GitHub 账号：只展示与退出

无参数页面，登录态与用户信息分别来自 `GitHubAuthPreferences.isLoggedInFlow` / `userInfoFlow`。头像用 coil 加载（72dp 圆形裁剪），信息卡展示 id / publicRepos / followers / following，email 与 bio 非空才显示。退出时先 `clearGitHubOAuthBrowserSession()` 清 OAuth 浏览器会话，再 `githubAuth.logout()`——注意设置主页的"退出"项少了清会话这一步，两条路径不一致（见代码走查）。

### 4. 人设卡生成：LLM 直写角色卡的小助手

顶层 `PersonaCardGenerationScreen` 内藏私有对象 `LocalCharacterToolExecutor`——"本地最小工具执行器"，只认 `save_character_info` 这一个工具名。流程：用户消息 → 历史经 `toPromptTurns()` 转 `PromptTurns` → `EnhancedAIService.getInstance(context).getAIServiceForFunction(FunctionType.CHAT)` 拿服务 → 流式回复。显示前用正则剥掉 `<tool>`、`<toolResult>`、`<status>` 块；**流结束后对原始缓冲调 `processToolInvocations`，用 `ChatMarkupRegex.toolCallPattern` 正则提取工具调用，在 `Dispatchers.IO` 上 `manager.updateCharacterCard` 直接写库**，无用户确认（见代码走查）。字段白名单 8 个（name/description/characterSetting/openingStatement/otherContentChat/otherContentVoice/advancedCustomPrompt/marks），`otherContent` 是 `otherContentChat` 的别名，越界字段回 `error_unsupported_field`。

对话上限 `MESSAGE_LIMIT = 40`（按条数）；卡片 7 字段全非空则 `isCharacterCardComplete()` 为 true，再发消息直接回"已完成"。聊天历史按角色卡 id 经 `PersonaCardChatHistoryManager` 持久化。右侧抽屉（`ModalNavigationDrawer`）是角色卡配置编辑器；非默认卡才有删除按钮；新建卡用 `CharacterCardBilingualData` 的默认文案。系统提示词按系统语言是否中文切换（`FunctionalPrompts.personaCardGenerationSystemPrompt(useEnglish)`）。

### 5. 标签市场：本地预设，一键复制

无网络。`PresetTagBilingual` 存中英两套 name/description/promptContent/category（10 个字符串字段），`isChineseLocale` 判 `zh`/`zho`。`bilingualPresetTags` 共 13 条：语气风格（TONE）3 条、角色设定（CHARACTER）3 条、特殊功能（FUNCTION）7 条。点"添加"调 `promptTagManager.createPromptTag(...)` 存入本地标签库，底部提示条 `delay(1500)` 自动消失。注意"剧情故事创作"预设让 LLM 按 `![image](https://image.pollinations.ai/prompt/{description})` 输出插图，该第三方图床 URL 硬编码出现 6 处（见代码走查）。

### 6. 工具权限：全局三档 + 差量覆盖

`CompactPermissionLevelSelector` 是公开可复用的三档选择器（ALLOW/ASK/FORBID）。全局开关默认 ASK，修改后 `saveMasterSwitch` 异步持久化到 `ToolPermissionSystem`。单工具权限是"覆盖"语义：只存偏离默认的条目，未覆盖的工具不显示、走 ASK；点已选中的档位会清除覆盖回退 ASK。`package_proxy`、`proxy`、`search` 硬编码排除在外，选工具对话框支持忽略大小写搜索、每行展示 `AIToolHandler` 提供的描述。

### 7. 用户偏好设置：记忆空间档案管理器

活跃档案 id 经 `activeMemorySpaceIdFlow` 订阅（初始 `"default"`），档案 id 与记忆空间 id 保持一致以兼容既有 ObjectBox 库与角色卡绑定。首次进入初始化仓库并确保默认档案存在。人设文档用 `BasicTextField` 编辑（等宽字体 + Markdown 语法高亮），长度上限 `MemorySpaceProfileDocumentRepository.MAX_CONTENT_CHARS`，超限字数变红、保存按钮禁用；草稿与已保存文本字符串比对判"未保存"；预览 Tab 用 `MarkdownTextComposable` 渲染。自动更新/锁定两个策略开关绑定 `MemorySpace.profileAutoUpdateEnabled/Locked`，改动经 `updateMemorySpace` 持久化、失败回滚。`default` 档案无删除项；删除走确认对话框调 `deleteMemorySpace`；系统返回键被 `BackHandler` 拦截，有未保存改动时弹丢弃确认；有未保存改动时禁止新建档案；新建后自动设为活跃。

### 8. 语音服务：9+3 引擎，全档案化管理

顶部 `SpeechServicesModeTabs` 的 TabRow 切 TTS/STT。TTS 9 种：系统（SIMPLE_TTS）、通用 HTTP、VITS（离线）、硅基流动、MiniMax、Mimo、豆包、OpenAI WS、OpenAI 兼容；STT 3 种：SHERPA_NCNN（离线，界面无配置项）、OpenAI、Deepgram。配置按档案管理：`ttsProfilesFlow` / `sttProfilesFlow` 收集，新建以当前档案为模板复制，只能删非当前档案。**所有输入经 500ms 防抖自动保存到 DataStore**（`speechServiceProfilesDataStore`），无保存按钮；保存成功调 `VoiceServiceFactory.resetInstance()` 与 `SpeechServiceFactory.resetInstance()` 即时生效；HTTP 头/响应流水线/VITS options 的 JSON 非法会阻止保存。

各引擎要点：语速/音调 Slider 均为 0.5~2.0（steps=5）；系统 TTS 语言标签空字符串=跟随系统，音色弹窗列表选；通用 HTTP 仅 GET/POST 二选一（POST 才显示请求体输入框），响应流水线用 `HttpTtsResponsePipelineStep` 的 DSL 文本解析；选豆包自动填默认接入点/音色并把 Content-Type 置 `application/json`，其 AppID/Token 输入框分别绑定 `ttsModelNameInput`/`ttsApiKeyInput`；VITS 配模型包路径+说话人 ID+options JSON；文本清洗支持自定义正则+5 种内置模板（单/双星号、英/中文括号、XML 标签）；OpenAI 兼容支持用当前 URL+Key 刷新搜索模型/音色列表（失败回退内置）；硅基流动/Mimo/豆包音色都是"预设下拉 + 自定义 ID 输入"两种方式。页签底部"测试 TTS"跳外部试听页，本页无内置播放。**各引擎 API Key/Token 以明文存未加密 DataStore**（见代码走查）。

### 9. Waifu 模式：双写全局偏好与角色卡

总开关来自 `enableWaifuModeFlow`（默认关）。`saveSettings` 每次修改同时写全局偏好并同步到当前激活角色卡/角色组（`saveCurrentWaifuSettingsToCharacterCard`；激活 prompt 是角色组时绑角色组）。打字机延迟默认 250ms（滑块 200~1000ms、39 步），界面按 `1000/charDelay` 换算字/秒显示；合并发送延迟滑块 500~10000ms、94 步。自拍开启才显示外貌提示词输入框；自定义提示词/外貌提示词输入框每次按键即保存；保存成功提示卡 2 秒消失；自定义表情管理经 `onNavigateToCustomEmoji` 跳转。

### 10. 角色卡对话框与头像选择器

`CharacterCardDialog`（1860 行）是角色卡全字段编辑器：名称/简介/角色设定/开场白/聊天附加内容/语音附加内容；标签 `attachedTagIds` 用 `FilterChip` 多选；开场白一键翻译调 `EnhancedAIService.translateText`（进行中禁用+转圈，异常被静默吞掉）；聊天模型绑定与记忆空间绑定各支持"跟随全局/固定"两档，固定模型配置失效自动回填首个可用；工具权限分内置工具/工具包/skill/MCP 四个页签，支持按 key/标题/副标题搜索，工具包选项自动过滤容器包；保存时若选了外部工具却没勾内置 `use_package` 则 Toast 并中止；非固定模式保存时 `chatModelConfigId=null`、`chatModelIndex=0`；头像从 `getAiAvatarForCharacterCardFlow(card.id)` 读；每个文本字段可进全屏编辑（`fullScreenEditField` 路由）。

`CharacterCardAssignDialog` / `CharacterGroupAssignDialog` 结构同构：显示未绑定聊天数（`missingChatCount`），无卡/组时提示先创建，确认按钮仅在"未进行中、已选中、列表非空"时可用，进行中双按钮禁用+转圈，无头像用名称首字占位（组用 `getAiAvatarForCharacterGroupFlow(group.id)`）。

`AvatarPicker`（86 行）纯回调委托：点圆形头像触发 `onAvatarChange`，重置按钮仅有头像时可用，`Uri.parse(avatarUri)` 交 coil 加载；不实现相册/拍照/裁剪/权限申请。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `SettingsScreen` | screens/SettingsScreen.kt:40 | 设置主页，19 个导航回调 |
| `ExternalHttpApiPreferences` | data/preferences/ExternalHttpApiPreferences.kt | 外部聊天配置单例（端口默认 8094、token 生成） |
| `ExternalChatReceiver` | integrations/intent/ExternalChatReceiver | 外部聊天广播接收器，manifest 导出无权限 |
| `LocalCharacterToolExecutor` | screens/PersonaCardGenerationScreen.kt:48 | 人设卡小助手本地工具执行器，仅 `save_character_info` |
| `bilingualPresetTags` | screens/TagMarketBilingualData.kt:68 | 13 条双语预设标签 |
| `ToolPermissionSystem` | — | 工具权限持久化（`saveMasterSwitch`/`saveToolPermission`/`clearToolPermission`） |
| `CompactPermissionLevelSelector` | screens/ToolPermissionSettingsScreen.kt:371 | 公开可复用的三档权限选择器 |
| `SpeechServiceProfilesPreferences` | data/preferences/SpeechServiceProfilesPreferences.kt | 语音档案 DataStore（`speechServiceProfilesDataStore`） |
| `VoiceServiceFactory` / `SpeechServiceFactory` | — | TTS/STT 运行时工厂，配置变更后 `resetInstance()` |
| `WaifuPreferences` | — | Waifu 模式偏好（含 `DEFAULT_WAIFU_MERGE_SEND_DELAY_MS`） |
| `CharacterCardDialog` | components/CharacterCardDialog.kt:60 | 角色卡全字段编辑器 |
| `AvatarPicker` | components/AvatarPicker.kt | 纯回调头像选择器 |

## 输入→处理→输出调用链

1. **外部 HTTP 聊天开关**：用户拨开关 → `ensureBearerToken()`（无则生成 32 位 hex）→ `AIForegroundService` 启动服务 → 外部经 `http://<lan-ip>:8094/api/external-chat`（Bearer 头）调用；关开关 → `AIForegroundService.stopExternalHttp(context)`。
2. **人设卡小助手**：用户输入 → 历史 `toPromptTurns()` → `getAIServiceForFunction(FunctionType.CHAT)` 流式回复（剥 `<tool>`/`<status>` 后显示）→ 流结束 `processToolInvocations` 正则提 `<tool>` → `LocalCharacterToolExecutor.executeSaveCharacterInfo` → `Dispatchers.IO` 上 `updateCharacterCard` 写库 → 主线程 `refreshData()`。
3. **语音配置修改**：任一输入框 `onValueChange` → 500ms 防抖 `LaunchedEffect`（JSON 非法则拦截）→ `SpeechServiceProfilesPreferences` 写 DataStore → `VoiceServiceFactory.resetInstance()` / `SpeechServiceFactory.resetInstance()` → 新配置即时生效。
4. **Waifu 设置修改**：输入框/滑块变更 → `saveSettings { waifuPreferences.saveXxx }` → 写全局偏好 + `saveCurrentWaifuSettingsToCharacterCard` 同步当前角色卡/组。
5. **工具权限变更**：全局开关 → `saveMasterSwitch`；单工具点选 → 本地 `toolPermissions` 乐观更新 + `saveToolPermission`/`clearToolPermission` 差量持久化。

## 来源

- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 种子文件（14）：`ui/features/settings/screens/` 下 SettingsScreen.kt、ExternalHttpChatSettingsScreen.kt、GitHubAccountScreen.kt、PersonaCardGenerationScreen.kt、TagMarketScreen.kt、TagMarketBilingualData.kt、ToolPermissionSettingsScreen.kt、UserPreferencesSettingsScreen.kt、SpeechServicesSettingsScreen.kt、WaifuModeSettingsScreen.kt；`ui/features/settings/components/` 下 CharacterCardDialog.kt、CharacterCardAssignDialog.kt、CharacterGroupAssignDialog.kt、AvatarPicker.kt
- 原子事实 212 条见 `ui-settings-misc.facts.json`；代码走查 43 条（高危 3 / 警告 14 / 建议 26）见 `ui-settings-misc.quality.json`
