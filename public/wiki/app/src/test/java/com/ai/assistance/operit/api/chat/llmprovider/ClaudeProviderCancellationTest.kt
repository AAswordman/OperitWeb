package com.ai.assistance.operit.api.chat.llmprovider

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClaudeProviderCancellationTest {
    @Test
    fun `normal stream termination is not treated as manual cancellation`() {
        assertFalse(shouldPropagateClaudeCancellation(false))
    }

    @Test
    fun `cancel streaming marks normal loop exit for cancellation propagation`() {
        assertTrue(shouldPropagateClaudeCancellation(true))
    }
}
