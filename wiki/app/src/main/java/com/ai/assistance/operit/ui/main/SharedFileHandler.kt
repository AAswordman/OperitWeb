package com.ai.assistance.operit.ui.main

import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Singleton to handle shared files from external apps
 * Manages the state flow of shared file URIs between MainActivity and AIChatScreen
 */
object SharedFileHandler {
    private val _sharedFiles = MutableStateFlow<List<Uri>?>(null)
    val sharedFiles: StateFlow<List<Uri>?> = _sharedFiles
    private val _sharedFileText = MutableStateFlow<String?>(null)
    val sharedFileText: StateFlow<String?> = _sharedFileText
    private val _sharedText = MutableStateFlow<String?>(null)
    val sharedText: StateFlow<String?> = _sharedText
    
    /**
     * Set the shared files to be processed
     */
    fun setSharedFiles(uris: List<Uri>, text: String? = null) {
        _sharedFileText.value = text
        _sharedFiles.value = uris
    }

    fun setSharedText(text: String) {
        _sharedText.value = text
    }

    /**
     * Clear the shared files after processing
     */
    fun clearSharedFiles() {
        _sharedFiles.value = null
        _sharedFileText.value = null
    }

    fun clearSharedText() {
        _sharedText.value = null
    }
}

