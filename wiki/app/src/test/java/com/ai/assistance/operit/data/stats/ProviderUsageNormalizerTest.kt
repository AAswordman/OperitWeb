package com.ai.assistance.operit.data.stats

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * provider 原始 usage → 阶段 1 契约归一化测试。
 *
 * 语义要点：
 * - 未知（缺失字段）→ null；确认 0 → 0（例如无缓存读取、无缓存写入）；
 * - OpenAI 系 completion_tokens 包含推理 → reasoningIncludedInOutput = true；
 * - Anthropic input_tokens 不含缓存分量（文档：总量 = input + cache_read + cache_creation），
 *   缓存写入独立保留、独立计费；
 * - Gemini candidatesTokenCount 不含 thoughtsTokenCount（官方 API 独立字段，
 *   思考 token 按输出计费）→ 推理未包含在输出。
 */
class ProviderUsageNormalizerTest {

    // ==== OpenAI chat/completions ====

    @Test
    fun `openai chat completions splits cached input and keeps cache write and reasoning`() {
        val usage =
            JSONObject(
                """
                {
                  "prompt_tokens": 1000,
                  "completion_tokens": 500,
                  "prompt_tokens_details": {"cached_tokens": 200},
                  "output_tokens_details": {"reasoning_tokens": 50}
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.openAiChatCompletions(usage)!!
        assertEquals(800L, snapshot.uncachedInputTokens)
        assertEquals(200L, snapshot.cachedInputTokens)
        assertEquals(1000L, snapshot.totalInputTokens)
        assertNull("cache write not provided -> unknown", snapshot.cacheWriteTokens)
        assertFalse("OpenAI 无独立缓存写入计费概念", snapshot.cacheWriteSeparateBilling)
        assertEquals(500L, snapshot.outputTokens)
        assertEquals(50L, snapshot.reasoningTokens)
        assertEquals(true, snapshot.reasoningIncludedInOutput)
        assertEquals(ProviderUsageNormalizer.SOURCE_OPENAI_CHAT_COMPLETIONS, snapshot.source)
    }

    @Test
    fun `openai chat completions supports cache creation and zero-cached semantics`() {
        val usage =
            JSONObject(
                """
                {
                  "prompt_tokens": 900,
                  "completion_tokens": 100,
                  "prompt_tokens_details": {"cached_tokens": 0, "cache_creation_input_tokens": 300}
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.openAiChatCompletions(usage)!!
        assertEquals(900L, snapshot.uncachedInputTokens)
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(300L, snapshot.cacheWriteTokens)
        assertEquals(100L, snapshot.outputTokens)
    }

    @Test
    fun `openai chat completions returns null when no usage present`() {
        assertNull(ProviderUsageNormalizer.openAiChatCompletions(null))
        assertNull(ProviderUsageNormalizer.openAiChatCompletions(JSONObject("{}")))
    }

    @Test
    fun `openai without cached details keeps input split unknown not claiming uncached total`() {
        // 常规 OpenAI 响应常缺 prompt_tokens_details：cached 拆分未知时，
        // 不得把总输入确定为 uncached（分类确定性）
        val usage =
            JSONObject(
                """
                {
                  "prompt_tokens": 1000,
                  "completion_tokens": 500
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.openAiChatCompletions(usage)!!
        assertNull(snapshot.uncachedInputTokens)
        assertNull(snapshot.cachedInputTokens)
        // 拆分未知时仍保留 provider 明确上报的总输入（费用仅在单价相同时可算）
        assertEquals(1000L, snapshot.totalInputTokens)
        assertEquals(500L, snapshot.outputTokens)
        assertNull(snapshot.cacheWriteTokens)
        assertFalse(snapshot.cacheWriteSeparateBilling)
    }

    @Test
    fun `openai explicit zero cached split keeps uncached equal to total`() {
        val usage =
            JSONObject(
                """
                {
                  "prompt_tokens": 100,
                  "completion_tokens": 40,
                  "prompt_tokens_details": {"cached_tokens": 0}
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.openAiChatCompletions(usage)!!
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(100L, snapshot.uncachedInputTokens)
    }

    @Test
    fun `openai chat completions handles input_tokens aliases`() {
        val usage =
            JSONObject(
                """
                {
                  "input_tokens": 100,
                  "output_tokens": 40,
                  "input_tokens_details": {"cached_tokens": 30}
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.openAiChatCompletions(usage)!!
        assertEquals(70L, snapshot.uncachedInputTokens)
        assertEquals(30L, snapshot.cachedInputTokens)
        assertEquals(40L, snapshot.outputTokens)
    }

    // ==== OpenAI Responses API ====

    @Test
    fun `openai responses keeps reasoning tokens separately and marks included`() {
        val usage =
            JSONObject(
                """
                {
                  "input_tokens": 1000,
                  "output_tokens": 500,
                  "input_tokens_details": {"cached_tokens": 200},
                  "output_tokens_details": {"reasoning_tokens": 120}
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.openAiResponses(usage)!!
        assertEquals(800L, snapshot.uncachedInputTokens)
        assertEquals(200L, snapshot.cachedInputTokens)
        assertEquals(1000L, snapshot.totalInputTokens)
        assertEquals(500L, snapshot.outputTokens)
        assertEquals(120L, snapshot.reasoningTokens)
        assertEquals(true, snapshot.reasoningIncludedInOutput)
        assertFalse("OpenAI Responses 无独立缓存写入计费概念", snapshot.cacheWriteSeparateBilling)
        assertEquals(ProviderUsageNormalizer.SOURCE_OPENAI_RESPONSES, snapshot.source)
    }

    // ==== Anthropic ====

    @Test
    fun `anthropic keeps cache read and cache write as independent components`() {
        val usage =
            JSONObject(
                """
                {
                  "input_tokens": 500,
                  "cache_read_input_tokens": 200,
                  "cache_creation_input_tokens": 100,
                  "output_tokens": 300
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.anthropic(usage)!!
        // 文档语义：input_tokens 不含缓存分量，三个分量各自独立
        assertEquals(500L, snapshot.uncachedInputTokens)
        assertEquals(200L, snapshot.cachedInputTokens)
        assertEquals(100L, snapshot.cacheWriteTokens)
        assertEquals(800L, snapshot.totalInputTokens)
        assertEquals(300L, snapshot.outputTokens)
        assertNull("Anthropic 不提供独立推理 token", snapshot.reasoningTokens)
        assertEquals("Anthropic output_tokens 包含 thinking", true, snapshot.reasoningIncludedInOutput)
        assertTrue("Anthropic 缓存创建独立计费", snapshot.cacheWriteSeparateBilling)
    }

    @Test
    fun `anthropic zero cache components are explicit zeros not unknown`() {
        val usage =
            JSONObject(
                """
                {
                  "input_tokens": 50,
                  "cache_read_input_tokens": 0,
                  "cache_creation_input_tokens": 0,
                  "output_tokens": 10
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.anthropic(usage)!!
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(0L, snapshot.cacheWriteTokens)
    }

    @Test
    fun `anthropic absent cache fields stay unknown`() {
        val usage = JSONObject("""{"input_tokens": 50, "output_tokens": 10}""")
        val snapshot = ProviderUsageNormalizer.anthropic(usage)!!
        assertNull(snapshot.cachedInputTokens)
        assertNull(snapshot.cacheWriteTokens)
        // 无任何缓存分量：总输入即 input_tokens
        assertEquals(50L, snapshot.totalInputTokens)
    }

    // ==== Gemini ====

    @Test
    fun `gemini normalizes usage metadata with cached content and thoughts`() {
        val metadata =
            JSONObject(
                """
                {
                  "promptTokenCount": 1000,
                  "cachedContentTokenCount": 300,
                  "candidatesTokenCount": 400,
                  "thoughtsTokenCount": 90
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.gemini(metadata)!!
        assertEquals(700L, snapshot.uncachedInputTokens)
        assertEquals(300L, snapshot.cachedInputTokens)
        assertEquals(1000L, snapshot.totalInputTokens)
        assertNull("Gemini 无缓存写入概念", snapshot.cacheWriteTokens)
        assertEquals(400L, snapshot.outputTokens)
        assertEquals(90L, snapshot.reasoningTokens)
        assertEquals("candidatesTokenCount 不含 thought（独立计费）", false, snapshot.reasoningIncludedInOutput)
    }

    @Test
    fun `gemini thoughts are billed on top of candidates by cost layer`() {
        // P1-4：thoughtsTokenCount 独立于 candidatesTokenCount，计费输出 = candidates + thoughts。
        // prompt=100, candidates=20, thoughts=80 → billed output = 100。
        val metadata =
            JSONObject(
                """
                {
                  "promptTokenCount": 100,
                  "cachedContentTokenCount": 0,
                  "candidatesTokenCount": 20,
                  "thoughtsTokenCount": 80,
                  "totalTokenCount": 200
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.gemini(metadata)!!
        assertEquals(100L, snapshot.uncachedInputTokens)
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(20L, snapshot.outputTokens)
        assertEquals(80L, snapshot.reasoningTokens)
        assertEquals(false, snapshot.reasoningIncludedInOutput)
    }

    @Test
    fun `gemini usage metadata without candidates fields stays fully billable`() {
        // P1-4：prompt 被拦截时不返回 candidates，但 usageMetadata 仍然存在；provider
        // 层必须把该 usage 上报，归一化后应得到完整可计费快照（输入照常计费，输出为真实 0）。
        val metadata =
            JSONObject(
                """
                {
                  "promptTokenCount": 100,
                  "cachedContentTokenCount": 0,
                  "candidatesTokenCount": 0,
                  "thoughtsTokenCount": 0
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.gemini(metadata)!!
        assertEquals(100L, snapshot.uncachedInputTokens)
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(0L, snapshot.outputTokens)
        assertEquals(0L, snapshot.reasoningTokens)
        assertEquals(false, snapshot.reasoningIncludedInOutput)
    }

    @Test
    fun `gemini without thoughts field keeps reasoning unknown and cached split unknown`() {
        val metadata =
            JSONObject(
                """
                {
                  "promptTokenCount": 100,
                  "candidatesTokenCount": 20
                }
                """.trimIndent()
            )
        val snapshot = ProviderUsageNormalizer.gemini(metadata)!!
        assertNull(snapshot.reasoningTokens)
        // cachedContentTokenCount 缺失：cached 拆分未知，不得把总输入确定为 uncached
        assertNull(snapshot.cachedInputTokens)
        assertNull(snapshot.uncachedInputTokens)
        // 拆分未知时仍保留 provider 明确上报的总输入
        assertEquals(100L, snapshot.totalInputTokens)
        assertEquals(20L, snapshot.outputTokens)
        assertFalse("Gemini 无独立缓存写入计费概念", snapshot.cacheWriteSeparateBilling)
    }

    // ==== 本地模型 ====

    @Test
    fun `local providers preserve long measured counts with explicit zero cache`() {
        val inputTokens = Int.MAX_VALUE.toLong() + 1L
        val outputTokens = Int.MAX_VALUE.toLong() + 2L
        val snapshot = ProviderUsageNormalizer.local(inputTokens, outputTokens, ProviderUsageNormalizer.SOURCE_LLAMA)
        assertEquals(inputTokens, snapshot.uncachedInputTokens)
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(0L, snapshot.cacheWriteTokens)
        assertEquals(inputTokens, snapshot.totalInputTokens)
        assertEquals(outputTokens, snapshot.outputTokens)
        assertNull(snapshot.reasoningTokens)
        assertNull(snapshot.reasoningIncludedInOutput)
        assertFalse(snapshot.cacheWriteSeparateBilling)
    }

    // ==== ToolPkg ====

    @Test
    fun `toolpkg derives uncached from total minus cached`() {
        val snapshot =
            ProviderUsageNormalizer.toolPkg(
                input = 1000,
                cachedInput = 250,
                output = 300,
                completeSnapshot = true,
            )
        assertEquals(750L, snapshot.uncachedInputTokens)
        assertEquals(250L, snapshot.cachedInputTokens)
        assertEquals(1000L, snapshot.totalInputTokens)
        assertNull(snapshot.cacheWriteTokens)
        assertEquals(300L, snapshot.outputTokens)
        assertFalse(snapshot.cacheWriteSeparateBilling)
    }

    @Test
    fun `toolpkg cached greater than input keeps total but rejects split`() {
        val snapshot = ProviderUsageNormalizer.toolPkg(100L, 250L, 20L, true)
        assertEquals(100L, snapshot.totalInputTokens)
        assertNull(snapshot.uncachedInputTokens)
        assertNull(snapshot.cachedInputTokens)
    }

    @Test
    fun `toolpkg negative input components become unknown independently`() {
        val negativeInput = ProviderUsageNormalizer.toolPkg(-1L, 0L, 20L, true)
        assertNull(negativeInput.totalInputTokens)
        assertNull(negativeInput.uncachedInputTokens)
        assertNull(negativeInput.cachedInputTokens)

        val negativeCached = ProviderUsageNormalizer.toolPkg(100L, -1L, 20L, true)
        assertEquals(100L, negativeCached.totalInputTokens)
        assertNull(negativeCached.uncachedInputTokens)
        assertNull(negativeCached.cachedInputTokens)
    }

    @Test
    fun `toolpkg equal cached and input is a valid zero uncached boundary`() {
        val snapshot = ProviderUsageNormalizer.toolPkg(100L, 100L, 20L, true)
        assertEquals(0L, snapshot.uncachedInputTokens)
        assertEquals(100L, snapshot.cachedInputTokens)
        assertEquals(100L, snapshot.totalInputTokens)
    }

    // ==== 快照语义 ====

    @Test
    fun `negative provider values are rejected as unknown not recorded`() {
        // 评审 P2-5：负值/异常数据必须拒绝为未知，绝不静默落负数
        val negative =
            ProviderUsageNormalizer.openAiChatCompletions(
                JSONObject(
                    """{"prompt_tokens": -100, "completion_tokens": 500}"""
                )
            )
        // 负输入被拒 → uncached/total 未知；output 仍有效
        assertNull(negative!!.uncachedInputTokens)
        assertNull(negative.totalInputTokens)
        assertEquals(500L, negative.outputTokens)

        val negativeOutput =
            ProviderUsageNormalizer.openAiChatCompletions(
                JSONObject("""{"prompt_tokens": 100, "completion_tokens": -50}""")
            )
        assertEquals(100L, negativeOutput!!.totalInputTokens)
        assertNull("negative output must be unknown", negativeOutput.outputTokens)
    }

    @Test
    fun `values beyond int range are carried as long without overflow`() {
        // 评审 P2-5：JSON 值超过 Int 范围时必须原样以 Long 承载
        val huge =
            ProviderUsageNormalizer.openAiChatCompletions(
                JSONObject(
                    """{"prompt_tokens": 3000000000, "completion_tokens": 2500000000}"""
                )
            )
        // 拆分未知（无 prompt_tokens_details）时 uncached 必须保持未知（设计语义）；
        // 总量与输出仍以 Long 原样承载，绝不 Int 溢出
        assertNull(huge!!.uncachedInputTokens)
        assertEquals(3000000000L, huge.totalInputTokens)
        assertEquals(2500000000L, huge.outputTokens)
    }

    @Test
    fun `snapshot hasKnownFields keeps explicit zero components and drops fully unknown`() {
        // 完全无已知字段 → 无有效快照（normalizer 返回 null）
        assertFalse(ProviderUsageSnapshot(source = "t").hasKnownFields())

        // provider 明确全零也是有效快照：0 不得变成未知
        val zeroOnly =
            ProviderUsageSnapshot(
uncachedInputTokens = 0L,
cachedInputTokens = 0L,
outputTokens = 0L,
                source = "t",
            )
        assertTrue(zeroOnly.hasKnownFields())

        val withValue =
            ProviderUsageSnapshot(
uncachedInputTokens = 0L,
cachedInputTokens = 0L,
cacheWriteTokens = 5L,
outputTokens = 0L,
                source = "t",
            )
        assertTrue(withValue.hasKnownFields())
    }

    // ==== 评审 P1-5：显式全零 payload 按字段存在判断，0L 是真实 0 而非未知 ====

    @Test
    fun `openai chat completions explicit zero payload is observed usage`() {
        val snapshot =
            ProviderUsageNormalizer.openAiChatCompletions(
                JSONObject("""{"prompt_tokens": 0, "completion_tokens": 0}""")
            )!!
        assertEquals(0L, snapshot.totalInputTokens)
        assertEquals(0L, snapshot.outputTokens)
        assertNull("cached split absent stays unknown", snapshot.cachedInputTokens)
    }

    @Test
    fun `openai responses explicit zero payload is observed usage`() {
        val snapshot =
            ProviderUsageNormalizer.openAiResponses(
                JSONObject("""{"input_tokens": 0, "output_tokens": 0}""")
            )!!
        assertEquals(0L, snapshot.totalInputTokens)
        assertEquals(0L, snapshot.outputTokens)
    }

    @Test
    fun `anthropic explicit zero payload is observed usage`() {
        val snapshot =
            ProviderUsageNormalizer.anthropic(
                JSONObject("""{"input_tokens": 0, "output_tokens": 0}"""),
                completeSnapshot = true,
            )!!
        assertEquals(0L, snapshot.uncachedInputTokens)
        assertEquals(0L, snapshot.outputTokens)
    }

    @Test
    fun `gemini explicit zero payload is observed usage`() {
        val snapshot =
            ProviderUsageNormalizer.gemini(
                JSONObject(
                    """{"promptTokenCount": 0, "cachedContentTokenCount": 0, "candidatesTokenCount": 0}"""
                )
            )!!
        assertEquals(0L, snapshot.totalInputTokens)
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(0L, snapshot.outputTokens)
    }

    @Test
    fun `toolpkg explicit zero payload is observed usage`() {
        val snapshot =
            ProviderUsageNormalizer.toolPkg(
                input = 0L,
                cachedInput = 0L,
                output = 0L,
                completeSnapshot = true,
            )
        assertEquals(0L, snapshot.totalInputTokens)
        assertEquals(0L, snapshot.cachedInputTokens)
        assertEquals(0L, snapshot.outputTokens)
        assertEquals(0L, snapshot.uncachedInputTokens)
    }

    @Test
    fun `toolpkg missing fields stay unknown and never inherit counters`() {
        val snapshot =
            ProviderUsageNormalizer.toolPkg(
                input = null,
                cachedInput = null,
                output = 10L,
                completeSnapshot = false,
            )
        assertNull(snapshot.uncachedInputTokens)
        assertNull(snapshot.totalInputTokens)
        assertEquals(10L, snapshot.outputTokens)
    }
}
