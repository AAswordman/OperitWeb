---
title: 模型配置与提示词设置
module: 设置 / app
sources: 8
date: 2026-10-01
---

# 模型配置与提示词设置（ui-settings-model）

## 概述

本页覆盖 Operit「模型配置」整套设置界面：8 个 Kotlin 文件、11,349 行。ModelConfigScreen 是总装页面——顶部是配置档案管理（新建 / 重命名 / 删除 / 下拉切换当前配置），下方按顺序挂载 6 个设置区块，首个为 `ModelApiSettingsSection`（API 接入：供应商、端点、Key、模型）（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:792` 起依次挂载），之后依次为 ContextSummarySettingsSection（上下文长度与自动摘要）、ThinkingConfigurationsSection（思考强度规则）、ModelParametersSection（采样参数）、CustomHeadersSettingsSection（自定义请求头）、AdvancedSettingsSection（高级：Key 池与请求队列）。

贯穿所有区块的是一套防抖自动保存机制（`ModelConfigAutoSaveSupport.kt`）：输入停止 700ms 后自动落盘，离开页面或熄屏时统一刷盘，避免用户逐项点保存。

另有两个独立页面同属本主题：`ModelPromptsSettingsScreen`（角色卡 / 标签 / 群组三标签页，3531 行）负责"AI 扮演谁、说什么话"；`MnnModelDownloadScreen`（648 行）负责下载端侧 MNN 模型。

## AI 速览

- **核心符号**：`ModelConfigScreen`（总装页）、`ModelConfigSaveCoordinator`（保存协调器）、`DebouncedModelConfigAutoSaveEffect`（防抖自动保存）、`ModelApiSettingsSection`（API 接入）、`ApiKeyVisualTransformation`（Key 遮盖）、`ModelParametersSection`（采样参数）、`ThinkingConfigurationsSection`（思考规则）、`AdvancedSettingsSection`（Key 池）、`CustomHeadersSettingsSection`（自定义请求头）、`ContextSummarySettingsSection`（上下文与摘要）、`ModelPromptsSettingsScreen`（角色卡/标签/群组）、`MnnModelDownloadScreen`（MNN 下载）。
- **主入口**：`ModelConfigScreen(navigateToMnnModelDownload, entryMode)`；`entryMode=CHAT_ONBOARDING` 时拦截返回键做首次引导绑定。
- **数据流向一句话**：用户在各区块改 UI 状态 → `DebouncedModelConfigAutoSaveEffect` 防抖 700ms（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:165`）→ 经 ModelConfigManager 持久化 → 调 EnhancedAIService.refreshAllServices 刷新运行中的 AI 服务。

## 核心机制

### 1. 自动保存协调（ModelConfigSaveCoordinator）

防抖自动保存是"输入停止一会儿再写盘"：用户每敲一个字符不直接写文件，而是等 700ms 没新输入了才真正持久化，避免频繁写盘。

- 全局单例协程作用域 `modelConfigSaveCoordinatorScope = SupervisorJob() + Dispatchers.Main.immediate`，某个保存任务失败不牵连其他任务（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:25`）。
- `ModelConfigSaveCoordinator.saveActions` 是 `LinkedHashMap<String, suspend (Boolean) -> Unit>`：key 是保存键，value 是真正的落盘动作（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:63`）。
- `RegisterModelConfigSaveAction` 在 `DisposableEffect` 里注册（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:148`）。
- 离开组合时先 `flushInBackground(key, false)` 把最后一次改动刷盘再注销（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:156`）。
- `DebouncedModelConfigAutoSaveEffect`：跳过初始值、防抖、去重、只保留最后一次写入（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:165`）。
- 数据流为 `snapshotFlow { valueProvider() }.drop(1).debounce(debounceMillis).distinctUntilChanged().collectLatest { value -> latestPersist(value) }`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:177`）。
- `discardConfig(configId)` 按 `":$configId"` 后缀匹配，一次清除该配置名下所有保存动作（删除配置时调用）（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:51`）。
- `flushAll` 先 join 全部后台刷盘任务，再逐个执行已注册动作并收集第一个失败；结束时若有未解决的失败则抛出（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt:63`）。
- 各区块保存键：API 设置用 `"api:${config.id}"`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:351`）、Key 池用 `"api-key-pool:${config.id}"`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:131`）、思考配置用 `"thinking-config:${config.id}"`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:1138`）、自定义请求头用 `"headers:${config.id}"`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:1942`）。
- 页面 `ON_STOP`（熄屏/切后台）时 `flushAllInBackground(showSuccess = false)` 静默刷盘（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:359`）。

### 2. API 接入设置（ModelApiSettingsSection，2197 行）

这是单个配置里最长的区块，管"连哪家 AI、用什么 Key、调哪个模型"。

- UI 状态快照 `ApiAutoSaveState` 是 18 字段数据类；`persist()` 用 `modelApiSettingsSaveMutex` 加锁后切 `Dispatchers.IO`，调 `configManager.updateApiSettingsFull` 写盘，再 `EnhancedAIService.refreshAllServices` 让运行中的服务立即用上新配置（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:272`）。
- `buildAutoSaveState()` 做输入兜底：MNN 线程数、llama 线程数（<1 则 4）、上下文大小（<1 则 2048）、GPU 层数（<0 则 0）（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:304`）。
- 供应商切换时：首次进入保留已持久化的端点；切到 Codex 时强制重置为默认端点；带默认模型名的供应商切换时重置模型名。`syncMoonshotModelForEndpoint`：Moonshot 端点为 `api.kimi.com/coding/v1` 时自动把模型名同步为 `kimi-for-coding`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:379`）。
- UI 按供应商类型分四支：MNN 显示前向类型（CPU / OpenCL / Auto / OpenGL / Vulkan，经 `forwardTypeName` 映射）（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:1958`）+ 线程数 + 模型下载入口；llama.cpp 显示线程数 / 上下文 / GPU 层数；Codex 显示 OAuth 登录块且端点框禁用；其余供应商显示端点输入（自动去空白）、端点下拉。
- 端点输入框下方用 `EndpointCompleter.completeEndpoint` 预览实际请求 URL（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:727`）。
- API Key 输入框：为空时显示占位提示；输入自动去掉空格和换行；**聚焦或为空时明文显示**，失焦且非空才用 `ApiKeyVisualTransformation()` 遮盖（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:761`）。
- 模型名支持逗号分隔多选；`fetchAvailableModels()` 按供应商拉取可用模型列表（Codex / MNN / llama / ToolPkg 插件 / 通用），模型对话框支持搜索 + Checkbox 多选，按列表顺序 `joinToString(",")`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:612` 附近）。
- 选中 Codex 时强制 `directImage=true`、`audio/video=false`、`toolCall=true`；另有开关：直接图片/音频/视频处理、Gemini 谷歌搜索、DeepSeek 联网搜索、Claude 1 小时缓存、Tool Call。
- Codex 额度胶囊：5 小时 / 7 天两个窗口，`remainingPercent / 100f` 画进度条，重置倒计时按 60 秒 tick 刷新。
- 地域告警：`ProviderRegionWarningType{OVERSEAS, INTERNATIONAL_PROXY}`——OpenRouter / 4Router 标"国际中转"，OpenAI / XAI / Google / Anthropic / Mistral / NVIDIA / Nous 标"海外"；仅当 `LocationUtils.isDeviceInMainlandChina` 为真时显示横幅（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt:86`）。
- 供应商选择器分两组：通用兼容组（按 `genericCompatibleProviderOrder` 排序：OPENAI_GENERIC、OPENAI_RESPONSES_GENERIC、GEMINI_GENERIC、ANTHROPIC_GENERIC）+ 专有组（含 ToolPkg 插件供应商）；`ApiProviderDialog` 带搜索框；`getProviderColor` 给每个供应商配主题色。

### 3. Key 遮盖（ApiKeyVisualTransformation，40 行）

`VisualTransformation` 实现（Compose 文本框的"显示变换"：只改变显示样子，不改变实际文本）：长度 > 8 时首 4 字符和尾 4 字符明文、中间全部换成 `*`；长度 ≤ 8 直接显示原文；`OffsetMapping` 恒等 1:1（光标位置不变）（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ApiKeyVisualTransformation.kt:8`）。

### 4. 思考配置规则（ThinkingConfigurationsSection）

"思考配置"让用户给不同模型定制思考强度控件（比如 reasoning_effort 滑块）：

- 规则编辑器 `ThinkingRuleEditor`：id / 启用开关 / 供应商 id 列表 / 匹配字段 / 匹配值 / 控件类型 / 默认请求路径 / 是否强制开启 / 开启-关闭写入动作 / 滑块档位；新建规则默认档位 low / high / max（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:1038`）。
- 控件二选一：`levels`（多档滑块）/ `toggle_only`（仅开关），反序列化时 `toggle` 归一为 `toggle_only`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:1788`）。
- 匹配方式 9 种：`modelContains`（模型包含）、`modelPrefix`（模型前缀）、`modelSuffix`（模型后缀）、`modelRegex`（模型正则）、`firstSegment`（斜杠前段）、`lastSegmentPrefix`（后段前缀）、`lastSegmentContains`（后段包含）、`lastSegmentRegex`（后段正则）、`endpointSuffix`（端点后缀）（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:1077`）。
- 序列化：id 为空时默认 `custom-thinking-${index + 1}`；匹配写成 `{字段: [值数组]}`；开启/关闭动作写成 `{path, value}` 数组；档位逐项写 `{id, label, path, value}`。
- 反序列化兼容旧格式：`thinkingRulesArray` 支持数组、`{rules:[...]}`、单对象三种形态；`control` 的 `"toggle"` 归一为 `toggle_only`；供应商字段兼容 `providers` 与 `providerTypeIds`；`required` 兼容 `reasoningRequired`。
- `parseThinkingEditorValue` 按内容还原类型：true/false/null/整数/长整数/小数/`{...}`/`[...]`，否则按字符串。
- 保存前用 `ThinkingQualityMappingRegistry.validateConfigurations` 校验 JSON，非法则显示错误并抛 `IllegalArgumentException` 中止保存（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:1122`）。
- 规则卡片可上下移动排序；档位列表支持长按拖拽排序（`ReorderableItem`）。

### 5. 采样参数（ModelParametersSection，1488 行）

- 7 个标准参数：max_tokens / temperature / top_p / top_k / presence_penalty / frequency_penalty / repetition_penalty，每个经 `when(definition.id)` 映射到 config 对应字段并带独立 Enabled 开关（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelParametersSection.kt:108`）。
- 自定义参数存在 `config.customParameters` JSON 字符串里，用 `ignoreUnknownKeys` + `isLenient` 宽容解码为 `CustomParameterData`。
- `ParameterValueType{INT, FLOAT, STRING, BOOLEAN, OBJECT}` 决定编辑控件形态；`ParameterCategory{GENERATION, CREATIVITY, REPETITION, OTHER}` 决定分到 4 个 Tab（Crossfade 切换）中的哪一个（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelParametersSection.kt:381`）。
- temperature 参数（`apiName == "temperature"`）下方挂载 `TemperatureRecommendationRow`，推荐值写死为 "1.3"（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelParametersSection.kt:615`）。
- `resetParameters` 一键全部回默认值并禁用（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelParametersSection.kt:322`）。
- 所有增删改都经 `configManager.updateParameters` 落盘（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelParametersSection.kt:372`）。
- `AddCustomParameterDialog`：新建时 apiName 由名称自动生成（空格转下划线 + 小写，`:834`）；apiName / 描述 / min / max 输入框只在编辑模式可见；OBJECT 类型输入时实时校验 JSON 合法性。

### 6. 高级设置（AdvancedSettingsSection，726 行）

- **API Key 池**：`useMultipleApiKeys` 开关 + `apiKeyPool: List<ApiKeyInfo>`；保存经 `configManager.updateApiKeyPoolSettings` + `EnhancedAIService.refreshAllServices`；保存前 `keyAvailabilityTester.pauseAndJoin()` 先停掉正在跑的可用性测试；OPENAI_CODEX 供应商隐藏整个 Key 池 UI（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:104`）。
- **请求队列控制**：每分钟请求数 / 最大并发数，输入只保留数字；`snapshotFlow.drop(1).debounce(700).distinctUntilChanged()` 防抖后写入（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:157`）。
- 写入经 `configManager.updateRequestQueueSettings`；非法输入按 0 处理（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:146`）。
- **导出**：`exportKeyPoolToUri` 把全部 Key 用换行拼成**明文**写到用户选定的文件 URI（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:176`）。
- 导出目标文件经 `CreateDocument("text/plain")` 由用户选择（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:227`）。
- **导入**：`ACTION_GET_CONTENT` 选 `text/*` 文件，逐行 trim、去空行，名称默认取 Key 末 4 位（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt:527`）。
- 列表最多直接编辑 20 个 Key（`maxEditableKeys = 20`，`:382`），超出只显示计数；可用性测试 `startOrResume(concurrency = 5)` 并发测活，状态分 AVAILABLE / UNAVAILABLE / UNTESTED 三种图标（`:460`）。
- 列表项显示 `"名称 (...末4位)"`（`:640`）；编辑对话框默认名 `"API Key 末4位"`（`:710`）；Key 为空时禁止保存。

### 7. 自定义请求头（CustomHeadersSettingsSection）

- `parseHeaderEntries` 把 JSON 字符串解析为 `List<Pair<String,String>>`，非法 JSON 返回空列表不崩溃（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:137`）。
- `serializeHeaderEntries` 把请求头列表序列化为 JSON 字符串（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:152`）。
- 6 个预设：安卓浏览器 UA、桌面 Windows 浏览器 UA、中文语言、英文语言、移动网关（`X-Forwarded-For: 211.136.1.10` + `Via: CMNET`）、美国 LA（`Accept-Language` + `X-Forwarded-For: 38.107.226.5`）；预设按 header 名合并进现有列表（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:90`）。
- 保存键 `"headers:${config.id}"`，防抖自动保存 + `Mutex` 串行写盘后刷新全部 AI 服务（`:1934`）。

### 8. 上下文与摘要（ContextSummarySettingsSection）

- 上下文长度 / 最大上下文长度，单位 K；输入非法（非数字或 ≤0）显示错误且不保存；与当前值一致时跳过写入（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:2191`）。
- 摘要设置：总开关；token 占比阈值必须在 (0, 1) 开区间内；按消息数触发时消息数必须 > 0；关闭总开关直接写 `enableSummary=false`（`:2223`）。
- `formatFloatValue`：整数值去小数点，否则保留两位小数（`:2528`）。

### 9. 连接测试

- 测试前 `saveCoordinator.flushAll(showSuccess = false)` 先把未落盘的改动刷盘，再调 `ModelConfigConnectionTester.run(context, configManager, config, onActiveServiceChanged)`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:580`）。
- 测试项：CHAT / TOOL_CALL / IMAGE / AUDIO / VIDEO；结果：PASSED（绿）/ UNVERIFIED（黄）/ FAILED（红）；测试中按钮变"取消"，调 `cancelStreaming()` + `connectionTestJob?.cancel()` 中止。
- `ConnectionTestItem.statusText` 按类型取成功文案，失败时拼上 error 信息。

### 10. 配置档案管理与引导模式

- 新建（`createConfig`）/ 重命名（`updateConfigBase`）/ 删除（`deleteConfig`）；id 为 `"default"` 的配置不显示重命名/删除按钮。
- 删除流程：先 `flushAll`，再 `deleteConfig`（返回受影响的功能类型），`discardConfig` 清掉该配置的保存动作，对每个受影响功能调 `EnhancedAIService.refreshServiceForFunction` 刷新服务。
- `CHAT_ONBOARDING` 模式用 `RegisterRouteBackGuard` 拦截返回键（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:260`）。
- 引导返回处理中先 `saveCoordinator.flushAll` 刷盘（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:268`）。
- 再经 `ChatConfigReadiness.evaluate` 检查 7 类就绪问题（PROVIDER_MISSING / PROVIDER_UNAVAILABLE / ENDPOINT_INVALID / MODEL_MISSING / CODEX_LOGIN_REQUIRED / API_KEY_MISSING / API_KEY_INVALID），不就绪则阻止返回（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:296`）。
- 就绪后调 `functionalConfigManager.setConfigForFunction(CHAT, targetConfigId, targetModelIndex)` 绑定对话功能并刷新聊天服务（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt:325`）。

### 11. 角色卡 / 标签 / 群组（ModelPromptsSettingsScreen，3531 行）

"提示词设置"管 AI 的身份与说话方式，三标签页：角色卡 / 标签 / 群组。

- 管理器均为单例：`CharacterCardManager` / `CharacterGroupCardManager` / `ActivePromptManager` / `PromptTagManager` / `UserPreferencesManager`。
- 角色卡排序 `CharacterCardSortOption{DEFAULT, NAME_ASC, CREATED_DESC}`（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelPromptsSettingsScreen.kt:1962`）。
- 排序选择经 `rememberLocal` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelPromptsSettingsScreen.kt:1992`）。
- 头像：`CropImageContract` 1:1 裁剪（PNG、质量 90），拷入内部存储命名 `"avatar_${card.id}"`，经 `activePromptManager.saveAiAvatarForPrompt` 绑定到角色卡。
- 导入：文件选择器 `*/*`；PNG 走 `createCharacterCardFromTavernPng`（读 PNG tEXt 块里的酒馆卡数据），JSON 走 `createCharacterCardFromTavernJson`，未知类型先试 JSON 再试 PNG；导入成功后自动把原图设为头像（`:284`）。
- 彩色二维码导入：`handleColorQrImportFromUri` 对"裁剪出的二维码区 + 原图"分别做多档缩放后调 `ColorQrCodeUtil.decodeToString` 解码；也支持相机直拍（`TakePicture` + `FileProvider` 临时文件）（`:358`）。
- 导出三模式 `ExportMode{TAVERN_JSON, TAVERN_PNG, COLOR_QR}`（`:1968`）：JSON 直存 `Downloads/Operit/exports`；PNG 用 `insertTavernTextChunk` 把 JSON 做 Base64 后塞进 PNG 的 `tEXt`/`chara` 块（头像居中裁成 512px 做底图）；彩色码用 `ColorQrCodeUtil.generate(text, colorCount, moduleSizePx=10, marginModules=4)` 生成，颜色数 2/4/8/16 可选，存 `Pictures/Operit`。
- 标签导入导出：格式标识 `"operit_prompt_tags"` version 1（`:3305`）；导入按名称小写匹配，已存在则更新、否则新建，返回 created / updated / skipped 计数（`:3318`）。
- 复制角色卡：新 ID + 名称加后缀 + `cloneBindingsFromCharacterCard` 复制绑定关系（`:717`）；改名或删卡后弹出"去聊天管理看看"提示；删除当前活跃群组时自动回退到默认角色卡；`resetDefaultCharacterCard` 恢复默认卡（`:701`）。
- 列表预览：角色设定 / 聊天其他内容 / 高级自定义提示词各取前 40 字；附着标签最多显示 3 个，超出显示 `+N`。

### 12. MNN 模型下载（MnnModelDownloadScreen，648 行）

- `MnnModelDownloadManager.getInstance(context).fetchModelList()` 拉取模型列表；失败显示错误信息 + 重试按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/MnnModelDownloadScreen.kt:66`）。
- 搜索框按模型名 / 描述 / tags 忽略大小写过滤。
- 下载源优先级：`sources["ModelScope"]` → `sources["HuggingFace"]` → 第一个源；URL 为空时下载按钮禁用（`:274`）。
- `DownloadState` 六态分支：Idle/Completed（已下载显示删除、未下载显示下载）、Connecting（转圈）、Downloading（进度条 + 暂停按钮）、Paused（继续 + 删除）、Failed（显示错误 + 重试）。
- 删除权限 `canDelete`：Completed / Failed / Paused 可删；Idle 看 `isModelDownloaded`；下载中/连接中不可删（`:268`）；删除走确认对话框 → `deleteModel`。

## 关键符号

- `ModelConfigScreen` —— 模型配置总装页：档案管理 + 6 区块挂载 + 连接测试 + 引导模式。
- `ModelConfigSaveCoordinator` —— 保存协调器：注册/注销保存动作、刷盘、丢弃已删配置的动作。
- `DebouncedModelConfigAutoSaveEffect` —— 防抖自动保存：snapshotFlow + drop(1) + debounce(700) + distinctUntilChanged + collectLatest。
- `RegisterModelConfigSaveAction` —— DisposableEffect 注册保存动作，离开时先刷盘再注销。
- `ModelApiSettingsSection` —— API 接入区块：供应商/端点/Key/模型/本地推理参数/开关/额度。
- `ApiAutoSaveState` —— API 区块的 18 字段 UI 快照。
- `ApiKeyVisualTransformation` —— Key 遮盖：>8 位首4+尾4明文、中间星号。
- `ModelParametersSection` —— 采样参数区块：7 标准参数 + 自定义参数。
- `ThinkingRuleEditor` —— 思考规则编辑器数据类（9 匹配字段、2 控件类型）。
- `AdvancedSettingsSection` —— 高级区块：Key 池、请求队列、Key 导入导出。
- `CustomHeadersSettingsSection` —— 自定义请求头区块：键值对编辑 + 6 预设。
- `ContextSummarySettingsSection` —— 上下文长度与自动摘要区块。
- `ModelConfigConnectionTester` —— 连接测试执行器：CHAT/TOOL_CALL/IMAGE/AUDIO/VIDEO 五项。
- `ChatConfigReadiness` —— 引导模式就绪检查：7 类问题枚举。
- `ModelPromptsSettingsScreen` —— 角色卡/标签/群组三标签页。
- `ExportMode{TAVERN_JSON, TAVERN_PNG, COLOR_QR}` —— 角色卡导出三模式。
- `MnnModelDownloadScreen` —— MNN 端侧模型下载页。
- `DownloadState` —— 下载六态：Idle/Connecting/Downloading/Paused/Completed/Failed。

## 输入→处理→输出调用链

1. **改 API 设置并自动保存**：用户在 `ModelApiSettingsSection` 输入 → `ApiAutoSaveState` 快照经 `valueProvider` → `DebouncedModelConfigAutoSaveEffect`（700ms 防抖、去重）→ `flushSettings` → `persist()`（Mutex + IO 线程 `updateApiSettingsFull`）→ `EnhancedAIService.refreshAllServices` → 运行中的 AI 服务立即生效。
2. **离开页面兜底**：熄屏/切后台触发 `ON_STOP` → `saveCoordinator.flushAllInBackground(false)` → `runCatching { flushAll }` → join 后台任务后逐个执行各区块保存动作。
3. **删除配置**：点删除 → `flushAll` 先落盘 → `configManager.deleteConfig`（返回受影响功能）→ `discardConfig` 按 `":id"` 后缀清保存动作 → 逐个 `refreshServiceForFunction`。
4. **首次引导绑定**（CHAT_ONBOARDING）：返回键被 `RegisterRouteBackGuard` 拦截 → `flushAll` → `ChatConfigReadiness.evaluate`（7 类就绪检查）→ 不就绪 snackbar 提示并阻止返回；就绪 → `functionalConfigManager.setConfigForFunction(CHAT, id, modelIndex)` → `refreshServiceForFunction` → 允许返回。
5. **角色卡酒馆 PNG 导入**：选文件 → `importTavernCharacterCardPng` → `createCharacterCardFromTavernPng` 解析 tEXt 块 → 建卡 → 自动把原图拷为头像 → `refreshTrigger++` 刷新列表。
6. **MNN 模型下载**：进页 `fetchModelList` → 选模型按 ModelScope > HuggingFace 优先级取 URL → `downloadModel` → `DownloadState` 流驱动进度/暂停/失败/删除 UI。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ApiKeyVisualTransformation.kt`（40 行）：Key 遮盖变换。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/ModelConfigAutoSaveSupport.kt`（190 行）：保存协调器 + 防抖自动保存。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/AdvancedSettingsSection.kt`（726 行）：Key 池、请求队列、Key 导入导出。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelParametersSection.kt`（1488 行）：采样参数 7+自定义。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ModelApiSettingsSection.kt`（2197 行）：API 接入设置。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelConfigScreen.kt`（2530 行）：总装页、思考规则、请求头、上下文摘要、连接测试、引导模式。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ModelPromptsSettingsScreen.kt`（3531 行）：角色卡/标签/群组。
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/MnnModelDownloadScreen.kt`（648 行）：MNN 模型下载。

合计 8 文件 11,349 行，源码取自 Operit @ `dbf71916`（2026-10-01）。

原子事实见 `ui-settings-model.facts.json`（126 条，引用逐条验真）；代码走查见 `ui-settings-model.quality.json`（10 条：高危 2 / 警告 6 / 建议 2）。
