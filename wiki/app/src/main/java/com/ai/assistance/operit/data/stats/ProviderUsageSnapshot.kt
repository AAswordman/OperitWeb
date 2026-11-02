package com.ai.assistance.operit.data.stats

import org.json.JSONObject

/**
 * provider 适配层规范化后的 usage 快照（阶段 1 契约 + 诊断标签）。
 *
 * - null 字段表示“未知”（provider 未提供），0 表示 provider 确认该分量为 0
 *   （例如确认无缓存读取/无缓存写入）；任何字段都不得静默把“未知”当作 0；
 *   token 字段使用 [Long] 承载，聚合以 Long 运算避免 Int 溢出，负值一律拒绝为未知。
 * - [completeSnapshot]：本次上报的语义。true = 完整快照（null 字段 = 明确未知，
 *   同一 attempt 合并时覆盖旧值，即“撤销”旧值）；false = 部分更新（null = 字段
 *   省略，保留旧值）。流式增量上报（Anthropic message_start/message_delta、
 *   ToolPkg 新协议 attempt 内的流式更新）是部分更新；最终响应 usage（OpenAI、
 *   Anthropic 非流式、本地实测、ToolPkg 旧协议请求级累计）是完整快照。
 * - [cacheWriteSeparateBilling]：provider 的计费模型是否把“缓存写入”作为独立
 *   计费分量。false = 无独立缓存写入计费概念（OpenAI 兼容系/Gemini/本地/ToolPkg：
 *   缓存写入成本已包含在输入单价内，字段缺失不阻碍费用计算）；true = 缓存写入
 *   独立计费（Anthropic），此时该分量未知会导致费用未知。默认 true 保持保守：
 *   未声明时缺失缓存写入字段仍按未知处理。
 * - [reasoningIncludedInOutput]：true = provider 的 output 计数已包含推理 token
 *   （计费时不得再加推理）；false = 推理独立计数；null = provider 未声明，
 *   计费按“已包含”处理以避免重复收费。
 * - [totalInputTokens]：provider 明确上报的**总输入**（含缓存命中/缓存写入）。
 *   当 cached/uncached 拆分未知（如 OpenAI 兼容端点缺 prompt_tokens_details、
 *   Gemini 缺 cachedContentTokenCount）时，总输入仍可表达“至少这么多输入”；
 *   费用只有在 cached/uncached 单价相同（拆分不影响计费）时才可按总输入计算，
 *   否则仍保持未知。拆分已知时 [uncachedInputTokens] + [cachedInputTokens]
 *   即总输入，本字段为冗余可空冗余（用于拆分未知场景，绝不伪造 uncached）。
 * - [source] 是诊断用的来源标签（哪个解析路径），不含任何凭据或正文。
 */
data class ProviderUsageSnapshot(
    val uncachedInputTokens: Long? = null,
    val cachedInputTokens: Long? = null,
    val cacheWriteTokens: Long? = null,
    val totalInputTokens: Long? = null,
    val outputTokens: Long? = null,
    val reasoningTokens: Long? = null,
    val reasoningIncludedInOutput: Boolean? = null,
    val cacheWriteSeparateBilling: Boolean = true,
    /** true = 完整快照（null 覆盖旧值）；false = 部分更新（null 保留旧值）。 */
    val completeSnapshot: Boolean = false,
    val source: String,
) {
    /** 是否有任何已知用量分量（含明确 0；完全无已知字段才为 false）。 */
    fun hasKnownFields(): Boolean =
        uncachedInputTokens != null ||
            cachedInputTokens != null ||
            cacheWriteTokens != null ||
            totalInputTokens != null ||
            outputTokens != null ||
            reasoningTokens != null
}

/**
 * provider 原始 usage → 阶段 1 契约的归一化（provider 适配层）。
 *
 * 语义事实：
 * - OpenAI 兼容系：`prompt_tokens`/`completion_tokens` 已包含缓存命中与推理 token，
 *   因此 [ProviderUsageSnapshot.cachedInputTokens] 从 `prompt_tokens_details.cached_tokens`
 *   提取、[ProviderUsageSnapshot.uncachedInputTokens] 为差值；`completion_tokens` 包含
 *   推理 → [ProviderUsageSnapshot.reasoningIncludedInOutput] = true。
 * - Anthropic：文档明确 `input_tokens` **不含** `cache_read_input_tokens` 与
 *   `cache_creation_input_tokens`（总量 = 三者之和），因此三个分量各自独立保留，
 *   缓存写入单独计费；`output_tokens` 包含 thinking → 推理已包含在输出。
 * - Gemini：`candidatesTokenCount` 是 response candidates token，`thoughtsTokenCount`
 *   是思考 token（官方 API 独立字段，不含在 candidatesTokenCount 内，按输出计费）
 *   → 计费时输出 = candidates + thoughts。
 * - 本地模型（llama/MNN）：没有 provider usage 对象，token 为本地实测计数
 *   （tokenizer 计数 + 逐 token 生成计数），缓存分量明确为 0。
 *
 * 不保存正文、API key、Cookie 或 endpoint 凭据。
 */
object ProviderUsageNormalizer {

    const val SOURCE_OPENAI_CHAT_COMPLETIONS = "openai_chat_completions"
    const val SOURCE_OPENAI_RESPONSES = "openai_responses"
    const val SOURCE_ANTHROPIC = "anthropic"
    const val SOURCE_GEMINI = "gemini"
    const val SOURCE_LLAMA = "llama_cpp"
    const val SOURCE_MNN = "mnn"
    const val SOURCE_TOOLPKG = "toolpkg_js"

    /** OpenAI chat/completions 系（含 DeepSeek、Kimi、Qwen、Mistral 等兼容端点）。
     *  单次上报即该 attempt 的完整最终 usage → [completeSnapshot] = true。 */
    fun openAiChatCompletions(
        usage: JSONObject?,
        completeSnapshot: Boolean = true,
    ): ProviderUsageSnapshot? {
        usage ?: return null
        val totalInput = usage.optLong("prompt_tokens", usage.optLong("input_tokens", -1))
        val output = usage.optLong("completion_tokens", usage.optLong("output_tokens", -1))
        val cached =
            usage.optJSONObject("prompt_tokens_details")
                ?.optLong("cached_tokens", -1)
                ?.takeIf { it >= 0 }
                ?: usage.optJSONObject("input_tokens_details")
                    ?.optLong("cached_tokens", -1)
                    ?.takeIf { it >= 0 }
                ?: usage.optLong("cached_tokens", -1).takeIf { it >= 0 }
        val cacheWrite =
            usage.optJSONObject("prompt_tokens_details")
                ?.optLong("cache_creation_input_tokens", -1)
                ?.takeIf { it >= 0 }
                ?: usage.optJSONObject("input_tokens_details")
                    ?.optLong("cache_creation_input_tokens", -1)
                    ?.takeIf { it >= 0 }
                ?: usage.optLong("cache_creation_input_tokens", -1).takeIf { it >= 0 }
        val reasoning =
            usage.optJSONObject("output_tokens_details")
                ?.optLong("reasoning_tokens", -1)
                ?.takeIf { it >= 0 }

        val uncached = if (totalInput >= 0 && cached != null) {
            (totalInput - cached).coerceAtLeast(0)
        } else {
            // cached 拆分未知时不得把总输入确定为 uncached（分类确定性）
            null
        }
        val snapshot =
            ProviderUsageSnapshot(
                uncachedInputTokens = uncached,
                cachedInputTokens = cached,
                cacheWriteTokens = cacheWrite,
                // 拆分未知时仍保留 provider 明确上报的总输入（费用仅在单价相同时可算）
                totalInputTokens = totalInput.takeIf { it >= 0 },
                outputTokens = output.takeIf { it >= 0 },
                reasoningTokens = reasoning,
                reasoningIncludedInOutput = true,
                // OpenAI 兼容系缓存写入成本已包含在输入单价内，无独立计费概念
                cacheWriteSeparateBilling = false,
                completeSnapshot = completeSnapshot,
                source = SOURCE_OPENAI_CHAT_COMPLETIONS,
            )
        return snapshot.takeIf { it.hasKnownFields() }
    }

    /** OpenAI Responses API：`input_tokens_details.cached_tokens` + `output_tokens_details.reasoning_tokens`。
     *  单次上报即完整最终 usage → [completeSnapshot] = true。 */
    fun openAiResponses(
        usage: JSONObject?,
        completeSnapshot: Boolean = true,
    ): ProviderUsageSnapshot? {
        usage ?: return null
        val totalInput = usage.optLong("input_tokens", -1)
        val output = usage.optLong("output_tokens", -1)
        val cached =
            usage.optJSONObject("input_tokens_details")
                ?.optLong("cached_tokens", -1)
                ?.takeIf { it >= 0 }
        val reasoning =
            usage.optJSONObject("output_tokens_details")
                ?.optLong("reasoning_tokens", -1)
                ?.takeIf { it >= 0 }
        val cacheWrite =
            usage.optJSONObject("input_tokens_details")
                ?.optLong("cache_creation_input_tokens", -1)
                ?.takeIf { it >= 0 }
                ?: usage.optLong("cache_creation_input_tokens", -1).takeIf { it >= 0 }

        val uncached = if (totalInput >= 0 && cached != null) {
            (totalInput - cached).coerceAtLeast(0)
        } else {
            // cached 拆分未知时不得把总输入确定为 uncached（分类确定性）
            null
        }
        val snapshot =
            ProviderUsageSnapshot(
                uncachedInputTokens = uncached,
                cachedInputTokens = cached,
                cacheWriteTokens = cacheWrite,
                // 拆分未知时仍保留 provider 明确上报的总输入（费用仅在单价相同时可算）
                totalInputTokens = totalInput.takeIf { it >= 0 },
                outputTokens = output.takeIf { it >= 0 },
                reasoningTokens = reasoning,
                reasoningIncludedInOutput = true,
                // OpenAI Responses 与 chat/completions 一致：无独立缓存写入计费
                cacheWriteSeparateBilling = false,
                completeSnapshot = completeSnapshot,
                source = SOURCE_OPENAI_RESPONSES,
            )
        return snapshot.takeIf { it.hasKnownFields() }
    }

    /**
     * Anthropic Messages API。`input_tokens` 不含缓存分量（官方文档：总量 =
     * input_tokens + cache_read_input_tokens + cache_creation_input_tokens），
     * 因此 uncached/cached/cacheWrite 直接取各自字段，缓存写入独立计费。
     *
     * 流式 message_start/message_delta 是**部分更新**（[completeSnapshot] = false，
     * 省略字段保留旧值）；非流式最终响应是完整快照（true，null 覆盖旧值）。
     */
    fun anthropic(
        usage: JSONObject?,
        completeSnapshot: Boolean = false,
    ): ProviderUsageSnapshot? {
        usage ?: return null
        val input = usage.optLong("input_tokens", -1).takeIf { it >= 0 }
        val cached =
            usage.optLong("cache_read_input_tokens", -1).takeIf { it >= 0 }
                ?: usage.optJSONObject("input_tokens_details")
                    ?.optLong("cached_tokens", -1)
                    ?.takeIf { it >= 0 }
                ?: usage.optLong("cached_tokens", -1).takeIf { it >= 0 }
        val cacheWrite =
            usage.optLong("cache_creation_input_tokens", -1).takeIf { it >= 0 }
                ?: usage.optJSONObject("cache_creation")
                    ?.let { sumNumericFields(it) }
                    ?.takeIf { it >= 0 }
        val output = usage.optLong("output_tokens", -1).takeIf { it >= 0 }
        val uncached = input
        // 总输入 = input + cache_read + cache_creation（官方文档语义）；
        // 全部已知才确定总量；无任何缓存分量时总输入即 input_tokens。
        val totalInput =
            when {
                cached != null && cacheWrite != null && uncached != null ->
                    uncached + cached + cacheWrite
                cached == null && cacheWrite == null -> uncached
                else -> null
            }
        val snapshot =
            ProviderUsageSnapshot(
                uncachedInputTokens = uncached,
                cachedInputTokens = cached,
                cacheWriteTokens = cacheWrite,
                totalInputTokens = totalInput,
                outputTokens = output,
                reasoningTokens = null,
                reasoningIncludedInOutput = true,
                // Anthropic：缓存创建独立计费；字段缺失即该分量未知
                cacheWriteSeparateBilling = true,
                completeSnapshot = completeSnapshot,
                source = SOURCE_ANTHROPIC,
            )
        return snapshot.takeIf { it.hasKnownFields() }
    }

    /** Gemini：`usageMetadata`；`candidatesTokenCount` 为 response candidates token，
     *  `thoughtsTokenCount` 为思考 token（官方 API 独立字段，按输出计费，不含在
     *  candidatesTokenCount 内）→ [reasoningIncludedInOutput] = false。
     *  流式逐 chunk 上报的是服务器累计快照，省略字段不代表撤销 → 保持部分更新。 */
    fun gemini(
        usageMetadata: JSONObject?,
        completeSnapshot: Boolean = false,
    ): ProviderUsageSnapshot? {
        usageMetadata ?: return null
        val prompt = usageMetadata.optLong("promptTokenCount", -1).takeIf { it >= 0 }
        val cached = usageMetadata.optLong("cachedContentTokenCount", -1).takeIf { it >= 0 }
        val output = usageMetadata.optLong("candidatesTokenCount", -1).takeIf { it >= 0 }
        val thoughts =
            if (usageMetadata.has("thoughtsTokenCount")) {
                usageMetadata.optLong("thoughtsTokenCount", 0)
            } else {
                null
            }

        val uncached = if (prompt != null && cached != null) {
            (prompt - cached).coerceAtLeast(0)
        } else {
            // cachedContentTokenCount 缺失（cached 拆分未知）时不得把总输入确定为 uncached
            null
        }
        val snapshot =
            ProviderUsageSnapshot(
                uncachedInputTokens = uncached,
                cachedInputTokens = cached,
                cacheWriteTokens = null,
                // 拆分未知时仍保留 provider 明确上报的总输入（费用仅在单价相同时可算）
                totalInputTokens = prompt,
                outputTokens = output,
                reasoningTokens = thoughts,
                // P1-4：thoughtsTokenCount 独立于 candidatesTokenCount，计费需另行补加
                reasoningIncludedInOutput = false,
                // Gemini 无独立缓存写入计费概念
                cacheWriteSeparateBilling = false,
                completeSnapshot = completeSnapshot,
                source = SOURCE_GEMINI,
            )
        return snapshot.takeIf { it.hasKnownFields() }
    }

    /** 本地模型（llama.cpp/MNN）：本地实测计数，缓存分量明确为 0；单次完整上报。 */
    fun local(
        uncachedInputTokens: Long,
        outputTokens: Long,
        source: String,
    ): ProviderUsageSnapshot =
        ProviderUsageSnapshot(
            uncachedInputTokens = uncachedInputTokens.coerceAtLeast(0L),
            cachedInputTokens = 0L,
            cacheWriteTokens = 0L,
            totalInputTokens = uncachedInputTokens.coerceAtLeast(0L),
            outputTokens = outputTokens.coerceAtLeast(0L),
            reasoningTokens = null,
            reasoningIncludedInOutput = null,
            cacheWriteSeparateBilling = false,
            completeSnapshot = true,
            source = source,
        )

    /**
     * ToolPkg JS provider：`input` 视为总量（含缓存命中），uncached 为差值。
     * [completeSnapshot] 由协议版本决定：新协议（携带 attempt）为同 attempt 内
     * 的部分更新；旧协议（无 attempt）为整个逻辑请求的累计完整快照。
     * 字段可空（评审 P1-6）：缺省字段 = 未知，绝不继承全局累计计数；跨 attempt
     * 聚合时缺失分量保持未知（不猜测）。Long 语义（评审 P2-1），负值拒绝为未知。
     */
    fun toolPkg(
        input: Long?,
        cachedInput: Long?,
        output: Long?,
        completeSnapshot: Boolean,
    ): ProviderUsageSnapshot {
        val validInput = input?.takeIf { it >= 0 }
        val validCachedInput = cachedInput?.takeIf { it >= 0 }
        val splitIsValid =
            validInput != null && validCachedInput != null && validCachedInput <= validInput
        val uncached =
            if (splitIsValid) validInput!! - validCachedInput!! else null
        return ProviderUsageSnapshot(
            uncachedInputTokens = uncached,
            cachedInputTokens = validCachedInput.takeIf { splitIsValid },
            cacheWriteTokens = null,
            totalInputTokens = validInput,
            outputTokens = output?.takeIf { it >= 0 },
            reasoningTokens = null,
            reasoningIncludedInOutput = null,
            cacheWriteSeparateBilling = false,
            completeSnapshot = completeSnapshot,
            source = SOURCE_TOOLPKG,
        )
    }

    private fun sumNumericFields(jsonObject: JSONObject): Long {
        var total = 0L
        val keys = jsonObject.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            when (val value = jsonObject.opt(key)) {
                is Number -> total += value.toLong()
                is JSONObject -> total += sumNumericFields(value)
                else -> {}
            }
        }
        return total
    }
}
