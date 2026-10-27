---
title: 单元测试·api/core
module: 附录
sources: 74
date: 2026-10-01
issue: 121
---

# appendix-tests-unit-api-core（单元测试·api/core）

> 种子：`app/src/test/java/com/ai/assistance/operit/api/`（43 个 Kotlin 文件、234 个 @Test）+ `core/`（29 个 Kotlin 文件、471 个 @Test），共 72 文件、705 个 @Test @ `dbf71916`

> 覆盖聊天链路与工具引擎的单元测试：llmprovider 的端点补全、配置就绪、tool 调用历史配对、thinking 映射、取消与用量上报、媒体处理；enhance 的 tool 结果排序与 markup；library 的记忆窗口规划与分析协议；core 的 PromptTurn 操作、对话回顾、摘要提示词、calculator 表达式引擎、condition 条件求值、JS 运行时桥、MCP 注册、toolpkg 包管理。

## 概述

这批测试全部跑在 JVM 上（`app/src/test`），不依赖 Android 设备。

框架是 JUnit4：`@Test` 注解配 `assertEquals` 断言（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:9`）。

协程代码用 `runBlocking` 包裹成测试（`app/src/test/java/com/ai/assistance/operit/api/chat/enhance/OrderedToolResultsTest.kt:18`）。

需要 Android Context 的地方用 mockito-kotlin 的 `mock()` 伪造（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManagerTest.kt:109`）。

打桩全局静态对象用 `Mockito.mockStatic(AppLogger::class.java).use {}`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ProviderUsageCancellationTest.kt:175`）。

异常断言用 `@Test(expected = IllegalArgumentException::class)`（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionParserTest.kt:313`）。

测试按被测模块分文件组织：`api/chat/llmprovider/` 37 个文件覆盖各供应商适配逻辑；`api/chat/enhance/` 3 个文件测 tool 结果呈现；`api/chat/library/` 3 个文件测记忆；`core/tools/` 下 calculator 7 个、condition 7 个、javascript 2 个、mcp 1 个、packTool 4 个；`core/chat/` 7 个文件测对话回顾与 PromptTurn 操作；`core/config/` 1 个文件测摘要提示词。

整体风格偏"行为锁定"：大量用例把当前行为写成断言（端点补全规则、thinking 映射表、用量上报语义），改实现必须先改测试。

## AI 速览

- **核心符号清单**：EndpointCompleter、ChatConfigReadiness、OpenAiToolCallHistory、ClaudeOrderedToolHistory、StructuredToolCallBridge、ThinkingQualityMappingRegistry、GeminiThinkingConfig、ProviderUsageCancellation、ColdStreamCancellation、LocalGenerationEnd、MediaCapabilityProbe、MediaLinkParser、OrderedToolResults、ToolExecutionManager、ConversationMarkupManager、ChatMemoryWindowPlanner、ChatMemoryRebuildTimeScope、MemoryLibrary、Calculator、ExpressionContext、ExpressionParser、ExpressionNode、JsCalculator、ConditionEvaluator、JsRuntimeToolCall、JsToolPkgRegistration、McpServerRegistration、ToolPkgManager、ToolPkgApiDeclaration、ToolPkgMarketOriginCodec、PromptTurn、AIMessageManager、FunctionalPrompts。
- **主入口**：`@Test` 方法即入口，无统一 setup；各文件自给自足。
- **数据流向一句话**：构造输入（URL / Provider 配置 / 对话历史 / 表达式文本）→ 直接调用被测对象公开方法，或经反射调用私有方法 → `assertEquals` / `assertTrue` 断言输出，`@After` 清理全局状态。

## 核心机制

### 1. 端点补全（EndpointCompleter：7 个文件、44 个用例）

`rootUrl_appendsChatCompletions`：根 URL 补 `/v1/chat/completions`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:9`）。

`v1Path_appendsChatCompletionsSuffix`：已有 `/v1` 只补 `chat/completions` 后缀（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:23`）。

`customNonV1Path_isUnchanged`：非 v1 自定义路径保持不变（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:37`）。

`trailingHash_disablesCompletion`：末尾 `#` 禁用补全（hash bypass）（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:47`）。

`openAiResponsesRoot_appendsResponsesPath`：OpenAI Responses 根 URL 补 `/v1/responses`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:51`）。

`anthropicRoot_appendsMessagesPath`：Anthropic 根 URL 补 `/v1/messages`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:77`）。

`googleProvider_leavesEndpointUntouched`：Google / Gemini / MNN 的 endpoint 保持原样（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:108`）。

`queryOnlyRootUrl_stillCompletesFromEmptyPath`：只有 query 的根 URL，query 保留在补全路径之前（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:158`）。

trim 行为独立 3 个用例：外层空白先去除再补全（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTrimTest.kt:9`）。

Anthropic 路径：以 `anthropic/` 结尾补 `messages`，已有 `messages` 不变（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterAnthropicPathTest.kt:9`）。

Provider 特化：OpenAI 通用走 Responses 补全，Anthropic 通用走 messages 补全，Google 带 hash 返回去 hash 裸 URL（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterProviderSpecificTest.kt:9`）。

`completeEndpoint_keepsFullChatPathUntouched`：已有完整 `/v1/chat/completions` 路径原样返回；非 http(s) 的 `file:///tmp/test` 与非法带空格输入 `" invalid "` 同样不动（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterDefaultPathTest.kt:8`）。该文件共 4 个用例。

hash bypass 细化 3 个用例：默认、Anthropic、Responses 三种补全下，末尾 `#` 只被去掉，不再触发任何补全（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterHashControlTest.kt:9`）。

`baseUrlWithCustomPort_completesNormally`：带自定义端口的 `http://localhost:8080` 正常补全，嵌套路径 `/proxy/v1` 也能补；已有自定义路径 `/custom/chat` 保持不变（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterOpenAiStyleTest.kt:8`）。该文件共 3 个用例。

### 2. 配置就绪检查（ChatConfigReadiness）

`deepSeekWithChineseKey_isRejected`：中文 API key 被拒绝（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadinessTest.kt:18`）。

`codexWithoutOAuthLogin_isRejected`：Codex 未 OAuth 登录被拒绝（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadinessTest.kt:34`）。

`localProviderDoesNotRequireEndpointOrKey`：本地 provider（MNN）不需要 endpoint 与 key（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadinessTest.kt:76`）。

`registeredPluginOwnsItsConfigurationRequirements`：注册插件自带配置要求（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadinessTest.kt:91`）。

### 3. tool 调用历史配对

OpenAI：乱序返回的 tool 结果按 tool 名配对调用（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAiToolCallHistoryTest.kt:88`）。

OpenAI：配不上调用的结果被忽略，不抢占别人的 call id（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAiToolCallHistoryTest.kt:184`）。

Claude：有序流拆分成保存轮次后，tool 历史保持一致（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeOrderedToolHistoryTest.kt:37`）。

实现用反射拿私有方法 `buildSerializedHistory`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeOrderedToolHistoryTest.kt:90`）。

StructuredToolCallBridge：跨 provider 的乱序结果同样按 tool 名配对（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridgeHistoryTest.kt:52`）。

### 4. thinking 配置映射

`mapsModelOptionToGeminiLevel`：模型选项映射到 Gemini thinking level（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiThinkingConfigTest.kt:19`）。

`requestsThoughtSummariesForAnEnabledOption`：启用的选项请求 thought 摘要（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiThinkingConfigTest.kt:25`）。

Gemini function call 部件走 `thoughtSignature` 线路字段（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiThinkingConfigTest.kt:52`）。

`openAiUsesFiveNamedEffortValues`：OpenAI 用 5 个具名 effort 值（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMappingTest.kt:37`）。

`deepSeekChatRemainsInTheDeepSeekFamilyMapping`：deepseek-chat 保留在 DeepSeek 家族映射里（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMappingTest.kt:55`）。

`opencodeZhipuProviderSegmentUsesGlmEffortConfig`：OpenCode 智谱段用 GLM effort 配置（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeThinkingConfigurationTest.kt:17`）。

`enabledOptionsMapToXaiEfforts`：启用的选项映射到 xAI effort（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProviderReasoningTest.kt:30`）。

`defaultConfigUsesTheOfficialXaiEndpointAndModel`：默认用 xAI 官方端点与模型（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProviderReasoningTest.kt:11`）。

OpenAI reasoning effort 开关：chat 模型永不接收 `reasoning_effort`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAiChatReasoningEffortTest.kt:97`）。

DataStore 迁移测试用 `mutablePreferencesOf` 构造内存偏好验证（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAiChatReasoningEffortTest.kt:72`）。

### 5. 取消与用量上报

`token tracking cancellation before collection prevents delegate execution`：token tracking 在收集前取消，阻止 delegate 执行（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ColdStreamCancellationTest.kt:20`）。

`rate limited cancellation before collection prevents delegate execution`：rate limited 同样阻止 delegate 执行（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ColdStreamCancellationTest.kt:48`）。

`OpenAI streaming usage callback cancellation propagates unchanged`：OpenAI 流式 usage 回调的取消原样向上传播（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ProviderUsageCancellationTest.kt:45`）。

`cancel throws without emitting tool result or reporting usage`：`LocalGenerationEnd.end` 在取消时抛异常，不伪造 tool 结果（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEndTest.kt:23`）。

`normal stream termination is not treated as manual cancellation`：正常流终止不被当作手动取消（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProviderCancellationTest.kt:9`）。

### 6. 媒体处理

`imageMatch_requiresOnlyFullCode`：图片匹配要求完整 code，7k2q 与带空格的 7K2Q 通过，句子中的 code 与残缺 code 拒绝（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbeTest.kt:9`）。

`videoMatch_requiresFullCode`：视频匹配同样要求完整 code（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbeTest.kt:18`）。

`audioMatch_acceptsDigitsAndEnglishWords`：音频匹配接受数字与英文词（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbeTest.kt:27`）。

MediaLinkParser 拆成 8 个文件：image / media / file / noop / replacement / tag-order 分测（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserTest.kt:10`）。

image-ops（4 个用例）：替换图片链接后前后文本顺序保留（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserImageOpsTest.kt:10`）；多图片 id 按出现顺序提取（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserImageOpsTest.kt:23`）。

`hasImageLinks_ignoresAudioLinks`：`audio` 标签不被误判为图片链接（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserImageOpsTest.kt:19`）。

media-ops（4 个用例）：`replaceMediaLinks_skipsErrorIds`——id 为 `error` 的媒体标签替换结果为空字符串（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserMediaOpsTest.kt:10`）。

`hasMediaLinks_detectsVideoLink`：`video` 被计入媒体链接（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserMediaOpsTest.kt:19`）。

`hasMediaLinks_ignoresImageLink`：`image` 不被计入媒体链接（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserMediaOpsTest.kt:23`）。

file（1 个用例）：`extractsPdfFilenameAndRemovesFileLink`——解析 `file` 标签的 filename 并做 HTML 实体解码（`report&amp;one.pdf` → `report&one.pdf`），删除标签后前后文本只剩双空格（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserFileTest.kt:8`）。

noop（3 个用例）：纯文本无链接时，提取图片 id、提取标签、替换都原样返回（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserNoopTest.kt:9`）。

replacement（2 个用例）：替换回调后前后非链接文本原样保留；多个不同 id 的图片标签各被替换一次、顺序保留（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserReplacementTest.kt:8`）。

`extractImageLinkIds_supportsAttributesInEitherOrder`：标签属性顺序任意（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserTagOrderTest.kt:7`）。

`DeepSeek keeps history images readable through user image inputs`：DeepSeek 历史图片经 user image 输入保持可读（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProviderMediaRoleTest.kt:56`）。图片池用临时目录隔离，`@Before` 建、`@After` 删（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProviderMediaRoleTest.kt:38`）。

`plaintext reasoning is preserved and replayed before function calls`：明文 reasoning 在 function call 前保留并重放（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekResponsesPayloadAdapterTest.kt:12`）。

`mapsPdfContentToResponsesInputFile`：PDF 内容映射为 Responses 的 input_file（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesFileInputTest.kt:10`）。

`dropsEmptyVideoUrlInsteadOfEmittingBlankPart`：空 video URL 被丢弃，不产生空白 part（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesVideoInputTest.kt:82`）。

`merge keeps one source per url while preserving extra metadata`：web search 来源按 URL 去重合并，保留额外元数据（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesWebSearchSourceTest.kt:74`）。

`values beyond int range stay exact instead of truncating`：超 int 范围的 usage 数值保持精确不截断（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesPayloadAdapterTest.kt:46`）。

`chat completions content field removes responses protocol markup`：chat 协议去掉 responses 标记（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProviderContentFieldTest.kt:12`）。

`parsesOpenCodeCatalogAndExpandsAllowedModes`：解析 OpenCode 模型目录并展开允许的模式（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/CodexModelListParserTest.kt:8`）。

`explicitOpenCodeModelsAreAllowed`：显式 OpenCode 模型被允许（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/CodexModelPolicyTest.kt:12`）。

### 7. enhance：tool 结果排序与 markup

`same-name calls publish in invocation order despite reversed completion`：同名调用逆序完成也按调用顺序发布（`app/src/test/java/com/ai/assistance/operit/api/chat/enhance/OrderedToolResultsTest.kt:18`）。

`cancellation does not fabricate a completed result from partial output`：取消不用部分输出伪造 completed 结果（`app/src/test/java/com/ai/assistance/operit/api/chat/enhance/OrderedToolResultsTest.kt:92`）。

`ensureOwnLine_startsToolResultOnItsOwnLineAfterStreamedToolCall`：tool 结果独占一行（`app/src/test/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManagerMarkupTest.kt:27`）。

`keeps every tool result while bounding each result independently`：每个 tool 结果独立限长、全部保留（`app/src/test/java/com/ai/assistance/operit/api/chat/enhance/ConversationMarkupManagerResultLimitTest.kt:14`）。

### 8. library：记忆窗口与分析协议

`plan keeps each normal user turn with its assistant response`：窗口规划保持 user / assistant 配对（`app/src/test/java/com/ai/assistance/operit/api/chat/library/ChatMemoryWindowPlannerTest.kt:13`）。

`plan keeps a multi-thousand-message chat bounded despite per-turn summaries`：2000+ 消息的对话仍有界（`app/src/test/java/com/ai/assistance/operit/api/chat/library/ChatMemoryWindowPlannerTest.kt:163`）。

时区写死：`ZoneId.of("Asia/Shanghai")` 与 `America/New_York`，不依赖机器时区（`app/src/test/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildTimeScopeTest.kt:13`）。

`parseAnalysisResult_rejectsLegacyPositionalArrayProtocol`：拒绝旧的 positional array 协议（`app/src/test/java/com/ai/assistance/operit/api/chat/library/MemoryAnalysisProtocolTest.kt:74`）。

### 9. calculator 表达式引擎（7 个文件、362 个用例）

表达式解析 96 个用例：数字、运算符优先级、括号、函数、三元、赋值全覆盖（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionParserTest.kt:24`）。

`division by zero returns infinity`：除零返回 Infinity（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionParserEdgeCaseTest.kt:17`）。

`coerceToNumber returns nan for invalid string`：非法字符串转数字得 NaN（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionContextTest.kt:87`）。

`binary division by zero returns infinity`：节点求值除零得 Infinity（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionNodeTest.kt:61`）。

变量表是全局状态，`@After` 调 `clearVariables` 清理（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionContextTest.kt:10`）。

`evaluate undefined variable throws`：JsCalculator 未定义变量抛异常（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/JsCalculatorTest.kt:55`）。

`clearVariables resets state`：清变量后 PI 恢复（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/CalculatorTest.kt:50`）。

ExpressionNodeEdgeCaseTest（27 个用例）：`binary operation with NaN left`——NaN 参与二元运算仍为 NaN（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionNodeEdgeCaseTest.kt:23`）。

`array access with negative index returns NaN`：数组负索引访问返回 NaN（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionNodeEdgeCaseTest.kt:72`）。

`function call node with unknown function throws`：调用未知函数抛 `IllegalArgumentException`（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionNodeEdgeCaseTest.kt:102`）。

`variable node with PI constant`：VariableNode("PI") 求值为 Math.PI（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionNodeEdgeCaseTest.kt:89`）。

模板字符串 "prefix42.0" 不可解析为 double 时求值为 NaN（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionNodeEdgeCaseTest.kt:77`）。

### 10. condition 条件求值（7 个文件）

`emptyExpression_defaultsToTrue`：空表达式默认 true（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorTest.kt:11`）。

`precedence_andBeforeOr`：and 优先级高于 or（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorTest.kt:51`）。

`loneOperator_returnsFalse`：解析失败返回 false 而非抛异常（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorParseFailureTest.kt:10`）。

`nullIsFalsyInBooleanContext`：null 在布尔上下文为 falsy（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorBooleanLogicTest.kt:21`）。

collection（4 个用例）：`in` 运算符支持 Kotlin 数组与字面集合；空集合为 falsy；集合缺值时 `in` 返回 false（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorCollectionTest.kt:9`）。

comparison（4 个用例）：数值 `<=` / `>` 与字符串 `==` / `!=` 的正反断言（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorComparisonTest.kt:9`）。

identifier（3 个用例）：非空字符串标识符为 truthy，空字符串为 falsy，非零数值为 truthy（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorIdentifierTest.kt:9`）。

literal-truthiness（3 个用例）：字面量 0 为 falsy（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorLiteralTruthinessTest.kt:9`）。

`nullLiteral_isFalsy`：null 字面量为 falsy（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorLiteralTruthinessTest.kt:17`）。

`nonZeroNumber_isTruthy`：字面量 1 为 truthy（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorLiteralTruthinessTest.kt:13`）。

### 11. JS 运行时 / MCP / toolpkg

`toolCall dispatches through the generic native bridge`：toolCall 经通用 native 桥分发（`app/src/test/java/com/ai/assistance/operit/core/tools/javascript/JsRuntimeToolCallTest.kt:9`）。

实现断言生成的 JS bundle 源码含 `callToolAsync`（`app/src/test/java/com/ai/assistance/operit/core/tools/javascript/JsRuntimeToolCallTest.kt:16`）。

`captures valid marketplace origin during registration`：注册期捕获 marketplace origin（`app/src/test/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistrationTest.kt:11`）。

`connecting a remote runtime does not expose the server to the AI`：连接 remote runtime 不暴露给 AI（`app/src/test/java/com/ai/assistance/operit/core/tools/mcp/McpServerRegistrationTest.kt:37`）。

`registering the server exposes the remote endpoint to the AI`：注册后才把远端 endpoint 暴露给 AI（`app/src/test/java/com/ai/assistance/operit/core/tools/mcp/McpServerRegistrationTest.kt:47`）。

`repeated registration keeps a single server entry`：重复注册只保留一条 server 记录（`app/src/test/java/com/ai/assistance/operit/core/tools/mcp/McpServerRegistrationTest.kt:60`）。

`execution context cannot be shared by different containers`：执行上下文不能被不同容器共享（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManagerTest.kt:16`）。引擎工厂用 `ArrayDeque.removeFirst()` 分发 mock 引擎（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManagerTest.kt:109`）。

`root hjson wins over every other manifest`：root hjson 优先于其他 manifest（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManifestSelectionTest.kt:32`）。

`blank declared API version is legacy version`：空声明版本视为 legacy（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgApiDeclarationTest.kt:10`）。

`encodes an ascii xor marker without readable author data`：marketplace origin 编码为无可读作者数据的 xor marker（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMarketOriginCodecTest.kt:10`）。

`buildChatMessageEventPayload contains all required message fields including variant index`：消息钩子发给 toolpkg 的事件 payload 含 chatId、sender、content、tokens、displayMode（序列化为 `"NORMAL"`）、selectedVariantIndex 等全部字段并逐一断言；第二个用例验证持久化后派发给 toolpkg 监听的是物化后的 variant 消息内容，而非占位原消息（`app/src/test/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgChatMessageHookBridgeTest.kt:12`）。

### 12. core/chat 与 core/config

`formatDialogueReviewHeader_usesDefaultHeaderWhenTitleIsBlank`：空标题用默认回顾头（`app/src/test/java/com/ai/assistance/operit/core/chat/AIMessageManagerDialogueReviewTest.kt:8`）。

PromptTurn 共 9 个文件（原 6 + 本次补 3）：

`fromRole_preservesToolName`（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnConversionTest.kt:8`）

`fromRole_mapsAiToAssistant`（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnKindTest.kt:8`）

`mergeAdjacentTurns_mergesAssistantTurns`（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnMergeTest.kt:18`）

`appendUserTurnIfMissing_doesNothingForBlankMessage`：空消息不追加轮次（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnAppendTest.kt:8`）

`mergeAdjacentTurns_mergesUserTurns`：相邻 user 轮内容以换行拼接成一轮（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnListOpsTest.kt:20`）

`mergeAdjacentTurns_mergesMetadataMaps`：合并相邻轮时两轮 metadata 字典按键合并（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnMetadataMergeTest.kt:16`）

`buildSummarySystemPrompt_withoutOverridesKeepsLegacyPrompt`：无覆盖保持 legacy 摘要提示词（`app/src/test/java/com/ai/assistance/operit/core/config/FunctionalPromptsSummaryTest.kt:12`）。

### 13. services/core 消息处理

`completeInterruptedMessage_appliesTurnSnapshotAndCompletesPartialContent`：中断的流式消息收尾测试（`app/src/test/java/com/ai/assistance/operit/services/core/MessageProcessingDelegateTest.kt:10`）。

用 TurnCancellationSnapshot 的 inputTokens / outputTokens / sentAt 等快照字段收尾（`app/src/test/java/com/ai/assistance/operit/services/core/MessageProcessingDelegateTest.kt:21`）。

finalContent 成为最终内容（`app/src/test/java/com/ai/assistance/operit/services/core/MessageProcessingDelegateTest.kt:33`）。

收尾后 `contentStream` 置 null（`app/src/test/java/com/ai/assistance/operit/services/core/MessageProcessingDelegateTest.kt:39`）。

## 关键符号

被测主代码符号（测试文件为证）：

- `EndpointCompleter.completeEndpoint`：端点补全（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:9`）
- `ChatConfigReadiness`：配置就绪判定（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadinessTest.kt:18`）
- `OpenAiToolCallHistory`：OpenAI tool 调用历史配对（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAiToolCallHistoryTest.kt:24`）
- `ClaudeOrderedToolHistory`：Claude 有序 tool 历史（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeOrderedToolHistoryTest.kt:20`）
- `StructuredToolCallBridge`：跨 provider 调用配对桥（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridgeHistoryTest.kt:40`）
- `ThinkingQualityMappingRegistry`：thinking 质量映射（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMappingTest.kt:12`）
- `GeminiThinkingConfig`：Gemini thinking 配置（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiThinkingConfigTest.kt:19`）
- `ProviderUsageCancellation`：用量上报取消传播（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ProviderUsageCancellationTest.kt:29`）
- `LocalGenerationEnd.end`：本地生成结束语义（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEndTest.kt:23`）
- `MediaCapabilityProbe.matchesVideo`：媒体能力探测（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbeTest.kt:19`）
- `MediaLinkParser`：媒体链接解析（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParserTest.kt:10`）
- `OrderedToolResults`：tool 结果有序发布（`app/src/test/java/com/ai/assistance/operit/api/chat/enhance/OrderedToolResultsTest.kt:18`）
- `ChatMemoryWindowPlanner.plan`：记忆窗口规划（`app/src/test/java/com/ai/assistance/operit/api/chat/library/ChatMemoryWindowPlannerTest.kt:13`）
- `MemoryLibrary.parseAnalysisResult`：记忆分析协议解析（`app/src/test/java/com/ai/assistance/operit/api/chat/library/MemoryAnalysisProtocolTest.kt:27`）
- `Calculator`：表达式求值入口（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/CalculatorTest.kt:50`）
- `ExpressionContext`：表达式变量与函数上下文（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionContextTest.kt:87`）
- `ExpressionParser`：表达式解析器（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionParserTest.kt:24`）
- `JsCalculator`：JS 计算器桥（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/JsCalculatorTest.kt:55`）
- `ConditionEvaluator.evaluate`：条件求值（`app/src/test/java/com/ai/assistance/operit/core/tools/condition/ConditionEvaluatorTest.kt:11`）
- `ToolPkgManager`：toolpkg 执行引擎管理（`app/src/test/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManagerTest.kt:16`）
- `PromptTurn`：提示词轮次（`app/src/test/java/com/ai/assistance/operit/core/chat/hooks/PromptTurnConversionTest.kt:8`）

## 调用链

1. JUnit4 发现 `@Test` 方法，构造输入（URL 字符串、Provider 配置、对话历史、表达式文本）。

2. 直接调用被测对象公开方法，或经反射调用私有方法 `buildSerializedHistory`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeOrderedToolHistoryTest.kt:90`）。

3. 需要 Android 环境处用 mockito-kotlin 伪造 `Context`、用 `Mockito.mockStatic` 打桩 `AppLogger`（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/ProviderUsageCancellationTest.kt:175`）。

4. `assertEquals` 断言，或 `@Test(expected = ...)` 声明异常（`app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleterTest.kt:9`）。

5. `@After` 清理全局状态：变量表、图片池、日志器（`app/src/test/java/com/ai/assistance/operit/core/tools/calculator/ExpressionContextTest.kt:10`）。

测试间无依赖：每个 `@Test` 自给自足，无执行顺序假设；全目录扫描无 `Thread.sleep`、无随机数、时区写死，确定性高（`app/src/test/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildTimeScopeTest.kt:13`）。

## 来源

- `app/src/test/java/com/ai/assistance/operit/api/chat/llmprovider/`：37 个文件——端点补全（7 文件、44 用例）、配置就绪、thinking 映射、取消与用量、媒体链接与能力、tool 调用历史配对、模型列表与策略、DataStore 迁移
- `app/src/test/java/com/ai/assistance/operit/api/chat/enhance/`：3 个文件——OrderedToolResults、ToolExecutionManager markup、ConversationMarkupManager 结果限长
- `app/src/test/java/com/ai/assistance/operit/api/chat/library/`：3 个文件——ChatMemoryWindowPlanner、ChatMemoryRebuildTimeScope、MemoryAnalysisProtocol
- `app/src/test/java/com/ai/assistance/operit/core/chat/`：7 个文件——AIMessageManager 对话回顾 + PromptTurn 操作（append / convert / kind / list-ops / merge / metadata-merge）
- `app/src/test/java/com/ai/assistance/operit/core/config/`：1 个文件——FunctionalPrompts 摘要提示词
- `app/src/test/java/com/ai/assistance/operit/core/tools/calculator/`：7 个文件、362 个用例——Calculator、ExpressionContext、ExpressionNode、ExpressionParser、JsCalculator
- `app/src/test/java/com/ai/assistance/operit/core/tools/condition/`：7 个文件——ConditionEvaluator 布尔 / 比较 / 集合 / 字面量真值 / 解析失败
- `app/src/test/java/com/ai/assistance/operit/core/tools/javascript/`：2 个文件——JsRuntimeToolCall、JsToolPkgRegistration
- `app/src/test/java/com/ai/assistance/operit/core/tools/mcp/`：1 个文件——McpServerRegistration
- `app/src/test/java/com/ai/assistance/operit/core/tools/packTool/`：4 个文件——ToolPkgManager、ToolPkgApiDeclaration、ToolPkgManifestSelection、ToolPkgMarketOriginCodec
