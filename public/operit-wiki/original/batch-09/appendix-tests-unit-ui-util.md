---
title: 单元测试·ui/util
module: 附录
sources: 48
date: 2026-10-01
issue: 123
---

# 单元测试·ui/util

## 概述

本页覆盖 Operit 仓库 `app/src/test/java/com/ai/assistance/operit/` 之下的 `ui/`（16 个文件）与 `util/`（32 个文件）共 **48 个测试文件、292 个 `@Test`**，是 UI 层纯逻辑与通用工具函数的单元测试集合（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:11`）。

这些测试全部跑在纯 JVM 上，不依赖 Android 框架：输入组件的请求解析与回声守卫、Markdown 渲染批处理与语法高亮、聊天组件的复制/粘贴/统计格式化、设置与导航的状态机、以及 `ChatMarkupRegex` / `ChatUtils` / 流式 JSON→XML 转换器等文本工具的正则与算法契约。测试即文档——每个 `@Test` 都是一条钉住行为的断言。

## AI 速览

- **核心符号清单**：parseComposeDslFilePickerRequest、ComposeDslTextFieldEchoGuard.reconcile、RenderBatchCoordinator、scanMarkdownSyntax、providerRegionWarningType、ScreenRouteViewModelStoreOwnerManager、ChatMarkupRegex、ChatUtils、StreamingJsonXmlConverter、TtsSegmenter、WaifuMessageProcessor、HotStream、TextStreamRevisionTracker（精确行号见「关键符号」表）。
- **主入口**：`app/src/test/java/com/ai/assistance/operit/ui/`、`app/src/test/java/com/ai/assistance/operit/util/`
- **数据流向一句话**：构造输入（请求参数 / 文本 / 状态）→ 直接调用被测函数 → `assertEquals` / `assertTrue` / `assertNull` / `assertSame` 断言输出。

## 核心机制

### 1. Compose DSL 输入组件（3 文件）

- `parseComposeDslFilePickerRequest` 默认走 `DOCUMENT` 模式（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:16`）。
- 默认 `mimeTypes` 为 `*/*`、`allowMultiple=false`、`persistPermission=true`（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:18`）。
- 支持 IMAGE / VIDEO / MEDIA / DIRECTORY / CAMERA 五种 picker 模式（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:39`）。
- 已下线的 "photo" 模式被拒绝并报错（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:58`）。
- image 模式传 `mimeTypes` 报错（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:66`）。
- directory 传 `allowMultiple`、camera 传 `persistPermission=false` 均被拒绝（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:72`）。
- `payload()` 固定 `executionContextKey=test-context`（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:83`）。
- `assertInvalid` 期望 `IllegalArgumentException` 且消息包含预期子串（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:90`）。
- 输入框回声守卫是 issue #1150 的回归测试：快速删除时过期树快照不得覆盖输入框（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextFieldEchoGuardTest.kt:10`）。
- `reconcile` 对自身删除的过期回声返回 `OWN_ECHO`（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextFieldEchoGuardTest.kt:20`）。
- 树与输入框收敛后清 pending 回声，返回 `CONVERGED`（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextFieldEchoGuardTest.kt:31`）。
- 编辑历史外的未知值（如 worldbook 插入模板）返回 `EXTERNAL_CHANGE`（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextFieldEchoGuardTest.kt:47`）。
- 失焦时任何差异值都判 `EXTERNAL_CHANGE` 并应用（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextFieldEchoGuardTest.kt:67`）。
- 按键顺序串行派发，一次只在途一个 edit（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputDispatchQueueTest.kt:42`）。
- `completeAll` 后迟到的 settle 不重启派发（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputDispatchQueueTest.kt:64`）。
- `awaitAll` 等待全部条目 settle（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputDispatchQueueTest.kt:92`）。

### 2. Markdown 渲染与语法高亮（2 文件）

- 200ms 内多次 `requestUpdate` 只触发一次 flush（`app/src/test/java/com/ai/assistance/operit/ui/common/markdown/RenderBatchCoordinatorTest.kt:33`）。
- flush 期间的 `requestUpdate` 在 coordinator 空闲前被排空（`app/src/test/java/com/ai/assistance/operit/ui/common/markdown/RenderBatchCoordinatorTest.kt:55`）。
- `appendBlockChunk` 把工具 XML 尾部变更渲染进 `renderNodes`（`app/src/test/java/com/ai/assistance/operit/ui/common/markdown/RenderBatchCoordinatorTest.kt:76`）。
- 产出 `MARKER` 等分类的 `highlightedText`（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:21`）。
- `CODE` 与 `LINK` 优先于嵌套 marker（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:32`）。
- 围栏代码块内视为 `CODE`（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:49`）。
- fence info 含反引号时拒绝为围栏（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:66`）。
- 未闭合分隔符产出空 `highlightRanges`，是防灾难性回溯的守卫（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:77`）。
- ranges 有序且满足 start < end（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:123`）。

### 3. 聊天组件纯逻辑（6 文件）

- `calculateMessageTokenSpeed` 在 100L/4000ms 下返回 25.0（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/ChatAreaTokenSpeedTest.kt:10`）。
- 输出 token 非正或时长非正时返回 null（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/ChatAreaTokenSpeedTest.kt:15`）。
- `cleanMessageContentForCopy` 移除多个 openai reasoning meta（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:11`）。
- 移除 gemini thought signature 保留前后文本（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:26`）。
- 非内部 meta 与 markdown 原样保留（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:30`）。
- `cleanMessageContentForXmlCopy` 保留 `tool_result` 标记（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:52`）。
- `buildSelectedMessagesPlainText` 按消息顺序拼接（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:78`）。
- 只保留 user/ai，过滤 system 与占位消息（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:96`）。
- 100 条 4KB 消息只转换一次（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:121`）。
- `extractClipboardPastedText` 提取光标处插入文本（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/PastedTextAttachmentTest.kt:16`）。
- 剪贴板换行归一化后匹配（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/PastedTextAttachmentTest.kt:36`）。
- 插入文本与剪贴板不匹配时返回 null（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/PastedTextAttachmentTest.kt:46`）。
- `extractInsertedText` 在周边文本变化时返回 null（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/PastedTextAttachmentTest.kt:66`）。
- `formatCacheHitRate` 在 657280/685487 下返回 95.88%（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/TokenHitRateFormatTest.kt:10`）。
- 99.999% 截断为 99.99%，不四舍五入（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/TokenHitRateFormatTest.kt:16`）。
- 输入为 0 时显示 "-"（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/TokenHitRateFormatTest.kt:31`）。
- 状态卡片 HTML 是 issue #930 的回归：图标字体必须内联（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/part/StatusCardHtmlDocumentTest.kt:11`）。
- 图标字体内联为 base64 woff2（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/part/StatusCardHtmlDocumentTest.kt:19`）。
- 渲染文档不含 http:// 与 https://（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/part/StatusCardHtmlDocumentTest.kt:29`）。
- `liga` 特性声明保留，连字图标可渲染（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/part/StatusCardHtmlDocumentTest.kt:40`）。
- 字体文件字节数与 SHA-256 被锁定，防误换回子集字体（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/part/StatusCardHtmlDocumentTest.kt:88`）。
- `PendingMessageQueueStore` 按 chatId 隔离队列（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStoreTest.kt:13`）。
- `suppressNextAutoDequeue` 只消费一次自动出队信号（`app/src/test/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStoreTest.kt:25`）。

### 4. 设置 / 统计 / 导航（5 文件）

- 通用 provider（OPENAI_GENERIC 等）不触发海外警告（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/sections/ProviderRegionWarningTypeTest.kt:15`）。
- `OPENROUTER` / `FOUR_ROUTER` 用 `INTERNATIONAL_PROXY` 警告（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/sections/ProviderRegionWarningTypeTest.kt:28`）。
- 官方海外 provider 用 `OVERSEAS` 警告（`app/src/test/java/com/ai/assistance/operit/ui/features/settings/sections/ProviderRegionWarningTypeTest.kt:45`）。
- `DAILY` 模式选中锚定日期当天（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsActivityRangePolicyTest.kt:16`）。
- `WEEKLY` 用周日开始的自然周（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsActivityRangePolicyTest.kt:40`）。
- `CUMULATIVE` 从历史起点到锚定日（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsActivityRangePolicyTest.kt:55`）。
- 历史起点在锚定日之后时返回 null（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsActivityRangePolicyTest.kt:73`）。
- DatePicker 毫秒按 UTC 日历解析（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDatePickerTest.kt:28`）。
- 结束日期包含当天（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDatePickerTest.kt:42`）。
- DST 春季拨快日单日范围为 23 小时（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDatePickerTest.kt:64`）。
- 结束早于开始被拒绝（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDatePickerTest.kt:71`）。
- 秋季回拨 10 天上限按自然日校验（`app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDatePickerTest.kt:87`）。
- 无守卫路由可离场（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/RouteBackGuardRegistryTest.kt:13`）。
- 过期注销不移除新注册的守卫（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/RouteBackGuardRegistryTest.kt:32`）。
- 配置变化不 pop 时复用同一 owner 与 VM（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwnerManagerTest.kt:95`）。
- pop 触发 `onCleared` 与 viewModelScope 取消（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwnerManagerTest.kt:111`）。
- `retainOnly` 只保留存活键（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwnerManagerTest.kt:158`）。
- `clearAll` 清空全部 owner（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwnerManagerTest.kt:174`）。
- keepAlive 路由键形如 "toolpkg_keepalive:pkg:mod"，再次进入复用（`app/src/test/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwnerManagerTest.kt:257`）。

### 5. ChatMarkupRegex 正则矩阵（12 文件）

- `attachmentTag` 匹配显式附件块（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexAttachmentTest.kt:10`）。
- `proxySenderTag` 提取 name（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexAttachmentTest.kt:22`）。
- `containsAnyToolLikeTag` 识别 tool / tool_result（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexContainsTest.kt:14`）。
- `extractGeminiThoughtSignature` 空 body 返回 null（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexMetaTest.kt:10`）。
- 多个 meta 中取最后一个签名（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexMetaTest.kt:22`）。
- `removeOpenAiResponsesReasoningMeta` 保留可见内容（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexMetaTest.kt:35`）。
- `extractOpenAiResponsesOutputItemPayloads` 兼容双引号与单引号（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexMetaTest.kt:53`）。
- `extractOpeningTagName` 从标签读出名（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexOpeningTagTest.kt:10`）。
- `namePattern` 提取 tool 名（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexPatternTest.kt:10`）。
- `toolParamPattern` 提取参数名与 body（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexPatternTest.kt:14`）。
- `generateRandomToolTagName` 以 tool_ 开头、总长 9（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexRandomTagTest.kt:11`）。
- `generateRandomToolResultTagName` 以 tool_result_ 开头、总长 16（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexRandomTagTest.kt:17`）。
- `searchTag` / `thinkTag` 大小写不敏感（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexSearchTest.kt:10`）。
- `xmlStatusPattern` 提取 uuid / title / subtitle（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexStatusTest.kt:10`）。
- `isToolTagName` 接受 tool、拒绝 tool_result（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:21`）。
- `normalizeToolLikeTagName` 归一后缀、未知标签原样保留（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:43`）。
- `geminiThoughtSignatureMetaTag` 把签名裹成 meta 标签（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:83`）。
- 取最后一个签名、忽略其他 provider（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:101`）。
- `toolCallPattern` 提取 name 与 body（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:131`）。
- `xmlToolResultPattern` 提取 name / status / content（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:162`）。
- `isToolTagName` 接受大写 `TOOL_EXEC`（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexToolNameTest.kt:11`）。
- `toolResultAnyPattern` 提取 body（`app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexToolResultTest.kt:21`）。
- `ToolingRegressionTest` 用 27 个用例回归全部常用模式（`app/src/test/java/com/ai/assistance/operit/util/ToolingRegressionTest.kt:7`）。
- `replyToTag` 提取 sender / timestamp / body（`app/src/test/java/com/ai/assistance/operit/util/ToolingRegressionTest.kt:102`）。
- `attachmentDataTag` 提取 id / filename / type / payload（`app/src/test/java/com/ai/assistance/operit/util/ToolingRegressionTest.kt:109`）。

### 6. ChatUtils 文本工具（8 文件）

- `extractJson` 保留嵌套对象（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsJsonExtractionTest.kt:9`）。
- 大括号逆序时返回原文（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsExtractJsonEdgeTest.kt:9`）。
- 处理无语言围栏（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsExtractJsonEdgeTest.kt:17`）。
- `removeThinkingContent` 移除 think / thinking / search 块（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTest.kt:53`）。
- 未闭合 think 截断保留 prefix（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTest.kt:72`）。
- `extractThinkingContent` 返回 (clean, thinking) 对，多块合并（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTest.kt:86`）。
- `estimateTokenCount`：英文约 4 字符 1 token，中文 2 字 3 token（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTest.kt:106`）。
- 空串 0 token，8 英文字符 2 token，3 汉字 4 token（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTokenEstimateTest.kt:9`）。
- `isGeminiProviderModel` 接受 google / gemini_generic（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsProviderModelTest.kt:20`）。
- `stripGeminiThoughtSignatureMeta` 对 pairs 保留 role（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsStripMetaCollectionsTest.kt:12`）。
- 对 PromptTurn 保留 kind（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsStripMetaCollectionsTest.kt:19`）。
- 无变化时复用原 Turn 对象（`app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTest.kt:143`）。

### 7. 流式 JSON→XML 转换器（7 文件）

- 字符串值产出 param 标签（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterTest.kt:12`）。
- `<&>` 转义为实体（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterTest.kt:54`）。
- `hasUnfinishedParam` 标记未完成参数（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterTest.kt:94`）。
- 分块输入跨 feed 累积键名（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterChunkTest.kt:11`）。
- 单引号转义为 `&apos;`、双引号为 `&quot;`（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterEscapeTest.kt:10`）。
- 完整字符串后 `flush` 无输出（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterFlushTest.kt:11`）。
- 未完成原始值 `flush` 时补闭合标签（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterFlushTest.kt:19`）。
- 嵌套对象引号保留为实体（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterObjectTest.kt:11`）。
- false 等原始值正确闭合（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterPrimitiveTest.kt:10`）。
- 转义序列 `\/` 与 `\f` 正确解码（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterStringTest.kt:12`）。

### 8. 其他工具（5 文件）

- 二次求根公式 MathML 转为纯文本（`app/src/test/java/com/ai/assistance/operit/util/MathMlPlainTextConverterTest.kt:33`）。
- 求和上下限转为纯文本（`app/src/test/java/com/ai/assistance/operit/util/MathMlPlainTextConverterTest.kt:54`）。
- 矩阵转为纯文本（`app/src/test/java/com/ai/assistance/operit/util/MathMlPlainTextConverterTest.kt:71`）。
- `TtsSegmenter` 遇到小数点与版本号不切分（`app/src/test/java/com/ai/assistance/operit/util/TtsSegmenterTest.kt:9`）。
- 句末标点仍正常切分（`app/src/test/java/com/ai/assistance/operit/util/TtsSegmenterTest.kt:19`）。
- `calculateTypingDelayMs` 首段立即返回（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:14`）。
- 长段延迟封顶 3000ms（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:39`）。
- `ensureBlockLatexDelimiters` 缺分隔符时补充（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:63`）。
- 已有分隔符不重复包裹（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:71`）。
- 孤立分隔符不成倍增长（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:99`）。
- 缺 native 库时句子切分集成测试静默跳过（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:107`）。
- `splitMessageBySentences` 保持 LaTeX 块完整（`app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:117`）。
- `share` 转发上游失败并重放部分内容（`app/src/test/java/com/ai/assistance/operit/util/stream/HotStreamTest.kt:36`）。
- 不向观察者抛失败，但 `completionCause` 可查（`app/src/test/java/com/ai/assistance/operit/util/stream/HotStreamTest.kt:73`）。
- `append` 返回同一 `SmartString`（`app/src/test/java/com/ai/assistance/operit/util/stream/TextStreamRevisionTrackerTest.kt:13`）。
- `rollback` 截断到 savepoint 并作废被丢弃后缀的 savepoint（`app/src/test/java/com/ai/assistance/operit/util/stream/TextStreamRevisionTrackerTest.kt:27`）。

## 关键符号

| 符号 | 位置 |
|---|---|
| `parseComposeDslFilePickerRequest` | `app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:14` |
| `ComposeDslTextFieldEchoGuard.reconcile` | `app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextFieldEchoGuardTest.kt:13` |
| `ComposeDslTextInputDispatchQueue` | `app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputDispatchQueueTest.kt:17` |
| `RenderBatchCoordinator` | `app/src/test/java/com/ai/assistance/operit/ui/common/markdown/RenderBatchCoordinatorTest.kt:19` |
| `calculateMessageTokenSpeed` | `app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/ChatAreaTokenSpeedTest.kt:10` |
| `cleanMessageContentForCopy` | `app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/MessageCopyTextTest.kt:11` |
| `extractClipboardPastedText` | `app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/PastedTextAttachmentTest.kt:16` |
| `formatCacheHitRate` | `app/src/test/java/com/ai/assistance/operit/ui/features/chat/components/TokenHitRateFormatTest.kt:10` |
| `PendingMessageQueueStore` | `app/src/test/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStoreTest.kt:11` |
| `scanMarkdownSyntax` | `app/src/test/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlightingTest.kt:147` |
| `providerRegionWarningType` | `app/src/test/java/com/ai/assistance/operit/ui/features/settings/sections/ProviderRegionWarningTypeTest.kt:18` |
| `activityRangeForMode` | `app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsActivityRangePolicyTest.kt:16` |
| `customRangeInclusiveEnd` | `app/src/test/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDatePickerTest.kt:36` |
| `RouteBackGuardRegistry` | `app/src/test/java/com/ai/assistance/operit/ui/main/navigation/RouteBackGuardRegistryTest.kt:11` |
| `ScreenRouteViewModelStoreOwnerManager` | `app/src/test/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwnerManagerTest.kt:88` |
| `ChatMarkupRegex` | `app/src/test/java/com/ai/assistance/operit/util/ChatMarkupRegexTest.kt:13` |
| `ChatUtils.extractJson` | `app/src/test/java/com/ai/assistance/operit/util/ChatUtilsJsonExtractionTest.kt:9` |
| `ChatUtils.estimateTokenCount` | `app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTokenEstimateTest.kt:9` |
| `ChatUtils.removeThinkingContent` | `app/src/test/java/com/ai/assistance/operit/util/ChatUtilsTest.kt:53` |
| `MathMlPlainTextConverter.convert` | `app/src/test/java/com/ai/assistance/operit/util/MathMlPlainTextConverterTest.kt:33` |
| `StreamingJsonXmlConverter.feed` | `app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterTest.kt:12` |
| `TtsSegmenter.split` | `app/src/test/java/com/ai/assistance/operit/util/TtsSegmenterTest.kt:9` |
| `WaifuMessageProcessor.calculateTypingDelayMs` | `app/src/test/java/com/ai/assistance/operit/util/WaifuMessageProcessorTest.kt:14` |
| `HotStream.share` | `app/src/test/java/com/ai/assistance/operit/util/stream/HotStreamTest.kt:36` |
| `TextStreamRevisionTracker` | `app/src/test/java/com/ai/assistance/operit/util/stream/TextStreamRevisionTrackerTest.kt:13` |

## 调用链

1. **输入**：测试构造请求参数 / 文本 / 状态 → 2. **处理**：被测函数执行 → 3. **输出**：`assertEquals` / `assertTrue` / `assertNull` / `assertSame` 锁定返回值与副作用。

- 例：构造 document 请求 → `parseComposeDslFilePickerRequest` → 断言 `pickerMode` 为 `DOCUMENT`（`app/src/test/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslFilePickerRequestTest.kt:16`）。
- 例：`feed` 未完成原始值后 `flush` → 断言输出补上闭合标签（`app/src/test/java/com/ai/assistance/operit/util/StreamingJsonXmlConverterFlushTest.kt:19`）。
- 例：批处理窗口内多次 `requestUpdate` → 断言 `flushCount` 为 1（`app/src/test/java/com/ai/assistance/operit/ui/common/markdown/RenderBatchCoordinatorTest.kt:33`）。

## 来源

- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 测试种子目录：`app/src/test/java/com/ai/assistance/operit/ui/`（16 文件）、`app/src/test/java/com/ai/assistance/operit/util/`（32 文件），2026-10-01 全文实读
