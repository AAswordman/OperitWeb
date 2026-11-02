package com.ai.assistance.operit.data.preferences

import android.content.Context
import android.content.SharedPreferences

/** Stores the locally bundled plugin market agreement version accepted by the user. */
class MarketAgreementPreferences(context: Context) {
    private val prefsName = "market_agreement_preferences"
    private val acceptedVersionKey = "accepted_market_agreement_version"

    private val prefs: SharedPreferences =
        context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)

    fun isAgreementAccepted(): Boolean {
        return prefs.getString(acceptedVersionKey, null) == CURRENT_MARKET_AGREEMENT_VERSION
    }

    fun acceptCurrentAgreement() {
        prefs.edit()
            .putString(acceptedVersionKey, CURRENT_MARKET_AGREEMENT_VERSION)
            .apply()
    }

    companion object {
        /** Bump this value whenever the bundled market agreement changes substantively. */
        const val CURRENT_MARKET_AGREEMENT_VERSION = "2026-08-08.1"
    }
}
