# util-stream-parse 第二轮独立复验报告（critic2）

- 页面：util-stream-parse（流式内容解析插件与原生实现），Issue #86
- 复验对象：修错员按第一名 critic 报告 A–C 共 8 项修正后的版本
- 源码：~/workspace/Operit @ dbf71916（已确认 HEAD 一致）
- facts：84 条；quality：10 条；status.json：issue=86、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb、refs_valid=84、review-pending

## 一、第一名 critic 的 8 项修复复验

| # | 修复项 | 复验结论 |
|---|--------|----------|
| 1 | facts[0] "三个状态"→四个状态（IDLE/TRYING/PROCESSING/WAITFOR），ref :13 | PASS。窗口 8–18 覆盖全部四个枚举值；与 facts[1]（WAITFOR 定义，ref :17，KDoc 原文支撑）无矛盾；正文"四态机"表述一致 |
| 2 | facts[54] :11→:30 | PASS。独立核对：窗口 25–35 同时覆盖 `listOf(tagName, chunk)`（:30）与 `listOf("text", chunk)`（:33）。修错员未采纳第一名 critic 建议的 :24 是正确的——:24 的窗口（19–29）够不着 :33，:30 更优 |
| 3 | facts[57] :7→:21 | PASS。`private fun Stream<Char>.nativeMarkdownSplitBySession(` 逐字在 :21 |
| 4 | facts[64] :290→:280 | PASS。窗口 275–285 覆盖 `StreamGroup(tag, stream)` 发射（:280）与 closePluginChannel（:283–286） |
| 5 | facts[66] :201→:206 | PASS。窗口 201–211 覆盖 flushJob?.cancel()（:201）、groupChannel.close()（:206）、session.destroy()（:207） |
| 6 | facts[80] 拆条（type 0 :440 / type 1 :451） | PASS。两处 `segments.push_back({0,…})`（:440）与 `{1,…}`（:449–450）在各自窗口内；拆条后均为单断言 |
| 7 | facts[38] :1374→:1411 | 部分 PASS。WAITFOR 转移（:1411，注释"进入WAITFOR状态，等待下一行决定去留"）窗口支撑成立；但见第二节第 1 条残留问题 |
| 8 | quality[6] :7→:21 | PASS。evidence 首行逐字在 :21，窗口内 |

## 二、复验中新发现的残留问题（2 项，需修错）

### 1. facts[38] 仍是"一果双断言"，前半句窗口撑不住 — FAIL

- 当前：`StreamMarkdownTablePlugin 识别 | 开头的表格行，换行后进入 WAITFOR 等待确认下一行`，ref `StreamMarkdownPlugin.kt:1411`
- 窗口 1406–1416 只支撑"换行后进入 WAITFOR"（:1411 `state = PluginState.WAITFOR` + 注释）
- "| 开头的表格行"的证据是 `tableRowMatcher`（:1384–1391，`char('|') // 表格行必须以竖线开始`），距离 ref 23 行，超出 ±5 窗口
- 修正：拆成两条单断言事实——(a) "StreamMarkdownTablePlugin 用 tableRowMatcher 识别 | 开头的表格行"，ref :1388；(b) "换行后进入 WAITFOR 等待确认下一行"，ref :1411

### 2. facts[58] 窗口只支撑一半断言 — FAIL

- 当前：`公开 API 为 nativeMarkdownSplitByBlock 与 nativeMarkdownSplitByInline`，ref `NativeMarkdownStreamOperators.kt:419`
- 窗口 414–424 只出现 `nativeMarkdownSplitByBlock`；`nativeMarkdownSplitByInline` 在 :443，超出窗口 24 行
- 修正：拆成两条——(a) "公开 API nativeMarkdownSplitByBlock"，ref :419；(b) "公开 API nativeMarkdownSplitByInline"，ref :443
- 拆分后 facts 84→86，status.json refs_valid 需同步为 86

## 三、20 条 facts 随机抽查（seed=86）

抽查 [0,1,3,7,8,12,13,22,26,27,38,40,46,48,50,52,58,64,71,78]：

- PASS 18 条：[0][1][3][7][8][12][13][22][26][27][40][46][48][50][52][64][71][78]
  - 其中 [27] 引用块"> "写法经核实 matcher 为 `char('>')` + `char(' ')`（:674–675），表述准确
  - [71] 的 3 倍长 jint 数组证据在 `segmentsToJIntArray`（:12 窗口），被 `nativeSplitXmlSegments`（:29）调用展平，实质断言成立
  - [54] 的 :30 选择经独立核对优于第一名 critic 的 :24 建议
- FAIL 2 条：[38]、[58]（见第二节）

## 四、quality.json 10 条复验

evidence 逐字比对源码 + 首行落在 file:line ±5 窗口内，10/10 全部符合：

| # | severity | 结论 |
|---|----------|------|
| [0] | suggestion | evidence 逐字在 :8，line 字段写 6（差 2 行，窗口内）。建议顺手把 line 改为 8，不阻塞 |
| [1] | warn | "no partial fallback" 注释逐字在 :36，实锤 |
| [2] | suggestion | emptyLineCount 死字段逐字在 :1381，实锤 |
| [3] | warn | KDoc 双反引号 vs 单反引号起始模式（:152），实锤 |
| [4] | suggestion | splitXmlTag 内 new Regex（:28），实锤 |
| [5] | warn | OOM 返回 nullptr（:11）vs Kotlin 非空 IntArray 声明，实锤 |
| [6] | suggestion | Char/String 双套实现（:21），实锤 |
| [7] | warn | 同名嵌套自述限制（:11），实锤 |
| [8] | warn | nativePush 无效句柄静默返回空数组（:64–65），实锤 |
| [9] | suggestion | foundHeaderSeparator_ 残留状态（:1295），实锤 |

severity 分级全部合理，无 high 膨胀、无 warn 漏报。

## 五、其他核对

- status.json：issue=86、source_commit、refs_valid=84（=facts 数组长度）、review-pending，全对（修错后 facts 若变 86 需同步）
- 禁用词检查：md/facts/quality/status 四文件 0 命中
- 正文：四态机表述与 facts[0] 一致；18 个 Markdown 插件、BaseJsonPlugin、StreamXmlPlugin、JNI 会话全覆盖
- lint：修错员已隔离重跑 0 硬失败/0 警告（复验未重复跑，文件未动）

## 总体 verdict：FAIL（2 项小修，修完建议 parent 直接核对窗口即可）

残留问题只有 facts[38]、facts[58] 两处"一果双断言"的拆分（均为机械拆条 + 重锚，断言内容本身已验真）。修错后 facts 84→86，同步 refs_valid。两处改动微小，修错员修正后 parent 直接核对 ±5 窗口即可，无需第三轮全量复核。
