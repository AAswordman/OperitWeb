package com.ai.assistance.operit.ui.features.packages.market

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class MarketInstallStage {
    CONNECTING,
    FETCHING_METADATA,
    CHECKING_LOCAL,
    DOWNLOADING,
    VERIFYING,
    IMPORTING_REPOSITORY,
    IMPORTING_CONFIG,
    INSTALLING,
    RECORDING
}

data class MarketInstallProgress(
    val entryId: String,
    val stage: MarketInstallStage,
    val progress: Float? = null
)

typealias MarketInstallProgressReporter = (MarketInstallStage, Float?) -> Unit

object MarketInstallStateStore {
    private val _installStates = MutableStateFlow<Map<String, MarketInstallProgress>>(emptyMap())
    val installStates: StateFlow<Map<String, MarketInstallProgress>> = _installStates.asStateFlow()

    @Synchronized
    fun start(entryId: String): Boolean {
        val id = entryId.trim()
        if (id.isBlank() || _installStates.value.containsKey(id)) return false
        _installStates.value =
            _installStates.value + (id to MarketInstallProgress(id, MarketInstallStage.CONNECTING))
        return true
    }

    @Synchronized
    fun update(entryId: String, stage: MarketInstallStage, progress: Float? = null) {
        val id = entryId.trim()
        if (id.isBlank() || !_installStates.value.containsKey(id)) return
        _installStates.value =
            _installStates.value + (id to MarketInstallProgress(id, stage, progress?.coerceIn(0f, 1f)))
    }

    @Synchronized
    fun finish(entryId: String) {
        val id = entryId.trim()
        if (id.isBlank() || !_installStates.value.containsKey(id)) return
        _installStates.value = _installStates.value - id
    }
}
