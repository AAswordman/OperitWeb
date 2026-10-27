# util-system（Issue #87）第二名独立 critic 复验报告

复验对象：修错员按第一名 critic（verdict PASS，3 条微瑕）修正后的版本。
源码：~/workspace/Operit @ dbf71916（已确认 HEAD 一致）。

## 1. 三条微瑕复验

1. **quality 第 7 条 line 17→16**：PASS。已为 16，evidence 首行在 ±5 窗口内逐字命中（AppLogger.kt:16 KDoc 自引用 `[com.ai.assistance.operit.util.AppLogger]`）。
2. **facts 第 43 条"降级只输出类名与 message"表述**：措辞已修正为"降级主要输出类名与 message，并固定追加省略标记"，但 **FAIL——锚点窗口违规**：
   - 事实文本（第 43 条）："格式化本身抛 OOM 时 ThrowableTextFormatter 降级主要输出类名与 message，并固定追加省略标记。"，ref `ThrowableTextFormatter.kt:44`。
   - ±5 窗口（39–49 行）内容：truncateText 尾部、`private fun buildMinimalText` 签名（48 行）、`val base = buildString {`（49 行）。
   - 窗口内**没有**：OOM 触发点（26–27 行 `catch (_: OutOfMemoryError) { buildMinimalText(...) }`）、类名/message 的 append（50–54 行）、`append(FORMAT_FAILURE_MARKER)`（55 行）。
   - 断言的三个事实成分在窗口内均无文本支撑，违反"file:line ±5 完整支撑"铁律。
   - 修正建议：把 ref 改为 `:52`（窗口 47–57 覆盖 buildMinimalText 全部 append 语句），或拆成两条——"格式化抛 OOM 时回退 buildMinimalText"锚 `:26`、"buildMinimalText 输出类名+message 并固定追加省略标记"锚 `:52`。
3. **facts 第 64 条 LocationUtils 表述严格化**：PASS。已改为"无定位权限且启发式未命中时地区判断直接返回 false，不请求定位。"，ref `:42`，窗口（37–47）完整显示 `if (!hasLocationPermission(context)) { …; return false }`。正文第 67 行同源表述同步修正。

## 2. facts 随机抽查 20 条（seed 87）

PASS 19 / FAIL 1：
- PASS：[1] AppLogger object 单例、[5][6] 12000/24000 字符截断、[14] enableSystemLog JVM 开关、[16] getLogFile、[18] 吞 IOException、[19] ANR 1000/500ms 阈值、[25] 主线程 post 检测、[32] ANR 报告内容、[33] crash_recovery_state、[36] 先标记后拉起 CrashReportActivity、[40] 64 帧上限、[42] IdentityHashMap 循环检测、[45] query 参数 [omitted]、[47] headers [empty]、[49] killListeners 返回 PID 列表、[54] 256KB Range 测速、[60] 语言偏好回退、[70] UriSerializer 空串→null。
- FAIL：[43]（见上节第 2 条）。

## 3. quality 10 条全量

- evidence 首行 10/10 在 ±5 窗口内逐字命中源码。
- severity 合理性：5 条 warn 重点复核——
  - [1] GlobalExceptionHandler `startActivity` 后紧接 `exitProcess(1)`：实锤，上报页可能来不及创建。
  - [2] PortProcessKiller 对任意占用端口的 PID `kill -9 … || true`：实锤（源码 24 行），误杀非本应用进程风险成立，`|| true` 吞失败成立。
  - [3] LocaleUtils.setAppLanguage `runBlocking(Dispatchers.IO)`：实锤，主线程调用阻塞 UI。
  - [4] AppLogger 吞 `IOException`（335 行 `// Avoid recursive logging here; swallow to prevent crashes`）：实锤。
  - [5] GithubReleaseUtil 文件内 0 处签名/哈希校验（grep sign/sha/md5/checksum/verify 无命中），34 镜像站断言第一名 critic 已逐个数过：实锤，warn 恰当。
- 5 条 suggestion 证据与评级均合理。

## 4. status.json / lint / 禁用词

- issue=87、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb、refs_valid=71（=facts 实际条数）、status=review-pending、critic 字段为空：全部正确。
- 5 文件全文 grep"通过/批准/LGTM"：0 命中。
- facts/quality 顶层数组，severity 仅 warn/suggestion。

## Verdict：FAIL（1 项剩余问题）

修错员的 3 条微瑕中第 1、3 条已修到位；第 2 条措辞修对了但锚点 `ThrowableTextFormatter.kt:44` 的 ±5 窗口无法支撑新断言（OOM 触发、类名/message 输出、省略标记追加三处关键代码均在窗口外）。修错员按"修正建议"调整锚点（或拆条）后，本页即可视为复验达标，无需第三轮全量复核——建议 parent 派修错员单点修正后由 parent 直接核对窗口即可。
