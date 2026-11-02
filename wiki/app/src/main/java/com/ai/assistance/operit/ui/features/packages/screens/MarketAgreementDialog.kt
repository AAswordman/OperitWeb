package com.ai.assistance.operit.ui.features.packages.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.ai.assistance.operit.R
import com.ai.assistance.operit.data.preferences.MarketAgreementPreferences
import kotlinx.coroutines.delay

@Composable
fun MarketAgreementDialog(
    mandatory: Boolean,
    onDismissRequest: () -> Unit,
    onAccept: () -> Unit
) {
    val scrollState = rememberScrollState()
    var isAcceptEnabled by remember { mutableStateOf(false) }
    var remainingSeconds by remember { mutableStateOf(5) }

    LaunchedEffect(Unit) {
        repeat(5) {
            delay(1000)
            remainingSeconds--
        }
        isAcceptEnabled = true
    }

    AlertDialog(
        onDismissRequest = {
            if (!mandatory) onDismissRequest()
        },
        title = {
            Text(text = stringResource(R.string.market_agreement_title))
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 520.dp)
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.market_agreement_subtitle),
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = stringResource(
                        R.string.market_agreement_version,
                        MarketAgreementPreferences.CURRENT_MARKET_AGREEMENT_VERSION
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = stringResource(R.string.market_agreement_content),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = onAccept,
                enabled = isAcceptEnabled
            ) {
                Text(
                    text = if (isAcceptEnabled) {
                        stringResource(R.string.agreement_accept)
                    } else {
                        stringResource(R.string.agreement_wait, remainingSeconds)
                    }
                )
            }
        },
        dismissButton = if (!mandatory) {
            {
                TextButton(onClick = onDismissRequest) {
                    Text(text = stringResource(R.string.cancel))
                }
            }
        } else {
            null
        }
    )
}
