---
title: Token 用量统计与模型定价数据
module: app
sources: 2
date: 2026-10-01
---

# Token 用量统计与模型定价数据

## 概述

- 这一页讲 App 里"这次对话花了多少 token、值多少钱"的整条链路：把各供应商五花八门的 usage 字段归一化、持久化记账，再用内置价格表加用户自定义定价算出费用，最后按时间桶聚合展示。
- 一句话：供应商 usage JSON → 统一成一套"可空分量快照"语义记账 → "用户设置优先、内置价格表兜底"的定价解析算费用 → 按时间桶聚合展示。
- 覆盖两个种子目录：`data/stats/`（15 个 .kt：用量采集、费用计算、定价解析、存储、查询、设置、显示）与 `data/collects/`（4 个 .kt：内置模型价格表、供应商默认 API 配置、推理参数默认规则）。

## AI 速览

- **核心符号**：`ProviderUsageSnapshot`（归一化用量快照）、`ProviderUsageNormalizer`（七路供应商解析器）、`TokenCostCalculator`（费用计算）、`TokenPriceResolver`（定价解析）、`DefaultModelPricingCollect` / `ScrapedModelPricingRowsCollect`（内置价格表）、`TokenUsageRepository`（Room 记账）、`TokenStatsQueryService`（聚合查询）、`TokenStatsSettingsManager`（用户定价设置）、`TokenStatsTimeRange` / `TokenStatsTimeRanges`（时间桶）、`TokenStatsPreferences`（DataStore 标量设置）、`TokenStatsDisplayUnit`（显示单位）、`ApiProviderConfigCollect`（供应商默认 API 配置）、`ModelThinkingConfigDefaultsCollect`（推理参数默认规则）。
- **主入口**：各供应商的 chat provider 在流收集结束时调用 `TokenTrackingAIService.finish()` 落账；统计页经 `TokenStatsQueryService.rangeData()` / `overviewData()` 拉聚合数据。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:270`
- **数据流向一句话**：供应商 usage JSON → `ProviderUsageNormalizer` 归一化为可空分量快照 → Room 持久化（token_usage_records）→ 定价解析（用户设置优先、内置表兜底）→ 费用换算 → 按时间桶聚合展示。

## 核心机制

### 用量采集归一化

- `ProviderUsageSnapshot` 是阶段 1 契约：null 表示"未知"（provider 没给），0 表示 provider 确认该分量为 0；任何字段都不准把"未知"静默当成 0；token 字段用 Long 承载防溢出，负值一律拒绝为未知。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:8`
- `completeSnapshot` 区分上报语义：true=完整快照（null 覆盖旧值，即"撤销"）；false=部分更新（null 保留旧值）。流式增量上报（Anthropic message_start/message_delta、ToolPkg 新协议 attempt 内流式更新）是部分更新；最终响应 usage（OpenAI、Anthropic 非流式、本地实测、ToolPkg 旧协议请求级累计）是完整快照。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:12`
- `cacheWriteSeparateBilling` 标记缓存写入是否独立计费，默认 true 保守：未声明时缺失的缓存写入分量仍按未知处理。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:20`
- `reasoningIncludedInOutput`：true=provider 的 output 已含推理 token（计费时不得再加）；false=推理独立计数；null=provider 未声明，计费按"已包含"处理，避免重复收费。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:23`
- `totalInputTokens` 是 provider 明确上报的总输入（冗余字段，供拆分未知场景用）；拆分已知时 uncached+cached 即总输入，绝不伪造 uncached。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:26`
- `ProviderUsageNormalizer` 提供 7 个来源常量与对应的解析函数。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:79`
- OpenAI chat/completions 系（含 DeepSeek、Kimi、Qwen、Mistral 等兼容端点）：单次上报即该 attempt 的完整最终 usage，`completeSnapshot` 默认 true。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:86`
- OpenAI 兼容系 `reasoningIncludedInOutput=true`（completion_tokens 已含推理），缓存写入成本含在输入单价内、无独立计费概念。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:129`
- Anthropic：官方文档明确 input_tokens 不含缓存分量（总量=三者之和），三个分量各自独立保留；缓存写入单独计费。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:64`
- Anthropic 流式 message_start/message_delta 是部分更新（completeSnapshot 默认 false），非流式最终响应是完整快照。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:193`
- Anthropic 缓存写入独立计费（cacheWriteSeparateBilling=true），字段缺失即该分量未知。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:231`
- Gemini：`thoughtsTokenCount` 是官方 API 独立字段，不含在 candidatesTokenCount 内，按输出计费 → reasoningIncludedInOutput=false。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:240`
- 本地模型（llama.cpp/MNN）：没有 provider usage 对象，token 为本地实测计数（tokenizer 计数 + 逐 token 生成计数），缓存分量明确为 0；单次完整上报。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:282`
- ToolPkg 新协议：缺省字段=未知，绝不继承全局累计计数；负值拒绝为未知。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:306`
- ToolPkg 要求 cachedInput <= input 才承认拆分有效，否则 uncached 与 cached 保持未知、只保留 totalInput。
  `app/src/main/java/com/ai/assistance/operit/data/stats/ProviderUsageSnapshot.kt:318`

### 费用计算

- `TokenCostCalculator.saturatedAdd` 做饱和加法，Long 溢出时钳制而非回绕。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenCostCalculator.kt:8`
- COUNT 模式（按次计费）：费用 = pricePerRequest × requests。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenCostCalculator.kt:20`
- TOKEN 模式：三项输入单价（input/cachedInput/cacheWrite）相等时按 totalInput 一次算，否则分开算。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenCostCalculator.kt:35`
- TOKEN 模式的输出单独按输出单价算；四项单价全 ≤0 时，未知费用贡献计数 = 全部 requests。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenCostCalculator.kt:50`
- `TokenCostCurrency.convertTo`：同币种直接返回；目标为 USD 时乘汇率，其他目标除以汇率。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenCostCalculator.kt:87`
- 默认 USD→CNY 汇率为 7.0。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenCostCalculator.kt:79`

### 定价解析与内置价格表

- 定价来源三态 `PricingSource`：BUILT_IN（内置）、USER（用户设置）、UNKNOWN。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatTypes.kt:4`
- `TokenPriceResolver` 优先级：用户设置优先，其次内置表。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenPriceResolver.kt:63`
- cached 单价回退链：用户 cached → 用户 input → 内置 cached。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenPriceResolver.kt:68`
- cacheWrite 单价回退链：用户 cacheWrite → 用户 input → 内置 input。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenPriceResolver.kt:78`
- source 判定：有任意用户设置 → USER，否则 → BUILT_IN。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenPriceResolver.kt:79`
- 定价缓存 key 由 `tokenPriceConfigKey` 生成，providerModel 与 configId 之间用 \u001f 分隔。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenPriceResolver.kt:48`
- `PricingCurrency` 只有 CNY（¥）与 USD（$）两种。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelPricingDefaultsCollect.kt:9`
- `domesticProviders` 列出 16 个国内供应商，用于默认 CNY 币种。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelPricingDefaultsCollect.kt:23`
- 按次默认价：CNY→0.01，USD→0.001。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelPricingDefaultsCollect.kt:43`
- `getDefaultPricing` 先按 "provider:model" 精确匹配内置表。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelPricingDefaultsCollect.kt:207`
- 精确匹配 miss 时按模型名回退（优先同币种）、provider 兜底，最终按国内外给 zeroPricing。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelPricingDefaultsCollect.kt:232`
- 模型名回退时优先选与 provider 国内外属性一致币种的候选项。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelPricingDefaultsCollect.kt:218`
- `ScrapedModelPricingRowsCollect.rows` 是 `|` 分隔的原始定价行（provider|model|billingMode|inputPerM|outputPerM|cachedOrCount|currency），由多个三引号字符串块合并。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ScrapedModelPricingRowsCollect.kt:4`
- DeepSeek 价格块标注 "Synced with DeepSeek official pricing on 2026-05-07"；deepseek-chat 输入 1、输出 2、缓存 0.02（CNY/百万 token）。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ScrapedModelPricingRowsCollect.kt:504`
- COUNT 计费行示例：gpt-4o-mini-tts 按次 0.18 USD。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ScrapedModelPricingRowsCollect.kt:36`

### 存储、迁移与聚合查询

- `TokenUsageRepository` 是 Room 持有者（单例 `getInstance`）。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenUsageRepository.kt:22`
- `withDatabaseAccess` 保护 restore 并发；`ensureInitialized` 做一次性迁移，importedAtMs 为 null 才执行。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenUsageRepository.kt:43`
- 迁移行的 importKey=`legacy-cumulative:{provider}:{model}`，occurredAtMs=null（累计量无发生时间）。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenUsageRepository.kt:56`
- `record()` 是持久化入口。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenUsageRepository.kt:103`
- `TokenUsageRecordEntity.providerModel` = "$provider:$model"。
  `app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt:31`
- token_usage_records 对 importKey 建唯一索引。
  `app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt:13`
- token_stats_models 联合主键为 (configId, provider, model)。
  `app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt:7`
- configId 为空表示模型级定价（configuration-unscoped）。
  `app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt:10`
- `TokenUsageDao.insertRecord` 冲突策略 REPLACE；聚合 SQL 按 provider/model/configId 分组，known 计数=SUM(分量非空时的 requestCount)。
  `app/src/main/java/com/ai/assistance/operit/data/dao/TokenUsageDao.kt:100`
- `TokenStatsQueryService` 是 SQL-backed：只有聚合行离开 Room；rangeData 每桶独立聚合查询。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsQueryService.kt:66`
- 展示模型按 totals.totalTokens.knownSum 降序排列。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsQueryService.kt:144`
- `TokenStatsTimeRange` 是半开区间 [startMs, endMs)，endMs 须大于 startMs。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRange.kt:8`
- 粒度：时长 ≤12h 用 10 分钟，≤48h 用 1 小时，更长用 1 自然日。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRange.kt:53`
- 桶数上限 MAX_BUCKETS=10000，超限抛错以防病态输入拖垮内存/UI。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRange.kt:42`
- 桶边界在本地时间对齐（10 分钟整点、整点小时、自然日 0 点），用 java.time 日历推进：跨 DST 的小时/日桶自动得到 23/25 小时的正确 epoch 跨度。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRange.kt:31`
- 旧总量迁移：`ApiPreferences.readTokenStatsMigrationSnapshot` 按 token_input_/token_cached_input_/token_output_/request_count_ 前缀收集旧 key。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:493`
- 解码失败的旧 key 被跳过并打警告日志，允许其余迁移继续。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:515`
- 同一 provider:model 的多个旧 key 用 ReleasedTokenUsageTotal.plus 合并。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:538`
- 旧价格冲突（同一模型多组不同设置）时 require 抛错。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:562`
- 迁移的旧 COUNT 价格货币记为 CNY，否则记为 USD。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:553`

### 用户定价设置与显示

- `TokenStatsSettingsManager` 支持 PROVIDER_MODEL/CONFIG 双作用域。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsSettingsManager.kt:10`
- `validatePriceValue` 对非有限/负数价格抛错。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsSettingsManager.kt:46`
- TOKEN 计费只保存四项 token 单价字段，非 TOKEN 时存 null；COUNT 计费只保存 pricePerRequest。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsSettingsManager.kt:72`
- `restoreBuiltInPrice` 清除模型级定价后删除空行。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsSettingsManager.kt:125`
- `resetConfigPrice` 清除配置级定价后删除空行。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsSettingsManager.kt:133`
- `TokenStatsPreferences` 基于 DataStore "token_stats_preferences" 存标量统计设置。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsPreferences.kt:15`
- 无存储汇率时返回 (7.0, true)，true 表示该值是估计值。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsPreferences.kt:43`
- 默认目标货币 CNY、显示单位 MILLIONS、活动视图 DAILY。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsPreferences.kt:57`
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsPreferences.kt:67`
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsPreferences.kt:76`
- `TokenStatsDisplayUnit`：<1M 时 <1000 原样、≥1000 显示 %.1fK。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsDisplayUnit.kt:19`
- ≥1M 时 MILLIONS→%.1fM、BILLIONS→%.3fB，均用 Locale.US。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsDisplayUnit.kt:25`

### 供应商默认 API 配置与推理参数默认

- `ApiProviderConfigCollect` 以 ApiProviderType 为 key 收录 38 个供应商的默认 API 配置。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:19`
- 6 个不要求 API Key：OPENAI_CODEX、LMSTUDIO、OLLAMA、OPENAI_LOCAL、MNN、LLAMA_CPP。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:40`
- `requiresApiKey`：配置不要求时直接 false，否则 loopback 端点也视为不需要。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:318`
- 未知 providerTypeId 时回退为 `!isLoopbackEndpoint(apiEndpoint)`。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:326`
- loopback 主机含 localhost/127.0.0.1/::1/0.0.0.0/10.0.2.2（覆盖 Android 模拟器）。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:359`
- DEEPSEEK 提供 Chat Completions 与 Responses 两个可选端点；ZHIPU 提供国内标准/国内 coding/国际标准/国际 coding 四个可选端点。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:79`
- `ModelThinkingConfigDefaultsCollect.DEFAULT_JSON` 是按供应商区分的推理参数默认规则数组。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:8`
- control 有 levels（多档可调）、toggle_only（仅开关）、unsupported（不支持）三态。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:15`
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:137`
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:29`
- mnn-llama-template-thinking-toggle 为 MNN/LLAMA_CPP 提供 thinking 开关默认——注意：MNN 与 LLAMA_CPP 端侧推理引擎已**停止维护**，该规则仅作历史兼容保留。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:318`
- `forProvider(providerTypeId)` 大小写不敏感过滤规则，返回时剥离 providers/providerTypeIds 字段；空 provider 返回 "[]"。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:406`

## 关键符号

- `ProviderUsageSnapshot`：归一化用量快照，可空分量 + 上报语义（null=未知、completeSnapshot、cacheWriteSeparateBilling、reasoningIncludedInOutput）。
- `ProviderUsageNormalizer`：七路供应商解析器（openAiChatCompletions/openAiResponses/anthropic/gemini/local/toolPkg 等）。
- `TokenCostCalculator`：费用计算（TOKEN/COUNT 双模式、饱和加、货币换算）。
- `TokenPriceResolver`：定价解析（用户设置优先、内置表兜底、单价回退链）。
- `PricingSource`：定价来源三态（BUILT_IN/USER/UNKNOWN）。
- `BillingMode`：计费模式（TOKEN 按 token / COUNT 按次）；fromString 无法解析默认 TOKEN。
  `app/src/main/java/com/ai/assistance/operit/data/model/BillingMode.kt:15`
- `DefaultModelPricingCollect`：内置定价查询入口（精确匹配→模型名回退→provider 兜底→zeroPricing）。
- `ScrapedModelPricingRowsCollect`：硬编码抓取价格表原始行。
- `TokenUsageRepository`：Room 记账入口（单例、一次性迁移、record）。
- `TokenStatsQueryService`：聚合查询（overviewData/rangeData/activityData），SQL-backed。
- `TokenStatsSettingsManager`：用户定价 CRUD（PROVIDER_MODEL/CONFIG 双作用域）。
- `TokenStatsTimeRange` / `TokenStatsTimeRanges`：半开区间与时间桶计算（本地时间对齐、DST 自适应）。
- `TokenStatsPreferences`：DataStore 标量设置（汇率/货币/显示单位/视图/时间范围）。
- `TokenStatsDisplayUnit`：token 数量显示单位（MILLIONS/BILLIONS）。
- `ReleasedProviderModelKeyDecoder`：released 时代 provider_model 旧 key 解码。
- `TokenUsageLegacyNormalizer`：v20→v21 历史行 cacheWrite 缺失修补（只改内存形态）。
- `ApiProviderConfigCollect`：38 供应商默认 API 配置。
- `ModelThinkingConfigDefaultsCollect`：推理参数默认规则（forProvider）。

## 调用链

1. **输入**：各供应商 chat provider 在流收集结束时，把供应商原始 usage JSON 交给 `TokenTrackingAIService.finish()`；finish() 在 reasoningIncludedInOutput==false 时把 reasoningTokens 并入 output（饱和加），在 cacheWriteSeparateBilling=false 时把 cacheWriteTokens 持久化为 0L，并用 markPersisted() 保证单条记录只持久化一次。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:287`
2. **处理**：`ProviderUsageNormalizer` 按供应商把 usage 归一化为 `ProviderUsageSnapshot`；`TokenUsageRepository.record()` 写入 Room（token_usage_records）；首次启动时 `ensureInitialized()` 把 DataStore 旧总量 key 迁移为 importKey=`legacy-cumulative:{provider}:{model}` 的历史行。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenUsageRepository.kt:103`
3. **输出**：统计页调用 `TokenStatsQueryService.rangeData()` / `overviewData()`，SQL 按 provider/model/configId 聚合；`TokenPriceResolver` 按"用户设置优先、内置表兜底"解析定价；`TokenCostCalculator` 算出费用并按目标货币换算；`TokenStatsTimeRanges` 把时间范围切成展示桶。
  `app/src/main/java/com/ai/assistance/operit/data/stats/TokenStatsQueryService.kt:66`

## 来源

- 种子目录：`app/src/main/java/com/ai/assistance/operit/data/stats/`（15 个 .kt）、`app/src/main/java/com/ai/assistance/operit/data/collects/`（4 个 .kt），源码 commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`。
- 关联调用方/被调用方：`api/chat/llmprovider/TokenTrackingAIService.kt`（落账）、`data/preferences/ApiPreferences.kt`（旧总量迁移）、`data/model/`（BillingMode/实体/ProviderIdentityUtils）、`data/dao/TokenUsageDao.kt`（聚合 SQL）。
- 事实清单：`data-stats-pricing.facts.json`（208 条原子事实）；代码走查：`data-stats-pricing.quality.json`（9 条：警告 5 / 建议 4）。
