package com.ai.assistance.operit.api.chat.llmprovider

import com.ai.assistance.operit.data.stats.ProviderUsageNormalizer
import com.ai.assistance.operit.data.stats.ProviderUsageSnapshot
import com.ai.assistance.operit.util.exceptions.UserCancellationException
import java.io.IOException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * 本地 provider 生成结束顺序契约测试（评审 P2-3）：
 * 取消必须在工具缓冲转换/emit 之前判定——取消时无工具结果 emit、
 * 无 usage 上报、CANCELLED（UserCancellationException）传播；
 * 失败路径同样绝不 emit 工具缓冲或上报 usage。
 */
class LocalGenerationEndTest {

    @Test
    fun `cancel throws without emitting tool result or reporting usage`() = runBlocking {
        val usageReports = mutableListOf<ProviderUsageSnapshot>()
        val reporter = LocalUsageReporter(ProviderUsageNormalizer.SOURCE_LLAMA) { usage, attempt ->
            assertEquals(1, attempt)
            usageReports.add(usage)
        }
        var toolEmitted = false
        try {
            LocalGenerationEnd.end(
                cancelled = true,
                success = false,
                inputTokens = 300,
                outputTokens = 12,
                usageReporter = reporter,
                cancelMessage = "cancelled by user",
                emitToolResult = { toolEmitted = true },
                failWith = { fail("cancel path must not reach failWith") },
            )
            fail("cancellation must propagate")
        } catch (e: UserCancellationException) {
            assertEquals("cancelled by user", e.message)
        }
        // 取消时绝不 emit 不完整的工具 XML
        assertFalse("tool buffer must not be emitted on cancel", toolEmitted)
        assertEquals(0, usageReports.size)
    }

    @Test
    fun `success emits tool result and reports usage without throwing`() = runBlocking {
        val usageReports = mutableListOf<ProviderUsageSnapshot>()
        val reporter = LocalUsageReporter(ProviderUsageNormalizer.SOURCE_MNN) { usage, _ -> usageReports.add(usage) }
        var toolEmitted = false
        LocalGenerationEnd.end(
            cancelled = false,
            success = true,
            inputTokens = 100,
            outputTokens = 30,
            usageReporter = reporter,
            cancelMessage = "cancelled",
            emitToolResult = { toolEmitted = true },
            failWith = { fail("success path must not fail") },
        )
        assertTrue("tool result must be emitted when not cancelled", toolEmitted)
        assertEquals(1, usageReports.size)
        assertEquals(100L, usageReports[0].uncachedInputTokens)
        assertEquals(30L, usageReports[0].outputTokens)
    }

    @Test
    fun `failure fails without emitting tool result or reporting usage`() = runBlocking {
        val usageReports = mutableListOf<ProviderUsageSnapshot>()
        val reporter = LocalUsageReporter(ProviderUsageNormalizer.SOURCE_LLAMA) { usage, _ -> usageReports.add(usage) }
        var toolEmitted = false
        try {
            LocalGenerationEnd.end(
                cancelled = false,
                success = false,
                inputTokens = 200,
                outputTokens = 5,
                usageReporter = reporter,
                cancelMessage = "cancelled",
                emitToolResult = { toolEmitted = true },
                failWith = { throw IOException("inference failed") },
            )
            fail("failure must propagate")
        } catch (e: IOException) {
            assertEquals("inference failed", e.message)
        }
        // 失败路径绝不转换/emit 不完整的工具 XML
        assertFalse("tool buffer must not be emitted on failure", toolEmitted)
        assertEquals(0, usageReports.size)
    }

    @Test
    fun `failure never emits tool result even if failWith returns normally`() = runBlocking {
        val usageReports = mutableListOf<ProviderUsageSnapshot>()
        val reporter = LocalUsageReporter(ProviderUsageNormalizer.SOURCE_MNN) { usage, _ -> usageReports.add(usage) }
        var toolEmitted = false
        LocalGenerationEnd.end(
            cancelled = false,
            success = false,
            inputTokens = 80,
            outputTokens = 2,
            usageReporter = reporter,
            cancelMessage = "cancelled",
            emitToolResult = { toolEmitted = true },
            failWith = {},
        )
        // failWith 正常返回（未抛异常）时，失败路径也必须就此结束，绝不落入 emit
        assertFalse("tool buffer must never be emitted on failure", toolEmitted)
        assertEquals(0, usageReports.size)
    }

    @Test
    fun `usage callback failure cannot mask successful output`() = runBlocking {
        val reporter = LocalUsageReporter(ProviderUsageNormalizer.SOURCE_LLAMA) { _, _ ->
            throw IOException("ledger unavailable")
        }
        var toolEmitted = false
        LocalGenerationEnd.end(
            cancelled = false,
            success = true,
            usageReporter = reporter,
            inputTokens = 10,
            outputTokens = 2,
            cancelMessage = "cancelled",
            emitToolResult = { toolEmitted = true },
            failWith = { fail("success must not fail") },
        )
        assertTrue(toolEmitted)
    }
}
