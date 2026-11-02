package com.ai.assistance.operit.ui.main

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object PendingChatDraftHandler {
    private val _pendingDraft = MutableStateFlow<String?>(null)
    val pendingDraft: StateFlow<String?> = _pendingDraft

    fun setPendingDraft(draft: String) {
        _pendingDraft.value = draft
    }

    fun clearPendingDraft() {
        _pendingDraft.value = null
    }
}
