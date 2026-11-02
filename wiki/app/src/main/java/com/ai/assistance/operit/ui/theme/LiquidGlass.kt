package com.ai.assistance.operit.ui.theme

import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kyant.backdrop.Backdrop
import com.kyant.backdrop.drawBackdrop
import com.kyant.backdrop.effects.blur
import com.kyant.backdrop.effects.lens
import com.kyant.backdrop.effects.vibrancy
import com.kyant.backdrop.highlight.Highlight
import com.kyant.backdrop.shadow.Shadow

val LocalLiquidGlassBackdrop = compositionLocalOf<Backdrop?> { null }

private const val LiquidGlassMinApi = Build.VERSION_CODES.TIRAMISU

fun isLiquidGlassSupported(): Boolean = Build.VERSION.SDK_INT >= LiquidGlassMinApi

@Composable
fun Modifier.liquidGlass(
    enabled: Boolean,
    shape: CornerBasedShape = RoundedCornerShape(0.dp),
    containerColor: Color,
    shadowElevation: Dp = 14.dp,
    borderWidth: Dp = 1.dp,
    blurRadius: Dp = 10.dp,
    overlayAlphaBoost: Float = 0f,
    enableLens: Boolean = true,
): Modifier {
    if (!enabled) {
        return this
    }

    val backdrop = if (isLiquidGlassSupported()) LocalLiquidGlassBackdrop.current else null
    val isLightGlass = containerColor.luminance() >= 0.5f
    if (backdrop == null) {
        val fallbackBorderColor =
            if (isLightGlass) {
                Color.White.copy(alpha = 0.28f)
            } else {
                Color.White.copy(alpha = 0.16f)
            }
        val fallbackShadow = shadowElevation.coerceAtLeast(10.dp)
        val fallbackSurfaceTint =
            if (isLightGlass) {
                containerColor.copy(alpha = 0.16f)
            } else {
                containerColor.copy(alpha = 0.24f)
            }
        val fallbackGloss =
            if (isLightGlass) {
                Color.White.copy(alpha = 0.12f)
            } else {
                Color.White.copy(alpha = 0.06f)
            }

        return this
            .shadow(
                elevation = fallbackShadow,
                shape = shape,
                clip = false,
                ambientColor = Color.Black.copy(alpha = if (isLightGlass) 0.10f else 0.18f),
                spotColor = Color.Black.copy(alpha = if (isLightGlass) 0.10f else 0.18f),
            )
            .border(width = borderWidth.coerceAtLeast(0.6.dp), color = fallbackBorderColor, shape = shape)
            .background(color = fallbackSurfaceTint, shape = shape)
            .drawWithContent {
                drawContent()
                drawRect(fallbackGloss)
            }
    }
    val baseTintAlpha = if (isLightGlass) 0.16f else 0.23f
    val surfaceTint =
        containerColor.copy(alpha = (baseTintAlpha + overlayAlphaBoost).coerceIn(0f, 0.48f))
    val edgeWidth = borderWidth.coerceAtLeast(0.2.dp)
    val shadowRadius = shadowElevation.coerceAtLeast(12.dp)
    val shadowColor =
        if (isLightGlass) {
            Color.Black.copy(alpha = 0.10f)
        } else {
            Color.Black.copy(alpha = 0.18f)
        }

    return this.drawBackdrop(
        backdrop = backdrop,
        shape = { shape },
        effects = {
            vibrancy()
            blur(blurRadius.toPx())
            if (enableLens) {
                lens(
                    refractionHeight = 12.dp.toPx(),
                    refractionAmount = 18.dp.toPx(),
                    chromaticAberration = true,
                )
            }
        },
        highlight = {
            Highlight(
                width = edgeWidth,
                blurRadius = edgeWidth * 2.4f,
                alpha = if (isLightGlass) 0.62f else 0.50f,
            )
        },
        shadow = {
            Shadow(
                radius = shadowRadius,
                color = shadowColor,
            )
        },
        onDrawSurface = {
            drawRect(surfaceTint)
        },
    )
}
