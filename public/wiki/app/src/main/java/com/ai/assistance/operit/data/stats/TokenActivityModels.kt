package com.ai.assistance.operit.data.stats

import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.math.ceil

enum class TokenActivityViewMode { DAILY, WEEKLY, CUMULATIVE }

internal data class TokenActivitySnapshot(
    val zone: ZoneId,
    val dayTotals: Map<LocalDate, Long>,
)

data class TokenActivityDay(val date: LocalDate, val tokens: Long, val level: Int)

data class TokenActivityWeek(
    val startDate: LocalDate,
    val tokens: Long,
    val level: Int,
    val barHeight: Int,
)

data class TokenActivityStats(
    val totalTokens: Long = 0L,
    val peakTokens: Long = 0L,
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
)

data class TokenActivityRangeData(
    val daily: List<TokenActivityDay>,
    val weekly: List<TokenActivityWeek>,
    val cumulative: List<TokenActivityDay>,
    val stats: TokenActivityStats,
)

object TokenActivityAggregator {
    /** Builds all three activity views from the same explicit calendar range. */
    internal fun rangeData(
        snapshot: TokenActivitySnapshot,
        range: TokenStatsTimeRange,
    ): TokenActivityRangeData {
        val start = java.time.Instant.ofEpochMilli(range.startMs).atZone(snapshot.zone).toLocalDate()
        val end = java.time.Instant.ofEpochMilli(range.endMs - 1L).atZone(snapshot.zone).toLocalDate()
        return rangeData(snapshot.dayTotals, start, end)
    }

    private fun rangeData(
        dayTotals: Map<LocalDate, Long>,
        start: LocalDate,
        end: LocalDate,
    ): TokenActivityRangeData {
        val dayCount = ChronoUnit.DAYS.between(start, end).toInt() + 1
        val raw = List(dayCount) { index ->
            val date = start.plusDays(index.toLong())
            TokenActivityDay(date, dayTotals[date] ?: 0L, 0)
        }
        val dailyLevels = QuantileLevels.from(raw.map(TokenActivityDay::tokens))
        val daily = raw.map { it.copy(level = dailyLevels.level(it.tokens)) }

        var cumulativeTotal = 0L
        val cumulativeRaw = raw.map {
            cumulativeTotal = TokenCostCalculator.saturatedAdd(cumulativeTotal, it.tokens)
            it.copy(tokens = cumulativeTotal)
        }
        val cumulativeLevels = QuantileLevels.from(cumulativeRaw.map(TokenActivityDay::tokens))
        val cumulative = cumulativeRaw.map { it.copy(level = cumulativeLevels.level(it.tokens)) }

        val firstWeek = start.minusDays((start.dayOfWeek.value % 7).toLong())
        val lastWeek = end.minusDays((end.dayOfWeek.value % 7).toLong())
        val weekCount = ChronoUnit.WEEKS.between(firstWeek, lastWeek).toInt() + 1
        val weekTotals = LongArray(weekCount)
        raw.forEach { day ->
            val weekStart = day.date.minusDays((day.date.dayOfWeek.value % 7).toLong())
            val index = ChronoUnit.WEEKS.between(firstWeek, weekStart).toInt()
            weekTotals[index] = TokenCostCalculator.saturatedAdd(weekTotals[index], day.tokens)
        }
        val weekLevels = QuantileLevels.from(weekTotals.toList())
        val heights = barHeights(weekTotals.toList())
        val weekly = List(weekCount) { index ->
            TokenActivityWeek(
                startDate = firstWeek.plusWeeks(index.toLong()),
                tokens = weekTotals[index],
                level = weekLevels.level(weekTotals[index]),
                barHeight = heights[index],
            )
        }
        return TokenActivityRangeData(daily, weekly, cumulative, stats(raw))
    }

    private fun stats(days: List<TokenActivityDay>): TokenActivityStats {
        var total = 0L
        var peak = 0L
        var run = 0
        var longest = 0
        days.forEach { day ->
            total = TokenCostCalculator.saturatedAdd(total, day.tokens)
            peak = maxOf(peak, day.tokens)
            run = if (day.tokens > 0L) run + 1 else 0
            longest = maxOf(longest, run)
        }
        var current = 0
        var index = days.lastIndex
        while (index >= 0 && days[index].tokens > 0L) {
            current++
            index--
        }
        return TokenActivityStats(total, peak, current, longest)
    }

    private fun barHeights(values: List<Long>): IntArray {
        val distinct = values.filter { it > 0L }.distinct().sorted()
        return IntArray(values.size) { index ->
            when {
                values[index] <= 0L -> 1
                distinct.size == 1 -> 7
                else -> 2 + distinct.indexOf(values[index]) * 5 / (distinct.size - 1)
            }
        }
    }
}

private class QuantileLevels(private val thresholds: LongArray) {
    fun level(value: Long): Int {
        if (value <= 0L) return 0
        for (level in 1..5) if (value <= thresholds[level]) return level
        return 5
    }

    companion object {
        fun from(values: List<Long>): QuantileLevels {
            val nonZero = values.filter { it > 0L }.sorted()
            if (nonZero.size < 2 || nonZero.firstOrNull() == nonZero.lastOrNull()) {
                return QuantileLevels(LongArray(6).also { it[3] = Long.MAX_VALUE })
            }
            fun nearest(percentile: Double): Long {
                val index = (ceil(nonZero.size * percentile).toInt() - 1)
                    .coerceIn(0, nonZero.lastIndex)
                return nonZero[index]
            }
            return QuantileLevels(
                longArrayOf(0L, nearest(0.25), nearest(0.50), nearest(0.75), nearest(0.95), Long.MAX_VALUE)
            )
        }
    }
}
