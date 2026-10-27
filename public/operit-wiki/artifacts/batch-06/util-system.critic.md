# Critic 报告：util-system（Issue #87）

- 评审对象：`review/batch-06/util-system.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 HEAD 一致）
- 种子核对：`tracking/shards/day-4.json` 的 util-system 种子为 16 项（15 个 kt + `util/exceptions/` 目录），源码中全部存在（`exceptions/` 下为 `UserCancellationException.kt`）。writer 简报里的 `util/log/`、`LogUtil.kt`、`PlatformService.kt` 在源码中确实不存在，writer 改用 day-4.json 权威清单是正确的。

## 1. facts.json（71 条）

- 顶层数组 ✓；每条键集合为 `{fact, ref}` ✓；71 个 ref 文件全部存在、行号无一越界 ✓
- 16 个种子文件全部被 facts 覆盖（AppLogger 18、AnrMonitor 14、ThrowableTextFormatter 5、GithubReleaseUtil 5、LocaleUtils 5、LocationUtils 5、GlobalExceptionHandler 4、HttpLogSanitizer 4、CrashRecoveryState 2、PortProcessKiller 2、NetworkUtils 2、SerializationSetup/IntRange/LocalDateTime/Uri 各 1、UserCancellationException 1）✓
- 数字断言逐条抽验源码：ANR 阈值 1000/500ms、采样 100ms、堆栈历史 10 条（AnrMonitor.kt:47-50）✓；12000/24000 字符截断、20 个 packageLog 文件（AppLogger.kt:38-39/147）✓；34 个镜像站（逐个数过，GithubReleaseUtil.kt:40-73）✓；256KB Range 测速（SPEED_TEST_BYTES = 256*1024，:106/119）✓；64 帧/8 层 cause/24000/512（ThrowableTextFormatter.kt:8-11）✓；时区 Asia/Shanghai 或 Asia/Urumqi（LocationUtils.kt:183-186）✓；ProbeResult 含 latencyMs/bytesPerSec（GithubReleaseUtil.kt:30-36）✓；pt→pt-BR、in→id 别名（LocaleUtils.kt:32）✓；10 种语言（:43-58，AUTO+9）✓
- 4 个页面问题全部覆盖：AppLogger/ANR/崩溃恢复 ✓、HttpLogSanitizer 脱敏 ✓、GithubReleaseUtil+Locale/Location ✓、UserCancellationException 取消语义 ✓
- fact 原子化：71 条均为单断言 ✓；虚构符号 0 ✓

## 2. quality.json（10 条：warn 5 / suggestion 5）

- 顶层数组 ✓；severity 仅 warn/suggestion ✓；键集合完整 ✓
- evidence 逐字比对源码 10/10 命中：
  - GlobalExceptionHandler：intent 块 + `startActivity` 后紧接 `exitProcess(1)`，原文逐字一致（GlobalExceptionHandler.kt:15 起）；warn 合理（上报 Activity 可能来不及创建）
  - PortProcessKiller：`kill -9 "${'$'}pid" 2>/dev/null || true` 逐字一致（:24）；warn 合理（端口若被非本应用进程占用会被误杀）
  - LocaleUtils：`runBlocking(Dispatchers.IO) { manager.saveAppLanguage(languageCode) }` 逐字一致（:174）；warn 合理（主线程调用会卡 UI）
  - AppLogger：`catch (e: IOException) { // Avoid recursive logging here; swallow to prevent crashes }` 逐字一致（:335）；warn 合理（磁盘满丢日志无感知）
  - GithubReleaseUtil：镜像条目逐字一致（:40）；文件内 grep `sign|sha|md5|hash|verify|checksum|certificate` 0 命中，"本文件无签名/哈希校验"断言成立，medium 置信度恰当
  - AnrMonitor 4 个未用 import：`Debug.` 全文件 0 次、`Lifecycle`/`LifecycleOwner`/`Field` 仅出现在 import 行，断言成立；行号（4/9/10/21）与源码一致
  - AppLogger KDoc 自引用 `[com.ai.assistance.operit.util.AppLogger]` 在源码第 16 行逐字存在（见下 nits）
  - maxBlockDuration check-then-set（:214-216）逐字一致；单线程调用路径下 low 风险标注恰当
  - CrashRecoveryState `.commit()`（:13）逐字一致；suggestion 合理
  - LocationUtils `@RequiresPermission(...FINE/COARSE_LOCATION)`（:34）逐字一致；隐私提示类 suggestion 合理

## 3. 正文（util-system.md）

- 固定结构完整：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制 6 节 / 关键符号表 / 输入→处理→输出三段式 / 来源 ✓
- 行内引用 66 处，抽验 11 处全部落在源码对应位置且支撑上下文 ✓（如 `createCompatLocaleList` 日语回退英文 :97、TIRAMISU 用 AppCompatDelegate :187-190、urlForLog 脱敏 :7、isChinaTimezone :183-186）
- 覆盖全部 16 种子与 4 个页面问题 ✓；无代码走查内容写入正文 ✓

## 4. status.json / lint / 禁用词

- `{"id":"util-system","issue":87,"status":"review-pending","source_repo":"operit","source_commit":"dbf71916fae9750cfdc9f9a774f5a0fee56633fb","refs_valid":71,"critic":""}` — issue/commit/refs_valid（71=实际条数）全部正确 ✓
- lint 记录可信：隔离复跑逻辑成立（`.lint.md` 排除自扫是 lint.py 已知行为，glob 会把 `*.lint.md` 当页面误检）；禁用词 5 文件 0 命中（已复验）✓

## 5. 微瑕（不阻塞，可顺手修）

1. quality.json 第 7 条（AppLogger KDoc 自引用）的 `line` 写 17，实际在第 16 行，evidence 文本本身逐字正确。
2. facts.json `ThrowableTextFormatter.kt:44`："降级只输出类名与 message"——`buildMinimalText` 除类名+message 外还固定追加 `FORMAT_FAILURE_MARKER`（`"\n<stack trace omitted>"`），"只"字略绝对，建议改成"主要输出类名与 message（另附固定省略标记）"。
3. facts.json `LocationUtils.kt:42`："无定位权限时地区判断只返回启发式结果"——代码是启发式未命中后 `return false` 且不请求定位，行为实质与表述一致，措辞可保留，严格化可选。

## Verdict：PASS

71 条 facts 引用全部真实有效、10 条走查 evidence 全部逐字命中源码、severity 评级合理、正文覆盖 16 种子与全部页面问题、status/lint/禁用词全部合规。3 条微瑕不影响事实正确性，建议修错阶段顺手处理第 1、2 条。
