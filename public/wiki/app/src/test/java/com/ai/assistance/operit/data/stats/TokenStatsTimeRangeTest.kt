package com.ai.assistance.operit.data.stats

import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 日历范围及桶边界测试，覆盖 DST 和半开区间语义。 */
class TokenStatsTimeRangeTest {

    private val shanghai = ZoneId.of("Asia/Shanghai")
    private val newYork = ZoneId.of("America/New_York")

    private fun localMs(dateTime: String, zone: ZoneId): Long =
        LocalDateTime.parse(dateTime).atZone(zone).toInstant().toEpochMilli()

    private fun local(epochMs: Long, zone: ZoneId): LocalDateTime =
        LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(epochMs), zone)

    // ==== 日历范围与校验 ====

    @Test
    fun `custom range requires end after start`() {
        val range = TokenStatsTimeRanges.customRange(1000L, 2000L)
        assertEquals(1000L, range.startMs)
        assertEquals(2000L, range.endMs)
        try {
            TokenStatsTimeRanges.customRange(2000L, 2000L)
            throw AssertionError("expected IllegalArgumentException")
        } catch (expected: IllegalArgumentException) {
            // ok
        }
    }

    // ==== 粒度选择 ====

    @Test
    fun `granularity is chosen by range duration`() {
        fun granularityOf(hours: Long) =
            TokenStatsTimeRanges.granularityFor(TokenStatsTimeRanges.customRange(0L, hours * TokenStatsTimeRanges.HOUR_MS))
        assertEquals(TokenStatsGranularity.TEN_MINUTES, granularityOf(5))
        assertEquals(TokenStatsGranularity.TEN_MINUTES, granularityOf(12))
        assertEquals(TokenStatsGranularity.HOURLY, granularityOf(13))
        assertEquals(TokenStatsGranularity.HOURLY, granularityOf(24))
        assertEquals(TokenStatsGranularity.HOURLY, granularityOf(48))
        assertEquals(TokenStatsGranularity.DAILY, granularityOf(49))
        assertEquals(TokenStatsGranularity.DAILY, granularityOf(7 * 24))
        assertEquals(TokenStatsGranularity.DAILY, granularityOf(31 * 24))
    }

    // ==== 桶对齐与归属 ====

    @Test
    fun `ten minute buckets align to local clock boundaries`() {
        val range = TokenStatsTimeRanges.customRange(
            localMs("2026-08-07T13:07:00", shanghai),
            localMs("2026-08-07T18:07:00", shanghai),
        )
        val starts = TokenStatsTimeRanges.bucketStarts(range, TokenStatsGranularity.TEN_MINUTES, shanghai)
        // 首个桶边界为本地 13:00（早于范围起点，属正常：桶是日历对齐的）
        assertEquals(localMs("2026-08-07T13:00:00", shanghai), starts.first())
        assertEquals(31, starts.size)
        assertTrue(starts.zipWithNext().all { (a, b) -> b - a == TokenStatsTimeRanges.TEN_MINUTES_MS })
    }

    @Test
    fun `hourly buckets across spring forward skip the missing hour`() {
        val range = TokenStatsTimeRanges.customRange(
            localMs("2026-03-08T00:00:00", newYork),
            localMs("2026-03-09T00:00:00", newYork),
        )
        val starts = TokenStatsTimeRanges.bucketStarts(range, TokenStatsGranularity.HOURLY, newYork)
        assertEquals(23, starts.size)
        // 单调递增且没有 02:00 本地小时的桶
        assertTrue(starts.zipWithNext().all { (a, b) -> b > a })
        assertTrue(starts.none { local(it, newYork).hour == 2 })
        // 事件归属：01:30 EST -> 01:00 桶；03:30 EDT -> 03:00 桶
        val early = localMs("2026-03-08T01:30:00", newYork)
        val late = localMs("2026-03-08T03:30:00", newYork)
        val earlyIndex = TokenStatsTimeRanges.bucketIndexOf(early, starts, TokenStatsGranularity.HOURLY, newYork)!!
        val lateIndex = TokenStatsTimeRanges.bucketIndexOf(late, starts, TokenStatsGranularity.HOURLY, newYork)!!
        assertEquals(localMs("2026-03-08T01:00:00", newYork), starts[earlyIndex])
        assertEquals(localMs("2026-03-08T03:00:00", newYork), starts[lateIndex])
        // 02:00 不存在：03:00 桶紧跟在 01:00 桶之后（无空洞）
        assertEquals(earlyIndex + 1, lateIndex)
    }

    @Test
    fun `hourly buckets across fall back produce both repeated hour buckets`() {
        val range = TokenStatsTimeRanges.customRange(
            localMs("2026-11-01T00:00:00", newYork),
            localMs("2026-11-02T00:00:00", newYork),
        )
        val starts = TokenStatsTimeRanges.bucketStarts(range, TokenStatsGranularity.HOURLY, newYork)
        assertEquals(25, starts.size)
        assertTrue(starts.zipWithNext().all { (a, b) -> b > a })
        // 重复的本地 01:00 出现两次：01:00 EDT 与 01:00 EST（不同 epoch）
        val hourOneBuckets = starts.filter { local(it, newYork).hour == 1 }
        assertEquals(2, hourOneBuckets.size)
        val first = localMs("2026-11-01T01:30:00", newYork) // 第一次 01:30（EDT）
        // 第二次 01:30 是 EST（epoch 多 1 小时）
        val secondEpoch = first + TokenStatsTimeRanges.HOUR_MS
        val firstIndex = TokenStatsTimeRanges.bucketIndexOf(first, starts, TokenStatsGranularity.HOURLY, newYork)!!
        val secondIndex = TokenStatsTimeRanges.bucketIndexOf(secondEpoch, starts, TokenStatsGranularity.HOURLY, newYork)!!
        assertEquals(hourOneBuckets[0], starts[firstIndex])
        assertEquals(hourOneBuckets[1], starts[secondIndex])
    }

    @Test
    fun `daily buckets across dst have exact 23 and 24 hour spans`() {
        val range = TokenStatsTimeRanges.customRange(
            localMs("2026-03-08T00:00:00", newYork),
            localMs("2026-03-10T00:00:00", newYork),
        )
        val starts = TokenStatsTimeRanges.bucketStarts(range, TokenStatsGranularity.DAILY, newYork)
        assertEquals(2, starts.size)
        assertEquals(localMs("2026-03-08T00:00:00", newYork), starts[0])
        assertEquals(localMs("2026-03-09T00:00:00", newYork), starts[1])
        assertEquals(23L * TokenStatsTimeRanges.HOUR_MS,
            TokenStatsTimeRanges.bucketEndMs(starts, 0, TokenStatsGranularity.DAILY, newYork) - starts[0])
        assertEquals(24L * TokenStatsTimeRanges.HOUR_MS,
            TokenStatsTimeRanges.bucketEndMs(starts, 1, TokenStatsGranularity.DAILY, newYork) - starts[1])
        // 23:30 EDT 属于 03-08 的桶
        val lateEvent = localMs("2026-03-08T23:30:00", newYork)
        assertEquals(0, TokenStatsTimeRanges.bucketIndexOf(lateEvent, starts, TokenStatsGranularity.DAILY, newYork))
    }

    @Test
    fun `bucket boundaries partition events exactly once`() {
        val range = TokenStatsTimeRanges.customRange(
            localMs("2026-08-07T00:00:00", shanghai),
            localMs("2026-08-09T00:00:00", shanghai),
        )
        val starts = TokenStatsTimeRanges.bucketStarts(range, TokenStatsGranularity.HOURLY, shanghai)
        // 逐小时采样：范围内每个整点恰好属于一个桶，桶序号随事件时间单调递增
        var previousIndex = -1
        for (hour in 0 until 48) {
            val ts = range.startMs + hour * TokenStatsTimeRanges.HOUR_MS
            val index = TokenStatsTimeRanges.bucketIndexOf(ts, starts, TokenStatsGranularity.HOURLY, shanghai)
            assertTrue("ts=$ts must belong to a bucket", index != null)
            assertTrue("bucket index must be monotonic", index!! >= previousIndex)
            previousIndex = index
        }
        // 范围终点本身不属于任何桶（半开语义）
        assertNull(
            TokenStatsTimeRanges.bucketIndexOf(range.endMs, starts, TokenStatsGranularity.HOURLY, shanghai)
        )
        // 范围起点之前的事件不属于任何桶
        assertNull(
            TokenStatsTimeRanges.bucketIndexOf(range.startMs - 1, starts, TokenStatsGranularity.HOURLY, shanghai)
        )
    }
}
