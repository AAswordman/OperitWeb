package com.ai.assistance.operit.util.ripgrep

internal object NativeRipgrep {
    init {
        System.loadLibrary("operit_ripgrep")
    }

    @JvmStatic
    external fun searchJson(
        path: String,
        patterns: Array<String>,
        filePattern: String,
        caseInsensitive: Boolean,
        literal: Boolean,
        contextLines: Int,
        maxResults: Int
    ): String
}
