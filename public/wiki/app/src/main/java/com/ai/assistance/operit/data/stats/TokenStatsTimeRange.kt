package com.ai.assistance.operit.data.stats

import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * 时间范围，**半开区间** `[startMs, endMs)`：`startedAtMs == endMs` 的事件
 * 不属于该范围；endMs 是下一边界（如次日 0 点），不是包含式终点。
 */
data class TokenStatsTimeRange(val startMs: Long, val endMs: Long) {
    init {
        require(endMs > startMs) { "endMs must be after startMs" }
    }

    val durationMs: Long
        get() = endMs - startMs
}

/** 图表桶粒度：10 分钟 / 1 小时 / 1 自然日（本地时区对齐）。 */
enum class TokenStatsGranularity {
    TEN_MINUTES,
    HOURLY,
    DAILY,
}

/**
 * 日历范围的图表桶对齐计算。
 *
 * 桶边界在**本地时间**上对齐（10 分钟整点、整点小时、自然日 0 点），并用
 * java.time 的 plusMinutes/plusHours/plusDays 在本地时区上推进：跨 DST 的
 * 小时/日桶自动得到 23/25 小时的正确 epoch 跨度，且相邻桶起点单调递增、
 * 覆盖无空洞（夏令时重复的小时也会出现两个不同 epoch 的桶）。
 */
object TokenStatsTimeRanges {

    const val TEN_MINUTES_MS: Long = 10 * 60 * 1000L
    const val HOUR_MS: Long = 60 * 60 * 1000L
    const val DAY_MS: Long = 24 * HOUR_MS

    /** 防御：自定义范围过大时限制桶数量，避免病态输入拖垮内存/UI。 */
    private const val MAX_BUCKETS = 10_000

    /** 日历选择器提供显式边界，始终使用半开区间 `[startMs, endMs)`。 */
    fun customRange(startMs: Long, endMs: Long): TokenStatsTimeRange =
        TokenStatsTimeRange(startMs, endMs)

    /**
     * 按范围时长选择合理桶粒度：≤12h → 10 分钟；≤48h → 1 小时；
     * 更长时间（7d/30d/月）→ 1 自然日。自定义范围同样适用。
     */
    fun granularityFor(range: TokenStatsTimeRange): TokenStatsGranularity =
        when {
            range.durationMs <= 12L * HOUR_MS -> TokenStatsGranularity.TEN_MINUTES
            range.durationMs <= 2L * DAY_MS -> TokenStatsGranularity.HOURLY
            else -> TokenStatsGranularity.DAILY
        }

    /**
     * 覆盖 [range] 的桶起点列表（本地时间对齐，升序、不相交）。
     * 最后一个桶的终点是日历对齐的下一个桶起点，可能超出 range.endMs；
     * 事件归属按 `[桶起点, 下个桶起点)` 判定，落在范围内的每个事件恰好属于一个桶。
     */
    fun bucketStarts(
        range: TokenStatsTimeRange,
        granularity: TokenStatsGranularity,
        zone: ZoneId,
    ): List<Long> {
        val first = truncateToBucket(Instant.ofEpochMilli(range.startMs).atZone(zone), granularity)
        val starts = ArrayList<Long>()
        var current = first
        while (current.toInstant().toEpochMilli() < range.endMs) {
            starts += current.toInstant().toEpochMilli()
            current = advanceBucket(current, granularity)
            if (starts.size > MAX_BUCKETS) {
                error(
                    "range too large for $granularity granularity " +
                        "(bucket count would exceed $MAX_BUCKETS)"
                )
            }
        }
        return starts
    }

    /** 桶 [index] 的结束时间：本地对齐的下一个桶起点（日历推进，非固定毫秒）。 */
    fun bucketEndMs(
        bucketStarts: List<Long>,
        index: Int,
        granularity: TokenStatsGranularity,
        zone: ZoneId,
    ): Long {
        if (index + 1 < bucketStarts.size) return bucketStarts[index + 1]
        val last = Instant.ofEpochMilli(bucketStarts[index]).atZone(zone)
        return advanceBucket(last, granularity).toInstant().toEpochMilli()
    }

    /**
     * 事件时间戳所属的桶下标（桶起点列表升序）。ts 落在
     * `[第一个桶起点, 最后一个桶终点)` 之外返回 null（防御，正常输入不触发）。
     */
    fun bucketIndexOf(
        ts: Long,
        bucketStarts: List<Long>,
        granularity: TokenStatsGranularity,
        zone: ZoneId,
    ): Int? {
        var floor = bucketStarts.binarySearch(ts)
        if (floor < 0) floor = -floor - 2
        if (floor < 0) return null
        if (bucketEndMs(bucketStarts, floor, granularity, zone) <= ts) return null
        return floor
    }

    private fun truncateToBucket(
        zdt: ZonedDateTime,
        granularity: TokenStatsGranularity,
    ): ZonedDateTime =
        when (granularity) {
            TokenStatsGranularity.TEN_MINUTES ->
                zdt.withMinute(zdt.minute / 10 * 10).withSecond(0).withNano(0)
            TokenStatsGranularity.HOURLY ->
                zdt.withMinute(0).withSecond(0).withNano(0)
            TokenStatsGranularity.DAILY ->
                zdt.toLocalDate().atStartOfDay(zdt.zone)
        }

    private fun advanceBucket(
        zdt: ZonedDateTime,
        granularity: TokenStatsGranularity,
    ): ZonedDateTime =
        when (granularity) {
            TokenStatsGranularity.TEN_MINUTES -> zdt.plusMinutes(10)
            TokenStatsGranularity.HOURLY -> zdt.plusHours(1)
            TokenStatsGranularity.DAILY -> zdt.plusDays(1)
        }
}
