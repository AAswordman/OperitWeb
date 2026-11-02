package com.ai.assistance.operit.data.model

data class ChatMessageLocatorPreview(
    val messageIndex: Int? = null,
    val timestamp: Long,
    val sender: String,
    val previewContent: String,
    val contentLength: Int,
    val displayMode: String,
    val isFavorite: Boolean,
) {
    val resolvedDisplayMode: ChatMessageDisplayMode
        get() =
            runCatching { ChatMessageDisplayMode.valueOf(displayMode) }
                .getOrDefault(ChatMessageDisplayMode.NORMAL)
}
