package com.ai.assistance.operit.data.model

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** A successful formal-inference usage fact. */
@Entity(
    tableName = "token_usage_records",
    indices = [
        Index(value = ["occurredAtMs"]),
        Index(value = ["provider", "model", "configId", "occurredAtMs"]),
        Index(value = ["importKey"], unique = true),
    ],
)
data class TokenUsageRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val importKey: String? = null,
    val occurredAtMs: Long?,
    val configId: String,
    val provider: String,
    val model: String,
    val requestCount: Long,
    val uncachedInputTokens: Long? = null,
    val cachedInputTokens: Long? = null,
    val cacheWriteTokens: Long? = null,
    val totalInputTokens: Long? = null,
    val outputTokens: Long? = null,
) {
    val providerModel: String
        get() = "$provider:$model"
}
