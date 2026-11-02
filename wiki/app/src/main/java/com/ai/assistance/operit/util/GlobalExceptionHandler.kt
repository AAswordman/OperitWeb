package com.ai.assistance.operit.util

import android.content.Context
import android.content.Intent
import com.ai.assistance.operit.ui.error.CrashReportActivity
import kotlin.system.exitProcess

class GlobalExceptionHandler(private val context: Context) : Thread.UncaughtExceptionHandler {

    override fun uncaughtException(thread: Thread, ex: Throwable) {
        CrashRecoveryState.markPendingCrashReportLaunch(context)
        val stackTrace = ThrowableTextFormatter.format(ex)

        val intent =
                Intent(context, CrashReportActivity::class.java).apply {
                    putExtra(CrashReportActivity.EXTRA_STACK_TRACE, stackTrace)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
        context.startActivity(intent)

        // 终止当前进程
        exitProcess(1)
    }
}
