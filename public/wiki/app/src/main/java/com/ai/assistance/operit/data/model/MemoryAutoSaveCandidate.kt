package com.ai.assistance.operit.data.model

import io.objectbox.annotation.Entity
import io.objectbox.annotation.Id
import io.objectbox.annotation.Index
import java.util.Date

@Entity
data class MemoryAutoSaveCandidate(
    @Id var id: Long = 0,
    @Index var chatId: String = "",
    var triggerMessageTimestamp: Long = 0L,
    var createdAt: Date = Date(),
    var updatedAt: Date = Date(),
    var status: String = STATUS_PENDING,
    var attemptCount: Int = 0,
    var lastError: String = "",
    var sourceType: String = SOURCE_TYPE_REPLY_FINALIZED_AUTO
) {
    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_PROCESSING = "processing"
        const val STATUS_FAILED = "failed"

        const val SOURCE_TYPE_REPLY_FINALIZED_AUTO = "reply_finalized_auto"
        const val SOURCE_TYPE_SELECTED_USER_MESSAGE = "selected_user_message"

        fun isSelectedUserMessageSource(sourceType: String): Boolean {
            return sourceType == SOURCE_TYPE_SELECTED_USER_MESSAGE
        }
    }
}
