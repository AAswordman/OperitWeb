# Critic 报告：util-text-chat（Issue #84）

- 复核对象：`review/batch-06/util-text-chat.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 HEAD 一致）
- 复核方式：191 条 facts 全部机械校验（文件存在、行号不越界）+ 55 条窗口可疑项逐条人工比对源码 ±5 窗口；全部数字断言人工数过源码；12 条 quality evidence 逐字比对；正文结构与行内引用抽查；status.json 字段核对。

## 总体 verdict：FAIL（需修错后由另一名独立 critic 复验）

事实本体基本属实，未发现虚构符号；但 **25 项引用问题**必须修正：24 处 ref 行号窗口违规（含 4 处数字断言无法在窗口内核实）+ 1 处复合事实。

---

## 一、facts FAIL 项（25 项）

### A. 行号窗口违规（20 项，断言为真，只需重锚）

| # | 当前 ref | 问题 | 正确锚点 |
|---|---|---|---|
| 33 | ChatMarkupRegex.kt:292 | trimEnd 逻辑在 removeMetaByProvider :319，窗口 287–297 够不着 | :314（窗口 309–319 覆盖删除+trimEnd） |
| 50 | WaifuMessageProcessor.kt:191 | 函数定义在 :182，窗口 186–196 不含函数名 | :182 |
| 52 | WaifuMessageProcessor.kt:242 | 丢弃 XML_BLOCK/CODE_BLOCK 的 when 分支在 :265–267 | :266 |
| 64 | WaifuMessageProcessor.kt:831 | BLOCK_LATEX 在 :838，窗口 826–836 差 2 行 | :833 |
| 65 | WaifuMessageProcessor.kt:858 | runBlocking 在 :871，超出窗口 | :871 |
| 66 | WaifuMessageProcessor.kt:916 | `![$emotion]($imageUrl)` 模板在 :938 | :938 |
| 69 | WaifuMessageProcessor.kt:1007 | activePrompt/random/file.exists 在 :1013–1019 | :1014 |
| 80 | StructuredAssistantContentParser.kt:12 | `closed` 默认 true 在 :18，窗口 7–17 差 1 行 | :13 |
| 81 | StructuredAssistantContentParser.kt:22 | splitXmlTag 调用在 :26，TEXT 分支在 :29 | :26 |
| 82 | StructuredAssistantContentParser.kt:41 | text 分支与 normalizeToolLikeTagName 在 :48–57 | :52 |
| 93 | StreamingJsonXmlConverter.kt:181 | 深度归零 `primitiveNestingDepth == 0` 在 :188 | :183 |
| 118 | TextSegmenter.kt:39 | 真实分词触发 `segmenter.process(PREWARM_TEXT…)` 在 :54 | :49 |
| 120 | TextSegmenter.kt:85 | SEARCH 模式在 :95，filter 单字在 :97 | :95 |
| 127 | TokenCacheManager.kt:93 | toolsJson 拼接到 system 的逻辑在 :99–112 | :104 |
| 134 | TokenCacheManager.kt:155 | `if (updateState)` 在 :148 | :148 |
| 150 | MathMlPlainTextConverter.kt:41 | msub 回退 `_($subscript)` 在 :52 | :46 |
| 152 | MathMlPlainTextConverter.kt:89 | `"\u2061" -> ""` 在 renderOperator :105 | :105 |
| 166 | TtsSegmenter.kt:27 | trim/尾巴处理在 :35–40 | :35 |
| 171 | MarkdownProcessor.kt:57 | children 声明在 :63，窗口 52–62 差 1 行 | :60 |
| 174 | MarkdownProcessor.kt:82 | TextStreamEventCarrier/StreamRollbackPrefix 在 :93/:97 | :94 |

### B. 数字断言窗口违规（4 项，数字本身经人工数过为真）

| # | 当前 ref | 正确值（已数过） | 建议锚点 |
|---|---|---|---|
| 88 | StreamingJsonXmlConverter.kt:18 | 10 个状态（WAIT_BRACE…WAIT_COMMA，:19–28） | :23 |
| 169 | MarkdownProcessor.kt:24 | 块级 9 / 内联 8 / PLAIN_TEXT、HTML_BREAK（:24–49） | :36 |
| 176 | MarkdownProcessor.kt:119 | 11 个块级插件（已逐个点名数过） | :128 |
| 180 | MarkdownProcessor.kt:138 | 8 个内联插件（已逐个点名数过；注意 :154 的 `StreamPlugin?` 类型引用不是插件） | :147 |

### C. 复合事实（1 项）

- **facts[186]**：`plus(String)/plus(Char) 追加并置缓存失效，支持链式调用`——两个独立函数的行为挤在一条，违反原子化。拆成两条，分别锚 SmartString.kt:24 与 :37。

### D. 建议（不阻塞）

- **facts[62]**：`cleanContentForWaifu 移除思考内容、Gemini 签名 meta、围栏代码块、status/tool/tool_result/emotion 标签与 Markdown 语法`——概括性断言锚函数定义行 :766，±5 窗口只能支撑开头。建议拆成多条各锚关键行，或保留现状。

---

## 二、facts PASS 的关键抽查（任务简报指定项全部核实）

- 块级插件数 **11**（[176]）：逐个点名数过，与源码一致 ✓
- 枚举块级类型 **9**（[169]）：HEADER/BLOCK_QUOTE/CODE_BLOCK/ORDERED_LIST/UNORDERED_LIST/HORIZONTAL_RULE/BLOCK_LATEX/TABLE/XML_BLOCK ✓
- 内联插件 **8**（[180]）：Bold/Italic/InlineCode/Link/Strikethrough/Underline/InlineLaTeX/InlineParenLaTeX ✓
- getNodeDescription 截断逻辑（[107]）：`fullText.length > 80 ? fullText.substring(0, 77) + '...'` 在 :138，ref :138 正确（:107 是函数定义行，:138 才是断言支撑行）
- simplifyNode（[108]）：JS `function simplifyNode` 在 :141，:142 含 MAX_DEPTH/MAX_ELEMENTS/IGNORE_TAGS/isVisible ✓
- anyXmlTag（[23]）：定义 `<[^>]*>` 在 ChatMarkupRegex.kt:195 ✓；[63] 引用其使用处 :812 ✓
- XML_BLOCK 丢弃（[46]）：streamSegments 的 when 分支在 :119 ✓
- 其余数字：62 字符字面（[30]，已数）、3000ms（[37]，MAX_TYPING_DELAY_MS = 3000L）、4 位随机码（[29]，默认 length=4）、中文×1.5/其他×0.25（[76]）、MAX_DEPTH=20 / MAX_ELEMENTS=500（[101][102]）、MAX_CACHE_SIZE=1000（[117]）、MAX_SEGMENT_LENGTH=50（[161]/[165]）全部与源码一致 ✓
- 无虚构符号、无错文件引用；分号分隔的 [81][151] 属单行为的条件/格式描述，不算复合事实。

---

## 三、quality.json（12 条：warn 4 / suggestion 8）

- **12/12 evidence 与源码逐字比对命中**，首行全部落在 file:line ±5 窗口内。
- **4 条 warn 实质全部核实成立**：
  - Q0（runBlocking :871）：splitIntoSegments 确在 runBlocking 中收集流；调用方 :357 上下文调用链深，medium 置信度恰当。
  - Q1（参数名未转义 :95）：`Event.Tag("\n  <param name=\"${buffer}\">")` 参数名直接拼接，escapeXml 只用于参数值；key 含 `<`/`&` 会破坏 XML 结构。high 合理。
  - Q2（debug 日志打原文 :25）：`AppLogger.d(TAG, "clean(single): Original='$text' | …")` 逐字存在。medium 合理。
  - Q3（emotion 正则窄 :920）：本地 `<emotion>([^<]+)</emotion>` vs 中心 `emotionTag = "<emotion\\b[\\s\\S]*?</emotion>"`（IGNORE_CASE + DOT_MATCHES_ALL），带属性/多行标签被静默跳过。high 合理。
- 8 条 suggestion 的 description 与 evidence 一致，无夸大；severity 枚举合规。

---

## 四、正文

- 固定结构完整：概述 / AI 速览 / 核心机制 / 关键符号 / 输入→处理→输出调用链 / 来源。
- 行内 `file:line` 引用 185 处，格式规范；抽查的引用行号有效。
- **同源问题**：正文 219/226/230 行的数字断言（9/8、11 个、8 个）引用 :24/:119/:138，与 facts[169][176][180] 同一窗口问题，修错时同步修正锚点。
- 14 个种子文件（含 markdown/ 目录 2 个 kt）全部被 facts 引用覆盖；4 个页面问题（ChatMarkupRegex、流式 JSON→XML、TTS 清洗/分句/LaTeX、Markdown 数据模型）全覆盖；走查未写入正文。

## 五、status.json / 格式 / 禁用词

- issue=84、source_commit=dbf71916…、refs_valid=191（= facts 实际条数）、status=review-pending、critic 留空——全对。
- facts/quality 顶层数组；severity 仅 warn/suggestion。
- 5 文件全文禁用词（通过/批准/LGTM）0 命中。
- writer 自述的 lint 0/0 未独立重跑（修错后由修错员重跑）。

---

## 修错清单（共 26 项）

1. 按第一节 A 表 20 项重锚 ref 行号。
2. 按第一节 B 表 4 项重锚数字断言（数字本身正确，只挪锚点）。
3. facts[186] 拆成两条（:24 / :37）。
4. 正文 219/226/230 行锚点同步改为 :36/:128/:147。
5. 可选：facts[62] 拆分概括性断言。
6. 修完后 4 文件（md/facts/quality/status，不含 lint.md）/tmp 隔离重跑 lint，必须 0 硬失败/0 警告；更新 lint.md。
7. facts 总数若变化（186 拆条 → 192），同步更新 status.json refs_valid。

修错后必须派**另一名**独立 critic 复验（不能由本次 critic 复验自己打回的页）。
