# Critic 复核报告：data-stats-pricing（Token 用量统计与模型定价数据）

- 复核对象：`review/batch-05/data-stats-pricing.{facts,quality,md,lint,status}.json/md`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：208 条 facts 脚本化全量校验（文件存在、行号整数、不越界、±5 窗口标识符重叠、数字断言支撑）+ 25 条 flagged 逐条人工核源码原文；数字断言专项抽查（MAX_BUCKETS、granularityFor 阈值、formatTokenCount、cacheRate、domesticProviders 计数、providerFallbacks 计数、ApiProviderConfigs 计数、价格行、loopback、默认模型）；quality 9 条逐条 diff 验 evidence；正文断言抽查验真；禁用词全文 grep；status.json 字段核对。

## 结论：打回修正

**facts：208 条中 203 条通过，5 处硬问题（1 条数字断言错误 + 3 条锚点错位 + 1 条复合事实需拆分）。**
**quality：9 条中 4 条 evidence 与源码不符（非逐字原文），必须修正；分级合理，无夸大。**
**正文 md：通过。status.json：refs_valid 失实，必须修正；其余字段正确。lint：0/0（独立确认）。**

---

## 硬问题（必须修）

### facts

1. **[148] 数字断言错误**：`providerFallbacks` 为 **34** 个 provider（逐项数过：OPENAI、OPENAI_RESPONSES、OPENAI_CODEX、OPENAI_RESPONSES_GENERIC、OPENAI_GENERIC、ANTHROPIC、ANTHROPIC_GENERIC、GOOGLE、GEMINI_GENERIC、MISTRAL、OPENROUTER、NOUS_PORTAL、OTHER、OPENAI_LOCAL、DEEPSEEK、BAIDU、ALIYUN、XUNFEI、ZHIPU、BAICHUAN、MOONSHOT、SILICONFLOW、FOUR_ROUTER、INFINIAI、ALIPAY_BAILING、DOUBAO、PPINFRA、LMSTUDIO、OLLAMA、MNN、LLAMA_CPP、MIMO、NOVITA、MINIMAX），facts 写 "35 个"。
   - ref `:156` 锚点本身正确（map 起始行），只需把数字改成 34。

2. **[29] 引用锚点错位**：ref `:220`，±5 窗口（215–225）内无 `sumNumericFields`。实际调用在 **209** 行：
   `?: usage.optJSONObject("cache_creation")?.let { sumNumericFields(it) }`
   断言本身为真，重锚定 `:209`。

3. **[73] 引用锚点错位**：ref `:66`，`TokenStatsTimeRanges.granularityFor` 实际在 **49** 行，窗口 61–71 内无支撑。断言为真，建议重锚定 `:52`（窗口 47–57 同时覆盖 granularityFor 调用、bucketStarts 与按桶聚合）。

4. **[81] 引用锚点错位**：ref `:150`，`totalInputKnown > 0L` 分支实际在 **160** 行：
   `if (usageRow.totalInputKnown > 0L) {`
   重锚定 `:160`。

5. **[145] 复合事实跨窗口，必须拆分**：一条事实同时断言 COUNT 行与 TOKEN 行的第 6 段语义，ref `:129` 窗口只覆盖 TOKEN 部分。按引用铁律拆成 2 条：
   - "COUNT 行用第 6 段作 pricePerRequest" → ref `:119`（窗口 114–124 覆盖 `parts[5]` 解析与 `countPricing(pricePerRequest = tokenCachedOrCountPrice)`）
   - "TOKEN 行第 6 段>0 作 cached 单价，否则用 input 单价" → ref `:129`（窗口已覆盖 `tokenCachedOrCountPrice.takeIf { it > 0.0 } ?: inputPrice`）

### quality（evidence 必须为逐字源码原文）

6. **Q3 evidence 与源码不符**：存的是
   `require(separator > 0 && model.isNotEmpty()) { "providerModel must be in the form 'provider:model', got: $providerModel" }`
   源码实际（TokenTrackingAIService.kt:279–281）是：
   ```
   val separator = providerModel.indexOf(':')
   require(separator > 0 && separator < providerModel.lastIndex) {
       "provider:model is required for token usage events"
   }
   ```
   条件与消息都被改写过，必须换成逐字原文。description 里的 "require(providerModel 含 ':')" 表述也建议同步精确为实际条件。

7. **Q4 evidence 消息文本不符**：存的是 `"Conflicting legacy price settings for $identity"`，源码实际（ApiPreferences.kt:562）是：
   `require(settings.size == 1) { "Conflicting released prices for ${identity.first}:${identity.second}" }`
   必须换成逐字原文。

8. **Q5 evidence 含 `...` 占位符且变量名被改写**：存的是 `val rules = JSONArray(DEFAULT_JSON)` / `val out = JSONArray()` / `for (i in 0 until rules.length())`，源码实际（ModelThinkingConfigDefaultsCollect.kt:406–408）是：
   ```
   val source = JSONArray(DEFAULT_JSON)
   val target = JSONArray()
   for (index in 0 until source.length()) {
   ```
   必须换成连续逐字行（断言"每次调用重新解析"本身为真）。

9. **Q6 evidence 含 `...` 占位符且数据行虚构**：存的首行 `OPENAI|gpt-4o|TOKEN|2.5|10|1.25|USD` 在源码中不存在；实际首行（ScrapedModelPricingRowsCollect.kt:6）是 `OPENAI|chatgpt-4o-latest|TOKEN|15|45|0|USD`。且 evidence 把文件头（:4）与 DeepSeek 注释（:504）拼成一段。必须换成连续逐字行（例如 :4–:8 的文件头与首行）。

10. **Q7 evidence 是改写过的伪代码**：存的是 `?: providerFallbacks[provider.uppercase(Locale.US)] ?: zeroPricing(if (isDomesticProvider(provider)) PricingCurrency.CNY else PricingCurrency.USD,)`，源码实际（ModelPricingDefaultsCollect.kt:230–235）是：
    ```
    return providerFallbacks[provider]
        ?: if (isDomesticProvider(provider)) {
            zeroPricing(PricingCurrency.CNY)
        } else {
            zeroPricing(PricingCurrency.USD)
        }
    ```
    必须换成逐字原文。

### status.json

11. **refs_valid 失实**：写 "85/85 引用行号真实存在"，实际 facts 208 条（85 是正文引用数）。修完上述问题后改为 "208/208 引用行号真实存在，lint 硬失败 0/警告 0"。

---

## 通过项

- 其余 203 条 facts 引用支撑有效；原子性好（除 [145] 外无复合事实）。
- 数字断言专项抽查全部属实：MAX_BUCKETS=10000（:42）、granularityFor 阈值 12h/48h（:53）、formatTokenCount 分档（:19/:25）、cacheRate 条件（:89）、domesticProviders 16 项（:23）、ApiProviderConfigs 38 项（:19）、DeepSeek 官方价同步日期与价格（:504/:506）、tts-1 价格（:104）、loopback 主机列表（:359）、三供应商默认模型（:23/:54/:64）、COUNT 费用逻辑（:23）、legacy normalizer（:24）。
- 正文结构齐全（概述 / ## AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源），调用链为输入→处理→输出三段式编号；MNN/LLAMA_CPP 停止维护标注醒目（正文 194 行）；符号英文原名；与 facts 无矛盾；抽查的正文断言（record()、markPersisted、reasoningIncludedInOutput、cacheWriteSeparateBilling、15+4 个 kt 文件数）全部验真。
- quality 9 条分级合理：warn 5 / suggestion 4，高危 0，无漏判夸大；Q0/Q1/Q2/Q8 evidence 逐字真实。
- 禁用词 5 文件 0 命中；lint 独立复跑 0 硬失败 / 0 警告。
- status.json 其余字段全对：issue 68（整数）、review-pending、source_repo=operit、source_commit 一致。

## 轻微建议（不阻塞，可顺手修）

- facts[106]：`(7.0, true)` 的 7.0 来自 `TokenCostCurrency.DEFAULT_USD_TO_CNY_RATE` 常量（定义在 TokenCostCalculator.kt:79），ref 窗口只见常量名。建议文案点名常量，或保持现状（常量可解析）。
- facts[121]：manualRate 7.0 同理经由该常量。
- Q0 evidence 最后一行被截断（"val bucket" 不完整），建议只保留完整行。

---

**待办**：需派修错员修正上述 11 处硬问题（facts 5 + quality 4 + status 1，注 facts[148] 数字与 quality 证据是实质错误，其余为锚点/证据形式问题），修完后必须由独立 critic（不是我）再复验。

---

## 复验（第二轮，2026-10-01）——**通过**

复验方：与首轮 critic、修错员完全独立的第二位 critic。源码 Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 一致），未采信修错员报告，逐项亲自核源码。

### 11 项硬问题逐项复核（全部 ✅）

1. **facts[148] 数字 35→34**：亲自逐项数 `providerFallbacks` map（ModelPricingDefaultsCollect.kt:157–190），脚本 `grep -c '"[A-Z_0-9]+" to zeroPricing'` = **34**（OPENAI…MINIMAX，与首轮清单 34 项一致）；facts 文案已改"34 个"，ref :156 保留 ✅
2. **facts idx 28 ref :209**：`sumNumericFields(it)` 在 ProviderUsageSnapshot.kt:208，窗口 204–214 覆盖 `optJSONObject("cache_creation")?.let { sumNumericFields(it) }`；断言"Anthropic 的 cache_creation 对象用 sumNumericFields 递归求和"成立 ✅
3. **facts idx 72 ref :52**：`TokenStatsTimeRanges.granularityFor(range)` 在 TokenStatsQueryService.kt:50，窗口 47–57 同时覆盖 granularityFor 调用、bucketStarts 与按桶聚合 ✅
4. **facts idx 80 ref :160**：`if (usageRow.totalInputKnown > 0L)` 在 TokenStatsQueryService.kt:160，窗口 155–165 覆盖 totalInput 分量与 else 合并 uncached+cached+cacheWrite ✅
5. **[145] 拆 2 条**：idx 144 "COUNT 行用第 6 段作 pricePerRequest" ref :119，窗口覆盖 `countPricing(pricePerRequest = tokenCachedOrCountPrice)`（:121）；idx 145 "TOKEN 行第 6 段>0 作 cached 单价否则 input 单价" ref :129，窗口覆盖 `tokenCachedOrCountPrice.takeIf { it > 0.0 } ?: inputPrice` ✅
6. **Q3（idx 3）evidence**：与 TokenTrackingAIService.kt:279–281 逐字一致（去缩进后）——`val separator = providerModel.indexOf(':')` / `require(separator > 0 && separator < providerModel.lastIndex) {` / `"provider:model is required for token usage events"`；description 已同步精确 ✅
7. **Q4（idx 4）evidence**：与 ApiPreferences.kt:562 逐字一致——`require(settings.size == 1) { "Conflicting released prices for ${identity.first}:${identity.second}" }` ✅
8. **Q5（idx 5）evidence**：与 ModelThinkingConfigDefaultsCollect.kt:406–408 逐字一致——`val source = JSONArray(DEFAULT_JSON)` / `val target = JSONArray()` / `for (index in 0 until source.length()) {`，无 `...` 占位符、变量名正确 ✅
9. **Q6（idx 6）evidence**：与 ScrapedModelPricingRowsCollect.kt:4–6 逐字一致——首行 `OPENAI|chatgpt-4o-latest|TOKEN|15|45|0|USD`；虚构行 `OPENAI|gpt-4o|TOKEN|2.5|10|1.25|USD` 经 grep 确认源码中不存在（现存的 gpt-4o 两行价格为 1.5|6|0，与 evidence 无关）✅
10. **Q7（idx 7）evidence**：与 ModelPricingDefaultsCollect.kt:230–235 逐字一致（去缩进后），`line: 229` ✅
11. **refs_valid**：已改写为 "209/209…"，与实测 facts 209 条一致（[145] 拆分使 208→209）✅

### 全量复查

- **facts 209/209**：程序化校验（文件存在、行号整数且不越界、仅 fact/ref 双键）0 坏引用；14 条随机抽样人工核 ±5 窗口全部有支撑原文；3 处重复锚点（均为 ProviderUsageSnapshot.kt 导入/声明行，双事实共用）属正常，非硬问题。
- **quality 9/9**：evidence 全部逐字命中源码；severity 5 warn / 4 suggestion、高危 0，分级合理无夸大（与首轮结论一致）。
- **正文**：MNN/LLAMA_CPP 停止维护醒目标注（md:194，加粗）；结构齐全；与 facts 无矛盾。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"全 0。
- **status.json**：issue 68（整数）、review-pending、operit、commit 一字不差。
- **lint**：单页隔离独立重跑（/tmp/lint-sp，--out 指目录外）：**硬失败 0 / 警告 0**。

### 结论

11 项硬问题全部修错合格，无新增问题。**复验通过，本页已达收货标准，可进入发布队列。** 未给 Issue 留言。
