# Critic 复核报告：plugins（Issue #79）

- 复核对象：`review/batch-06/plugins.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（HEAD 已确认一致）
- 方法：180 条 facts 全部拉出 ref±5 窗口逐条比对；quality 10 条 evidence 逐字比对并核实实质主张；正文行内引用逐个核对；status.json 字段核对。

## 总体 verdict：FAIL

无虚构符号、无错文件；180 条 facts 断言内容经源码核实全部为真。但有 **8 处引用锚点违规**（窗口撑不住断言）与 **quality evidence 系统性非逐字**（10/10 剥掉源码缩进），必须修错后由另一名独立 critic 复验。

---

## 一、facts 锚点问题（8 项）

### 必须修（断言为真，锚点错位）

1. **[65] 锚点错误**：fact "流式执行用 `Channel<String>(UNLIMITED)` 把 JS 中间结果转发为文本 chunk"，ref `:283` 的窗口（278–288）只有 `nextMessageProcessingExecutionId`，根本没有 Channel。Channel 实际在 **`:301`**（`val chunkQueue = Channel<String>(capacity = Channel.UNLIMITED)`）。→ 重锚 `:301`。
2. **[82] 锚点错误**：fact "开关缓存键为 `"$runtime|$chatId"`"，ref `:703` 的窗口（698–708）是 `buildToggleDefinitions`，缓存键实际在 **`:694`**（`return "$runtime|$chatId"`，`buildCacheKey` 内）。→ 重锚 `:694`。
3. **[61] 窗口支撑不全**：fact "createExecutionIfMatched 先以 probeOnly=true 的载荷逐个试探 hook"，ref `:113` 的窗口（108–118）只有载荷构造，试探循环实际在 `:120`（`for ((index, hook) in registeredHooks.withIndex())`，`:126` 用 probeEventPayload）。→ 重锚 `:123`。
4. **[153] 窗口支撑不全**：fact "`logTimeoutIfPresent` 只把含 "timed out"（忽略大小写）的失败判为超时"，ref `:56` 的窗口（51–61）只有函数签名，判定逻辑在 `:63–68`（`contains("timed out", ignoreCase = true)`）。→ 重锚 `:66`。
5. **[84] 复合事实**：fact "onToggle：已在 featureStates 中的走平台切换，否则调用 JS hook 的 toggle 动作"含两个断言；ref `:725` 的窗口（720–730）只有 JS toggle 路径，featureStates 分支在 `:714–716`（`if (params.featureStates.containsKey(spec.id)) { params.onToggleFeature(spec.id) ... }`）。→ 拆成两条：(a) 锚 `:714`，(b) 锚 `:725`。
6. **[34] 锚点偏**：fact "dispatch 对每个插件 try/catch，失败只记日志"，ref `:76` 的窗口（71–81）止于 `for (plugin in plugins) {`，try/catch 在 `:82–86`。→ 重锚 `:81`。
7. **[58] 窗口不完整**：fact "register() 共完成 12 处桥接注册"，ref `:905` 的窗口（900–910）只显示 11 个注册调用，第 12 个 `ToolPkgAiProviderRegistry.register()` 在 `:912`。断言为真（12 个已数过）。→ 重锚 `:907`。
8. **[105] 窗口支撑不全**：fact "register 把自身注册进 ChatViewHookPluginRegistry 并立即同步回放"，ref `:32` 的窗口（27–37）只有 `register(this)`，`syncAndReplayToolPkgRegistrations(...)` 在 `:40`。断言为真。→ 重锚 `:36`。

### 备注（不计 FAIL，断言已验真，锚点在定义头）

- [28] "12 个枚举值"、[113] "17 个字段"、[124] "11 种字符串"、[165] "7 个子桥接"、[168] 载荷字段清单：均经源码逐个数过为真，锚点在定义头部，±5 窗口无法覆盖全部条目——属计数类断言的固有限制，接受。
- [62] "matched 的 hook 才创建流式执行并立即返回"：创建在 `:161`、`return execution` 在 `:177`，窗口只覆盖后者；属控制流叙事重述，接受但建议锚点 `:170` 更均衡（可选）。

---

## 二、quality evidence 系统性非逐字（10/10，必须修）

**全部 10 条 evidence 都被剥掉了源码原始缩进**，违反"evidence 必须为源码逐字原文"铁律。每条必须按源码 raw bytes 重写（含缩进），并修正 3 处行号锚点：

| 条目 | 问题 | 修正 |
|---|---|---|
| Q1 (high) | evidence 3 行缩进被剥（源码 20 空格） | 逐字重写，line=86 正确 |
| Q2 (high) | 首行缩进被剥；line=70 错，evidence 首行是源码第 69 行 `return plugins` | 逐字重写，line→69 |
| Q3 (warn) | 2 行缩进被剥 | 逐字重写，line=23 正确 |
| Q4 (warn) | 4 行缩进被剥 | 逐字重写，line=118 正确 |
| Q5 (warn) | 9 行缩进被剥；line=114 错，evidence 起于第 112 行 `val raw =` | 逐字重写，line→112 |
| Q6 (warn) | 首行缩进被剥；line=75 错，evidence 起于第 67 行 `if (timeoutMillis == null) {` | 逐字重写，line→67 |
| Q7 (warn) | 3 行缩进被剥 | 逐字重写，line=36 正确 |
| Q8 (suggestion) | 1 行缩进被剥 | 逐字重写，line=113 正确 |
| Q9 (suggestion) | 缩进被剥**且丢了行尾 ` {`**（源码是 `    fun dispatchMessagePersisted(chatId: String, message: ChatMessage) {`） | 逐字重写，line=40 正确 |
| Q10 (suggestion) | 1 行缩进被剥 | 逐字重写，line=92 正确 |

**实质主张核实（全部实锤，severity 合理）：**
- Q1 high：`onToolCallIntercept` 同步 fail-closed，JS 异常/非法返回直接 `Block`（:86/:99）——无法区分故障与有意拦截，high 恰当。
- Q2 high：`createMenuItems` 的 `flatMap` 无 try/catch（:69–70），任一插件抛异常中断整个菜单构建；同目录 chatview/lifecycle 均有隔离——high 恰当。
- Q3 warn：`getToolPkgHookTimeoutSeconds()` 内部是 `runBlocking { ...first() }`（DisplayPreferencesManager.kt:300–304），确为阻塞式 DataStore 读取——finding 为真（比描述的更严重，warn 可接受）。
- Q4 warn：`dispatchHooks` 的 `runToolPkgMainHook` 调用（ToolboxPlugin.kt:113–123）确实**没有** `timeoutMillis` 参数——finding 为真。
- Q5 warn：点击失败 `return@withContext null`（:121），无用户反馈——为真。
- Q6 warn：summary 超时直接 `break`（:75），prompt 桥接回调 `onHookTimeout`（:185）——不对称为真。
- Q7 warn：`value?.toString().orEmpty()`（:36–38）null 变空串——为真。
- Q8 suggestion：probe（probeOnly=true）+ 正式执行，JS 确实被调两次——为真。
- Q9 suggestion：`dispatchMessagePersisted` 调用点共 5 处，全在 `ChatHistoryDelegate.kt`（:1191/:1428/:1435/:1446/:1454/:1458）——"唯一驱动方"为真。
- Q10 suggestion：同步后无条件 `notifyChanged()`（:92）——为真。

---

## 三、正文问题

1. **两处行内引用锚点与 facts 同错**，必须同步修正：
   - "经 `Channel<String>(UNLIMITED)` 转发为流式 chunk（`:283`）" → `:301`
   - "缓存键为 `"$runtime|$chatId"`（`:703`）" → `:694`
2. **概述 prose 小瑕**（不计 FAIL，建议顺手改）："五个 hook 注册表（应用生命周期、聊天视图、聊天消息菜单项、工具箱、消息处理等）"——与下表 5 行（lifecycle、chatview、chatmessage、toolbox、workflow）对不上（"消息处理"不是一行；ToolboxPlugin 是插件不是注册表）。
3. 其余行内引用抽查（:12/:15/:23/:29/:40/:99/:41/:44/:25/:136/:90/:454/:639/:53/:177/:185/:364/:396/:286/:346/:468/:476/:527/:585/:542/:458/:655/:797/:867/:725/:59/:72/:139/:137/:132/:153/:176/:185/:410/:441/:422/:515/:196/:75/:40/:60/:86/:99/:107/:203/:156/:168/:25/:62/:126/:40/:138/:146/:23/:33/:56/:72/:156/:96/:129）全部落在 ±5 窗口内，无虚构。

---

## 四、status.json / lint / 格式

- status.json：id=plugins、issue=79（整数）、source_repo=operit、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb、status=review-pending、refs_valid=180（整数，已修正）——全对。注意：[84] 拆条后 facts 变为 181，refs_valid 需同步。
- 5 交付文件禁用词（通过/批准/LGTM）：0 命中。
- facts/quality 顶层数组；severity 仅 high/warn/suggestion。
- lint.md 记录终轮 0 硬失败/0 警告，但其"±5 行窗口均有支撑原文"的断言**言过其实**（本报告找出 8 处反例）——修错时请勿轻信该结论，需逐条重锚后复验。

## 五、修错清单

1. quality 10 条 evidence 全部按源码 raw bytes 逐字重写（含缩进）；Q2 line→69、Q5 line→112、Q6 line→67；Q9 evidence 补回行尾 ` {`。
2. facts 重锚：[34]→:81、[58]→:907、[61]→:123、[65]→:301、[82]→:694、[105]→:36、[153]→:66。
3. [84] 拆成两条原子事实（:714 / :725）；facts 180→181，status.json refs_valid 同步为 181。
4. 正文 `:283`→`:301`、`:703`→`:694`；概述"五个 hook 注册表"表述顺手理顺。
5. 4 文件（md/facts/quality/status）/tmp 隔离重跑 `lint.py --src ~/workspace/Operit`，要求 0 硬失败/0 警告；更新 lint.md（修正"均有支撑"的过度断言）。
6. 全文禁"通过/批准/LGTM"。

修错后必须由**另一名独立 critic**复验（本 critic 不复验自己的结论）。

## verdict: FAIL
