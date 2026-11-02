package com.ai.assistance.operit.data.stats

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleasedProviderModelKeyDecoderTest {
    @Test
    fun `provider model key decodes with provider aliases`() {
        assertEquals(
            ReleasedProviderModelKey(
                storedProviderModel = "TOOLPKG_example_provider:deepseek-chat",
                provider = "Example Provider",
                model = "deepseek-chat",
            ),
            ReleasedProviderModelKeyDecoder.decodeOrNull(
                "TOOLPKG_example_provider_deepseek-chat",
                mapOf("TOOLPKG_example_provider" to "Example Provider"),
            ),
        )
    }

    @Test
    fun `pre provider model function key is skipped`() {
        assertNull(ReleasedProviderModelKeyDecoder.decodeOrNull("CHAT"))
        assertNull(ReleasedProviderModelKeyDecoder.decodeOrNull("FILE_BINDING"))
    }
}
