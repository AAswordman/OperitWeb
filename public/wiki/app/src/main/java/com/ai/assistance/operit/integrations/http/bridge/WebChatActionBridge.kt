package com.ai.assistance.operit.integrations.http.bridge

import com.ai.assistance.operit.services.ChatServiceCore

internal class WebChatActionBridge(
    private val core: ChatServiceCore
) {
    fun manuallyUpdateMemory() {
        core.getMessageCoordinationDelegate().manuallyUpdateMemory()
    }

    fun manuallySummarizeConversation() {
        core.getMessageCoordinationDelegate().manuallySummarizeConversation()
    }
}
