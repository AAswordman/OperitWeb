package com.ai.assistance.operit.data.stats

import com.ai.assistance.operit.data.collects.DefaultModelPricingCollect
import com.ai.assistance.operit.data.collects.PricingCurrency
import com.ai.assistance.operit.data.model.BillingMode

data class ModelPriceSettings(
    val billingMode: BillingMode? = null,
    val currency: PricingCurrency? = null,
    val inputPricePerMillion: Double? = null,
    val cachedInputPricePerMillion: Double? = null,
    val cacheWritePricePerMillion: Double? = null,
    val outputPricePerMillion: Double? = null,
    val pricePerRequest: Double? = null,
) {
    fun hasAnyUserSetting(): Boolean =
        billingMode != null ||
            currency != null ||
            inputPricePerMillion != null ||
            cachedInputPricePerMillion != null ||
            cacheWritePricePerMillion != null ||
            outputPricePerMillion != null ||
            pricePerRequest != null
}

data class TokenPriceSettingsSnapshot(
    val providerModels: Map<String, ModelPriceSettings?>,
    val configs: Map<String, ModelPriceSettings>,
) {
    fun settingFor(providerModel: String, configId: String?): ModelPriceSettings? {
        val model = providerModels[providerModel]
        val config = configId?.let { configs[tokenPriceConfigKey(providerModel, it)] }
        if (config == null) return model
        return ModelPriceSettings(
            billingMode = config.billingMode ?: model?.billingMode,
            currency = config.currency ?: model?.currency,
            inputPricePerMillion = config.inputPricePerMillion ?: model?.inputPricePerMillion,
            cachedInputPricePerMillion =
                config.cachedInputPricePerMillion ?: model?.cachedInputPricePerMillion,
            cacheWritePricePerMillion =
                config.cacheWritePricePerMillion ?: model?.cacheWritePricePerMillion,
            outputPricePerMillion = config.outputPricePerMillion ?: model?.outputPricePerMillion,
            pricePerRequest = config.pricePerRequest ?: model?.pricePerRequest,
        )
    }
}

internal fun tokenPriceConfigKey(providerModel: String, configId: String): String =
    "$providerModel\u001f$configId"

data class ResolvedTokenPricing(
    val billingMode: BillingMode,
    val currency: PricingCurrency,
    val inputPricePerMillion: Double,
    val cachedInputPricePerMillion: Double,
    val cacheWritePricePerMillion: Double,
    val outputPricePerMillion: Double,
    val pricePerRequest: Double,
    val source: PricingSource,
)

/** Resolves only the current price: user setting first, then the built-in model table. */
object TokenPriceResolver {
    fun resolve(
        providerModel: String,
        user: ModelPriceSettings?,
    ): ResolvedTokenPricing {
        val defaults = DefaultModelPricingCollect.getDefaultPricing(providerModel)
        return ResolvedTokenPricing(
            billingMode = user?.billingMode ?: defaults.billingMode,
            currency = user?.currency ?: defaults.currency,
            inputPricePerMillion = user?.inputPricePerMillion ?: defaults.inputPricePerMillion,
            cachedInputPricePerMillion =
                user?.cachedInputPricePerMillion
                    ?: user?.inputPricePerMillion
                    ?: defaults.cachedInputPricePerMillion,
            cacheWritePricePerMillion =
                user?.cacheWritePricePerMillion
                    ?: user?.inputPricePerMillion
                    ?: defaults.inputPricePerMillion,
            outputPricePerMillion = user?.outputPricePerMillion ?: defaults.outputPricePerMillion,
            pricePerRequest = user?.pricePerRequest ?: defaults.pricePerRequest,
            source = if (user?.hasAnyUserSetting() == true) PricingSource.USER else PricingSource.BUILT_IN,
        )
    }
}
