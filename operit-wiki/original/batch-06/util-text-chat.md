---
title: 消息渲染与文本处理
module: app
sources: WaifuMessageProcessor.kt, ChatMarkupRegex.kt, ChatUtils.kt, StructuredAssistantContentParser.kt, StreamingJsonXmlConverter.kt, HtmlParserUtil.kt, TextSegmenter.kt, TokenCacheManager.kt, LatexMathMlConverter.kt, MathMlPlainTextConverter.kt, TtsCleaner.kt, TtsSegmenter.kt, markdown/MarkdownProcessor.kt, markdown/SmartString.kt
date: 2026-10-01
---

# 消息渲染与文本处理

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

人话：这一页管的是"AI 的回复长什么样、怎么一句一句蹦出来"。模型返回的原始文本里混着思考过程标签、工具调用标签、表情标签、LaTeX 公式、Markdown 标记——直接显示会乱成一团。`util/` 下这 14 个文件就是一条"清洗→切分→渲染"流水线：先剥掉不能看的，再把长文本按句子切成小段，最后逐段喂给聊天界面或语音播报。`util/markdown/` 负责把 Markdown 字符流解析成可渲染的节点树。

## AI 速览

- 核心符号：`WaifuMessageProcessor`（分句与逐句发送）、`ChatMarkupRegex`（全部 XML 标记正则）、`ChatUtils`（思考内容剥离与 token 估算）、`StructuredAssistantContentParser`（TEXT/XML 块切分）、`StreamingJsonXmlConverter`（JSON 参数流转 XML）、`HtmlParserUtil`（页面简化树抽取）、`TextSegmenter`（结巴分词）、`TokenCacheManager`（历史 token 缓存）、`LatexMathMlConverter` / `MathMlPlainTextConverter`（公式转纯文本）、`TtsCleaner` / `TtsSegmenter`（语音文本清洗与切分）、`MarkdownNodeProcessor` / `SmartString`（Markdown 流式解析与字符串构建器）。
- 主入口：完整消息走 `WaifuMessageProcessor.splitMessageBySentences`；流式消息走 `WaifuMessageProcessor.streamSegments`；Markdown 流走 `MarkdownNodeProcessor`。
- 数据流向一句话：原始回复 → 正则剥离标记（ChatMarkupRegex/ChatUtils）→ 块级切分（StructuredAssistantContentParser）→ 按句切分（WaifuMessageProcessor）→ 渲染或 TTS 消费。

## 核心机制

### 1. 标记正则中心（ChatMarkupRegex）

- `ChatMarkupRegex` —— 集中存放聊天消息 XML 标记正则的 object 单例 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:5`
- `TOOL_TAG_SUFFIX_REGEX_SOURCE` —— 工具标签后缀字符集 `[A-Za-z0-9_]+` `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:6`
- `TOOL_TAG_NAME_REGEX_SOURCE` —— 匹配 tool 或 tool_xxx 后缀，且用负向前瞻把 tool_result 排除在外 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:10`
- `TOOL_RESULT_TAG_NAME_REGEX_SOURCE` —— 匹配 tool_result 或 tool_result_xxx 后缀 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:12`
- `GEMINI_THOUGHT_SIGNATURE_PROVIDER` —— Gemini 思考签名 meta 的 provider 常量 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:7`
- `OPENAI_RESPONSES_REASONING_PROVIDER` —— OpenAI Responses 推理载荷 meta 的 provider 常量 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:8`
- `OPENAI_RESPONSES_OUTPUT_ITEM_PROVIDER` —— OpenAI Responses 输出项 meta 的 provider 常量 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:9`
- `toolCallPattern` —— 用反向引用配对匹配 tool 标签，并捕获标签名、工具名与正文 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:27`
- `metaProviderAttrRegex` —— 从 meta 起始标签中提取 provider 属性值 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:19`
- `metaBodyRegex` —— 提取 meta 标签的标签体 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:20`
- `xmlStatusPattern` —— 解析 status 标签的 type/uuid/title/subtitle 属性与内容 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:72`
- `xmlToolResultPattern` —— 解析 tool_result 标签的 name/status 属性与 content 子标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:76`
- `xmlToolRequestPattern` —— 解析 tool 标签的 name/description 属性与内容 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:81`
- `toolParamPattern` —— 匹配 param 参数标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:91`
- `nameAttr` —— 提取 name 属性值 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:93`
- `contentTag` —— 匹配 content 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:107`
- `thinkTag` —— 匹配 think/thinking 配对标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:127`
- `searchTag` —— 匹配 search 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:137`
- `metaTag` —— 匹配 meta 标签，用否定前瞻避免跨越嵌套的 meta 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:147`
- `emotionTag` —— 匹配 emotion 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:152`
- `memoryTag` —— 匹配 memory 标签，区分大小写 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:157`
- `replyToTag` —— 解析 reply_to 标签的 sender/timestamp 属性与内容 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:162`
- `attachmentDataTag` —— 解析携带 id/filename/type/size 属性的 attachment 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:166`
- `anyXmlTag` —— 匹配任意标签，用于最终兜底清理 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:195`
- `pruneToolResultContentPattern` —— 按 status 属性裁剪 tool_result 标签的内容 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:197`
- `isToolTagName` —— 用全匹配判断标签名是否为工具标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:202`
- `normalizeToolLikeTagName` —— 把 tool_xxx 归一为 tool，把 tool_result_xxx 归一为 tool_result `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:210`
- `containsAnyToolLikeTag` —— 同时检查 tool 与 tool_result 起始标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:226`
- `extractOpeningTagName` —— 提取 XML 字符串的起始标签名 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:230`
- `generateRandomToolTagName` —— 生成 tool_ 加 4 位随机码的标签名 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:234`
- `randomTagCodeChars` —— 62 个字母数字字符表，随机码用 SecureRandom 从中生成 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:24`
- `geminiThoughtSignatureMetaTag` —— 构造 Gemini 思考签名的 meta 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:238`
- `extractGeminiThoughtSignature` —— 只提取最后一个匹配 provider 的 meta 体，非空才返回 `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:250`
- `removeGeminiThoughtSignatureMeta` —— 按 provider 删除对应 meta 标签后做 trimEnd `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:292`
- `removeOpenAiResponsesProtocolMeta` —— 组合删除 reasoning 与 output_item 两类 meta `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:304`

### 2. 分句与逐句发送（WaifuMessageProcessor）

- `WaifuMessageProcessor` —— object 单例，把 AI 回复按句切分并模拟逐句发送 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:22`
- `PLACEHOLDER_PREFIX` —— 实体占位符前后缀 `{WAIFUENTITY:` 与 `}`，分句前先把 Markdown 实体、URL、邮箱替换为占位符，防止被错误切分 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:24`
- `MAX_TYPING_DELAY_MS` —— 打字机延迟上限 3000 毫秒 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:26`
- `SENTENCE_SPLIT_REGEX` —— 在 。！？~～、!? 与英文句号处切分，英文句号后跟数字或引号时不切分 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:29`
- `MARKDOWN_ENTITY_REGEX` —— 匹配 Markdown 图片与链接 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:34`
- `BARE_URL_REGEX` —— 匹配 http(s) 裸 URL `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:35`
- `EMAIL_ADDRESS_REGEX` —— 匹配邮箱地址 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:36`
- `DOMAIN_URL_REGEX` —— 匹配无协议域名 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:37`
- `StreamingSession` —— 用 emittedSegments 记录已输出分句，实现流式增量输出 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:45`
- `collectStableSegments` —— 只取稳定分句，不含尾部不完整句 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:50`
- `collectFinalSegments` —— 取全部分句，含尾部不完整句 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:60`
- `collectSegments` —— 发现本次分句短于已输出或前缀变化时直接丢弃该快照，不可回滚 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:64`
- `streamSegments` —— 先按 Markdown 块切分流，再逐块处理 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:101`
- `XML_BLOCK` —— streamSegments 直接丢弃该类型块 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:119`
- `CODE_BLOCK` —— 与 TABLE、IMAGE 块收齐整块后整体参与分句 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:123`
- `ensureBlockLatexDelimiters` —— 块级 LaTeX 缺少分隔符时补上双美元符号包裹 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:164`
- `calculateTypingDelayMs` —— 首句、长度≤0 或每字延迟≤0 时返回 0 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:182`
- `MAX_TYPING_DELAY_MS` —— 按句长×每字延迟计算后钳制在该上限内 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:191`
- `streamSegmentsWithTypingQueue` —— 用无界 Channel 做生产者-消费者队列，逐句 delay 后输出 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:194`
- `streamTtsText` —— 输出字符流，丢弃 XML 与代码块、在块后补换行、合并连续换行并去掉行首空白 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:242`
- `removeSentenceEndPunctuation` —— 去掉句末 。！？.!?，但保留三个点结尾 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:283`
- `initialize` —— 在应用启动时注入表情仓库与当前提示词管理器 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:295`
- `splitMessageBySentences` —— 完整消息分句入口 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:306`
- `mergePunctuationOnlySegments` —— 把纯标点分句并入上一句，上一句含换行时除外 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:508`
- `shouldHoldLastStableSentence` —— 末句无稳定结尾且无后续稳定边界时扣留末句 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:667`
- `findLastUnclosedInlineMarkdownStart` —— 检测加粗、斜体、删除线、行内代码四种未闭合行内标记 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:680`
- `buildRenderableContentForWaifu` —— 用结构化解析器解析后只保留 TEXT 块 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:739`
- `cleanContentForWaifu` —— 移除思考内容、Gemini 签名 meta、围栏代码块、status/tool/tool_result/emotion 标签与 Markdown 语法 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:766`
- `anyXmlTag` —— cleanContentForWaifu 最后用该正则兜底清理并把空白压缩为单个空格 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:813`
- `canCloseStableTextAtBlockBoundary` —— 标题、引用、代码块、有序/无序列表、块级公式、表格、图片的块边界可作为稳定文本结尾 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:831`
- `splitIntoSegments` —— 在 runBlocking 中用 nativeMarkdownSplitByBlock 按块切分 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:858`
- `processEmotionTags` —— 把 emotion 标签替换为 Markdown 图片，自定义表情用 file 绝对路径、assets 表情用 android_asset 前缀，路径中空格与括号做 URL 编码 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:916`
- `separateEmotionAndText` —— 把 emotion 图片拆成独立列表项，文本保留在相邻项 `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:950`
- `getRandomEmojiPath` —— 只从自定义表情按当前提示词查找，随机取一张且文件必须存在，否则返回 null `app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:1007`

### 3. 思考内容与通用工具（ChatUtils）

- `thinkContentPattern` —— 预编译正则，注释说明是为了避免每次 toRegex 走 ICU 编译卡死主线程 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:7`
- `thinkContentPattern` —— 匹配 think/thinking 到闭合标签或文本末尾，可处理未闭合 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:10`
- `stripOpenAiResponsesProtocolMarkup` —— 在删除 meta 的基础上再删除 search 标签 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:50`
- `isGeminiProviderModel` —— 按 providerModel 冒号前段是否为 GOOGLE 或 GEMINI_GENERIC 判断 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:63`
- `removeThinkingContent` —— 删除 think/thinking/search 及其内容（含未闭合），无标记时直接 trim 返回 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:71`
- `extractThinkingContent` —— 返回去思考内容与思考内容的二元组，供 DeepSeek 推理内容使用 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:83`
- `estimateTokenCount` —— 按中文字符×1.5、其他字符×0.25 估算 token 数 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:104`
- `extractJson` —— 先剥代码围栏，再取首个大括号到最后一个大括号 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:115`
- `extractJsonArray` —— 取首个中括号到最后一个中括号 `app/src/main/java/com/ai/assistance/operit/util/ChatUtils.kt:140`

### 4. 结构化块解析（StructuredAssistantContentParser）

- `BlockKind` —— 枚举只有 TEXT 与 XML 两种 `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:7`
- `Block` —— 数据类含 kind、rawContent、content、tagName、rawTagName、attrs、closed 七个字段，closed 默认为 true `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:12`
- `parse` —— 用原生 XML 切分器切分，无切分结果时整段作为单个 TEXT 块 `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:22`
- `buildBlock` —— 对 text 段建 TEXT 块，否则归一化标签名 `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:41`
- `extractXmlInnerContent` —— 取起始标签大于号之后到最后一个闭合标签之间的内容 `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:69`
- `extractXmlAttributes` —— 用正则从起始标签提取属性名与单双引号值 `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:102`
- `isXmlFullyClosed` —— 以自闭合结尾判闭合，否则检查是否包含对应闭合标签 `app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:123`

### 5. JSON 参数流转 XML（StreamingJsonXmlConverter）

- `StreamingJsonXmlConverter` —— 把工具调用参数的 JSON 流增量转换为 XML `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:7`
- `Event` —— 密封类，只有 Tag 与 Content 两种事件 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:13`
- `State` —— 状态机共 10 个状态 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:18`
- `hasOpenParam` —— 键读取完毕时输出 param 起始标签并置为 true `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:95`
- `READ_STRING` —— 字符串值逐字符输出并做 XML 转义，遇到闭合引号输出 param 闭合标签 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:122`
- `unescaped` —— 把常用转义序列还原为对应字符后输出 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:136`
- `UNICODE_ESCAPE` —— 解析 uXXXX 的 4 位十六进制为字符输出 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:151`
- `primitiveNestingDepth` —— 复杂值按嵌套深度跟踪，直到深度归零才闭合 param `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:181`
- `hasUnfinishedParam` —— 暴露是否有未闭合 param，供调用方决定是否补 tool 闭合标签 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:66`
- `flush` —— 只在可收尾的原始值状态下补发 param 闭合标签 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:222`
- `escapeXml` —— 把特殊字符转为 XML 实体 `app/src/main/java/com/ai/assistance/operit/util/StreamingJsonXmlConverter.kt:233`

### 6. 页面简化树（HtmlParserUtil）

- `getExtractionScript` —— 返回一段 JS 自执行函数，用于在页面内抽取简化树 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:10`
- `IGNORE_TAGS` —— 忽略脚本、样式、元信息、链接、头部、noscript 标签 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:11`
- `INTERACTIVE_TAGS` —— 交互标签集合 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:12`
- `IMPORTANT_ATTRIBUTES` —— 保留的属性白名单 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:13`
- `MAX_DEPTH` —— JS 抽取的最大深度 20 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:19`
- `MAX_ELEMENTS` —— JS 抽取的最大元素数 500 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:20`
- `findTopmostModal` —— 按定位、z-index、对话框角色与弹窗关键词打分，≥5 分且可见判为顶层弹窗 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:24`
- `getCssSelector` —— 有 id 直接用 id 选择器，否则拼 class 链，否则用 nth-of-type `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:54`
- `isInteractive` —— 判定交互元素：交互标签、onclick 属性或指针样式 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:90`
- `getNodeDescription` —— 按无障碍标签、替代文本、标题、占位符、名称、直接文本、截断全文的优先级取描述 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:107`
- `fullText` —— 全文回退超 80 字符时截为 77 字符加省略号 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:138`
- `simplifyNode` —— 剪掉不可见、忽略标签、超深的节点 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:141`
- `hasInteractiveDescendant` —— 无交互、无文本、无交互后代的节点直接拍平为其子节点 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:168`
- `inputType` —— 输入框按 type 区分按钮与文本两种类型 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:179`
- `parseAndSimplify` —— 用序列化库解析抽取结果 JSON，交互映射的字符串键转 Int，转换失败的负一项被过滤掉 `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:218`
- `println` —— 解析失败时打印错误并返回 null `app/src/main/java/com/ai/assistance/operit/util/HtmlParserUtil.kt:238`

### 7. 中文分词（TextSegmenter）

- `TextSegmenter` —— 基于结巴分词的 object 单例 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:12`
- `PREWARM_TEXT` —— 分词器预热文本 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:15`
- `MAX_CACHE_SIZE` —— 分词缓存上限 1000，超限时删掉一半键 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:31`
- `initialize` —— 加锁初始化，可选加载自定义词典，首次用一次真实分词触发词典加载 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:39`
- `loadCustomDictionaryIfNeeded` —— 文件不存在或已加载过时跳过 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:69`
- `segment` —— 用搜索模式分词并过滤单字，空文本返回空列表 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:85`
- 分词失败回退 —— 用空白与中英文标点切分并过滤单字 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:113`
- `clearCache` —— 清空分词缓存 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:121`
- `calculateRelevance` —— 先截断 5000 字符，无直接子串匹配直接返回 0 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:131`
- `calculateRelevance` —— 精确匹配数过半或≥3 时用快速公式打分 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:131`
- `calculateRelevance` —— 总分公式为精确匹配加权加分词匹配后归一化，钳制在 0~1 `app/src/main/java/com/ai/assistance/operit/util/TextSegmenter.kt:131`

### 8. token 缓存（TokenCacheManager）

- `TokenCacheManager` —— 缓存对话历史 token 计算结果，避免重复计算 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:9`
- `resetTokenCounts` —— 清空历史与全部计数 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:52`
- `setOutputTokens` —— 用接口返回的实际输出 token 覆盖估算并钳制≥0 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:70`
- `updateActualTokens` —— 接收服务端缓存统计 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:81`
- `calculateInputTokens` —— 把工具定义拼到 system 消息前（或作为首条 system 消息），以便前缀匹配缓存工具定义 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:93`
- `previousHistoryTokenCount` —— 公共前缀完全等于上次历史时直接复用该缓存计数 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:131`
- 只读预估 —— updateState 为 false 时只做只读预估，不更新内部缓存状态 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:155`
- `findCommonPrefixLength` —— 逐条比对找公共前缀长度 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:179`
- `calculateTokensForHistory` —— 对每条内容调用估算函数求和 `app/src/main/java/com/ai/assistance/operit/util/TokenCacheManager.kt:200`

### 9. LaTeX 公式（LatexMathMlConverter / MathMlPlainTextConverter）

- `ASSET_PATH` —— KaTeX 包路径 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:9`
- `FUNCTION_NAME` —— 注入的 JS 批量转换函数名 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:11`
- `convertAll` —— 空列表直接返回空列表，逐公式调用 QuickJS 批量转换 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:18`
- `convertAll` —— KaTeX 解析失败的公式保留原文并打警告日志 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:21`
- `MathMlPlainTextConverter` —— MathML 经其转换转纯文本，异常时保留原文 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:38`
- `getEngine` —— 用双重检查加锁实现单例 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:50`
- `createEngine` —— 从 assets 按 UTF-8 读 KaTeX 源码，为空则报错 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:57`
- `createEngine` —— 先垫 exports/module 再求值 KaTeX 源码与启动脚本 `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:57`
- 启动脚本 —— 用 KaTeX 渲染为 MathML（行内模式、遇错抛错、宽松校验），异常返回 null `app/src/main/java/com/ai/assistance/operit/util/LatexMathMlConverter.kt:84`
- `convert` —— 用 Jsoup 解析并取首个 math 元素，无 math 元素则抛错 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:9`
- `convert` —— 渲染后压缩空白并修正括号逗号两侧空格 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:12`
- `mfrac` —— 渲染为分子分母的分数形式 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:30`
- `msqrt` —— 渲染为根号形式 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:35`
- `mroot` —— 渲染为 root(次数, 被开方数) `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:36`
- `msup` —— 优先用 Unicode 上下标字符映射，缺失时回退为幂形式 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:41`
- `mtable` —— 渲染为方括号包裹的行列表，单元格间用逗号连接 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:84`
- `mo` —— 对不可见乘号输出空字符串 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:89`
- `mo` —— 对加减乘除、比较、箭头等运算符两侧加空格 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:92`
- `FUNCTION_NAMES` —— 函数名集合，mi 命中时后加空格 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:121`
- `LARGE_OPERATORS` —— 大运算符集合，表达式后加空格 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:127`
- `SUPERSCRIPTS` —— 上下标字符映射表 `app/src/main/java/com/ai/assistance/operit/util/MathMlPlainTextConverter.kt:132`

### 10. TTS 文本处理（TtsCleaner / TtsSegmenter）

- `clean` —— 单模式版本：空模式直接返回原文，非法正则打 error 日志并返回原文 `app/src/main/java/com/ai/assistance/operit/util/TtsCleaner.kt:16`
- `clean` —— 列表版本：逐个模式顺序替换，跳过空模式，非法模式打 error 日志后跳过 `app/src/main/java/com/ai/assistance/operit/util/TtsCleaner.kt:40`
- `MAX_SEGMENT_LENGTH` —— 最大分段长度 50 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:4`
- `END_CHARS` —— 分句结束字符集 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:5`
- `findFirstEndCharIndex` —— 返回首个分句结束字符下标，无则返回 -1 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:7`
- `nextSegmentEnd` —— 在首个结束符后吞掉连续的结束符 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:14`
- `nextSegmentEnd` —— 无结束符且长度达上限时整段切出，否则返回 -1 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:14`
- `split` —— 循环切分并 trim，跳过空段，剩余尾巴整体作为一段 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:27`
- 英文句号规则 —— 仅在后接字符为空、非数字、非句号时才算分句结束 `app/src/main/java/com/ai/assistance/operit/util/TtsSegmenter.kt:47`

### 11. Markdown 流式解析（markdown/MarkdownProcessor.kt）

- `StringCollectorProcessor` —— 把流收集为字符串 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:15`
- `MarkdownProcessorType` —— 文本块与内联类型枚举 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:24`
- 枚举共 9 种块级类型、8 种内联类型及纯文本、换行 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:36`
- `markdownNodeIdGenerator` —— 节点 id 用 AtomicLong 全局自增 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:55`
- `MarkdownNode` —— content 为高性能字符串构建器，children 为 Compose 快照列表 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:57`
- `MarkdownNodeStable` —— 带 Stable 注解的不可变快照数据类 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:67`
- `toCharStream` —— 把字符串拆为字符流 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:75`
- `toCharStream` —— 字符串流转字符流时保留事件载体与回滚前缀 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:78`
- `MarkdownNodeProcessor` —— 在后台线程把流收集为 MarkdownNode `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:105`
- `getBlockPlugins` —— 块级插件工厂 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:119`
- 返回 11 个块级插件（Header、FencedCodeBlock、BlockQuote、OrderedList、UnorderedList、HorizontalRule、BlockLaTeX、BlockBracketLaTeX、Table、Image、Xml） `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:128`
- `StreamMarkdownBlockLaTeXPlugin` —— 处理双美元符号块级公式且剥离分隔符 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:126`
- `StreamMarkdownBlockBracketLaTeXPlugin` —— 处理方括号转义块级公式且保留分隔符 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:129`
- `StreamXmlPlugin` —— 把 XML 块保留标签输出 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:136`
- `getInlinePlugins` —— 内联插件工厂 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:138`
- 返回 8 个内联插件（Bold、Italic、InlineCode、Link、Strikethrough、Underline、InlineLaTeX、InlineParenLaTeX） `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:147`
- `StreamMarkdownInlineLaTeXPlugin` —— 处理单美元符号行内公式 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:148`
- `StreamMarkdownInlineParenLaTeXPlugin` —— 处理圆括号转义行内公式且保留分隔符 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:151`
- `getTypeForPlugin` —— 按插件类映射到枚举类型 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:154`
- `bind` —— 把流分组递归转为节点树再交给渲染策略 `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:186`

### 12. 高性能字符串构建器（markdown/SmartString.kt）

- `SmartString` —— 带 toString 缓存的高性能字符串构建器 `app/src/main/java/com/ai/assistance/operit/util/markdown/SmartString.kt:14`
- `plus` —— 追加字符串或字符并置缓存失效，支持链式调用 `app/src/main/java/com/ai/assistance/operit/util/markdown/SmartString.kt:24`
- `toString` —— 仅在构建器长度变化时重建字符串并缓存 `app/src/main/java/com/ai/assistance/operit/util/markdown/SmartString.kt:47`
- `clear` —— 清空内容并重置缓存 `app/src/main/java/com/ai/assistance/operit/util/markdown/SmartString.kt:80`
- `truncate` —— 无快照截断，要求长度在合法范围内 `app/src/main/java/com/ai/assistance/operit/util/markdown/SmartString.kt:87`
- `replace` —— 整体替换内容但保留 buffer 实例 `app/src/main/java/com/ai/assistance/operit/util/markdown/SmartString.kt:100`

### 13. `<status type="warning">` 的渲染语义：「AI犯了一个错误」

人话：聊天里看到的"AI犯了一个错误"不是 AI 在认错，是 App 渲染的一张警告卡片。流水线在特定情况下往消息里插入 `<status type="warning">…</status>` 标签，渲染层看到 warning 类型就套一个固定标题，真正的错误原因写在卡片详情里——看详情，别被标题吓到。

- **构造**：`ConversationMarkupManager.createWarningStatus` 生成 `<status type="warning">$warningMessage</status>` 文本标记。
  `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationMarkupManager.kt:43`
- **渲染**：`CustomXmlRenderer` 遇到 `statusType == "warning"` 时走 `WarningStatusDisplay` 分支，`summaryText` 硬编码取字符串 `status_warning_ai_error_summary`（值就是"AI犯了一个错误"），`detailText` 取标签里的 warningMessage 原文。
  `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/part/CustomXmlRenderer.kt:1329`
  `app/src/main/res/values/strings.xml:7792`
- **注入点 1——纯思考输出**：`EnhancedAIService` 在模型只输出思考内容、removeThinking 后正文为空时插入纯思考警告，然后让 AI 继续生成。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1789`
  警告文本"警告：请输出正文内容，禁止仅输出思考内容。"见 `app/src/main/res/values/strings.xml:7790`。
- **注入点 2——工具调用被截断**：检测到未闭合的工具调用、本轮工具全部作废时，插入警告"警告：检测到工具调用输出被截断。本轮所有工具调用均已作废且不会执行。……"（`app/src/main/res/values/strings.xml:7791`）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1907`
- **注入点 3——一次多个工具调用**：`createMultipleToolsWarning` 只执行第一个工具、忽略其余。
  `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationMarkupManager.kt:127`
  警告文本"检测到多个工具调用。系统将只执行第一个工具……"见 `app/src/main/res/values/strings.xml:8225`。
- **历史污染**：纯思考告警以 `PromptTurnKind.TOOL_RESULT` 被写进 `conversationHistory`（`:1799`），会参与后续轮次的消息组装。某些习惯性只吐 thinking 或频繁截断工具调用的模型会每轮触发，看起来就是"老是"报错；换新对话（清空历史）可解。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1799`

## 关键符号

英文原名清单（按文件）：`ChatMarkupRegex`、`toolCallPattern`、`metaProviderAttrRegex`、`xmlStatusPattern`、`xmlToolResultPattern`、`xmlToolRequestPattern`、`toolParamPattern`、`isToolTagName`、`normalizeToolLikeTagName`、`generateRandomToolTagName`、`extractGeminiThoughtSignature`、`removeOpenAiResponsesProtocolMeta`；`WaifuMessageProcessor`、`StreamingSession`、`collectStableSegments`、`collectFinalSegments`、`streamSegments`、`streamSegmentsWithTypingQueue`、`streamTtsText`、`splitMessageBySentences`、`mergePunctuationOnlySegments`、`shouldHoldLastStableSentence`、`buildRenderableContentForWaifu`、`cleanContentForWaifu`、`processEmotionTags`、`separateEmotionAndText`、`getRandomEmojiPath`、`calculateTypingDelayMs`、`MAX_TYPING_DELAY_MS`、`SENTENCE_SPLIT_REGEX`；`ChatUtils`、`thinkContentPattern`、`removeThinkingContent`、`extractThinkingContent`、`estimateTokenCount`、`extractJson`；`StructuredAssistantContentParser`、`BlockKind`、`Block`、`parse`、`buildBlock`；`StreamingJsonXmlConverter`、`Event`、`State`、`feed`、`flush`、`escapeXml`、`hasUnfinishedParam`；`HtmlParserUtil`、`getExtractionScript`、`parseAndSimplify`、`simplifyNode`、`findTopmostModal`、`getCssSelector`、`isInteractive`、`getNodeDescription`；`TextSegmenter`、`segment`、`calculateRelevance`、`JiebaSegmenter`；`TokenCacheManager`、`calculateInputTokens`、`findCommonPrefixLength`、`calculateTokensForHistory`；`LatexMathMlConverter`、`convertAll`、`getEngine`、`createEngine`；`MathMlPlainTextConverter`、`convert`、`FUNCTION_NAMES`、`LARGE_OPERATORS`；`TtsCleaner`、`TtsSegmenter`、`split`、`nextSegmentEnd`；`MarkdownProcessorType`、`MarkdownNode`、`MarkdownNodeStable`、`MarkdownNodeProcessor`、`getBlockPlugins`、`getInlinePlugins`、`getTypeForPlugin`、`MarkdownUIBinder`、`bind`、`toCharStream`、`SmartString`；`ConversationMarkupManager`、`createWarningStatus`、`createMultipleToolsWarning`；`WarningStatusDisplay`、`status_warning_ai_error_summary`。

## 输入→处理→输出调用链

1. **输入**：模型返回的原始文本（含思考标签、工具标签、表情标签、LaTeX、Markdown 标记）进入 `WaifuMessageProcessor.splitMessageBySentences`（完整消息）或 `streamSegments`（流式增量）。
2. **处理**：
   1. `ChatMarkupRegex` 系列正则与 `ChatUtils.removeThinkingContent` 剥离思考内容、meta、search 标签；
   2. `StructuredAssistantContentParser.parse` 切分为 TEXT/XML 块，`buildRenderableContentForWaifu` 只保留 TEXT 块；
   3. `cleanContentForWaifu` 移除围栏代码块、status/tool/tool_result/emotion 标签与 Markdown 语法；
   4. `processEmotionTags` 把 emotion 标签转为 Markdown 图片；
   5. TTS 路径：`LatexMathMlConverter.convertAll` 把公式经 QuickJS+KaTeX 转 MathML，再由 `MathMlPlainTextConverter.convert` 转纯文本；`TtsCleaner.clean` 按正则清洗，`TtsSegmenter.split` 按 50 字符切分；
   6. 请求组装路径：`TokenCacheManager.calculateInputTokens` 用公共前缀缓存为历史消息估算 token；
   7. 渲染路径：`MarkdownNodeProcessor` 把字符流收集为 `MarkdownNode` 树，`MarkdownUIBinder.bind` 交给渲染策略。
3. **输出**：逐句文本流（`streamSegmentsWithTypingQueue` 带打字机延迟）、纯文本 TTS 片段、Markdown 节点树。

## 来源

- 源码：`app/src/main/java/com/ai/assistance/operit/util/` 下 14 个文件（`util/` 直接 12 个 + `util/markdown/` 2 个），Operit v1.12.2（commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）。
- 配套数据：`util-text-chat.facts.json`（191 条原子事实）、`util-text-chat.quality.json`（12 条代码走查：4 warn / 8 suggestion）。
- 阅读证据：`tracking/read-status.json`（batch-06 登记 14 文件）。
