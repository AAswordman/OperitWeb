package com.ai.assistance.operit.data.stats

import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class TokenActivityAggregatorTest {
    private val zone = ZoneId.of("Asia/Shanghai")

    @Test
    fun `range data contains every selected calendar day and excludes surrounding activity`() {
        val range = dateRange("2026-08-02", "2026-08-04")
        val snapshot = TokenActivitySnapshot(
            zone = zone,
            dayTotals = mapOf(
                LocalDate.of(2026, 8, 1) to 40L,
                LocalDate.of(2026, 8, 2) to 10L,
                LocalDate.of(2026, 8, 4) to 30L,
                LocalDate.of(2026, 8, 5) to 50L,
            ),
        )

        val result = TokenActivityAggregator.rangeData(snapshot, range)

        assertEquals(
            listOf(
                LocalDate.of(2026, 8, 2),
                LocalDate.of(2026, 8, 3),
                LocalDate.of(2026, 8, 4),
            ),
            result.daily.map(TokenActivityDay::date),
        )
        assertEquals(listOf(10L, 0L, 30L), result.daily.map(TokenActivityDay::tokens))
        assertEquals(40L, result.stats.totalTokens)
        assertEquals(30L, result.stats.peakTokens)
    }

    @Test
    fun `range data calculates streaks and cumulative totals inside the selected range`() {
        val range = dateRange("2026-08-01", "2026-08-05")
        val snapshot = TokenActivitySnapshot(
            zone = zone,
            dayTotals = mapOf(
                LocalDate.of(2026, 8, 1) to 10L,
                LocalDate.of(2026, 8, 2) to 20L,
                LocalDate.of(2026, 8, 4) to 30L,
                LocalDate.of(2026, 8, 5) to 40L,
            ),
        )

        val result = TokenActivityAggregator.rangeData(snapshot, range)

        assertEquals(2, result.stats.currentStreak)
        assertEquals(2, result.stats.longestStreak)
        assertEquals(listOf(10L, 30L, 30L, 60L, 100L), result.cumulative.map(TokenActivityDay::tokens))
    }

    private fun dateRange(start: String, inclusiveEnd: String): TokenStatsTimeRange =
        TokenStatsTimeRanges.customRange(
            LocalDate.parse(start).atStartOfDay(zone).toInstant().toEpochMilli(),
            LocalDate.parse(inclusiveEnd).plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(),
        )
}
