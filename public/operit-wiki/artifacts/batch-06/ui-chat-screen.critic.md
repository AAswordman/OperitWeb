# Critic 复核报告：ui-chat-screen（Issue #89）

- 复核对象：`review/batch-06/ui-chat-screen.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 复核方式：81 条 facts 全部机械校验（文件存在/行号不越界）+ 30 条人工抽查 ±5 窗口支撑；quality 9 条 evidence 逐条与源码比对；正文 89 处行内引用全部校验；种子覆盖对照 `tracking/shards/day-4.json`。
- 种子覆盖：screens/ 2 文件、viewmodel/ 4 文件、util/ 2 文件、attachments/ 1 文件 + components/ChatHistorySelector.kt，facts 引用覆盖全部 10 个种子文件。PASS。

## 总体 verdict：FAIL（3 项必须修，均为小修，修完可复验）

### FAIL-1：facts[37] 复合事实
- 原文："ChatViewModel.dismissErrorDialog 在第 1659 行定义，同时把当前会话输入状态置为 Idle。"
- 问题：一条 fact 含两个断言（定义位置 + 行为），违反原子化铁律。
- 源码核实：两个断言各自为真（`fun dismissErrorDialog()` 在 ChatViewModel.kt:1659；函数体内对当前 chatId 调 `setInputProcessingStateForChat(chatId, InputProcessingState.Idle)`）。
- 修正：拆成两条，或改写为单断言（建议拆分，第二条 ref 同为 :1659，窗口 1654–1664 覆盖函数体）。

### FAIL-2：quality[5] evidence 非逐字原文
- 文件：`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:3016`
- 问题：evidence 末尾多了一个源码中不存在的 `\"`。源码第 3016 行以 `preview=\\\"${speechPreview(message)}\\\"\"` 结尾（即 `preview=\"...\"` 后直接是字符串结束引号），evidence 却写成 `preview=\\\"${speechPreview(message)}\\\"\\\"`（多一个转义引号）。
- 修正：删掉 evidence 末尾多余的 `\"`，与源码逐字一致。severity 为 suggestion（日志打印消息预览的隐私提示），评级合理，保留。

### FAIL-3：facts[75] ref 与正文行号自相矛盾
- 原文："MessageImageGenerator 生成的图片写到 cacheDir/shared_images/messages_<timestamp>.png（util/MessageImageGenerator.kt 第 375-383 行附近，函数内 IO 段）"，ref 为 `.../MessageImageGenerator.kt:403`。
- 问题：fact 文本括号里写"第 375-383 行附近"，ref 却是 :403，自相矛盾；且 :403 的 ±5 窗口（398–408）只覆盖 `File(context.cacheDir, "shared_images")`（:403），`messages_$timestamp.png` 文件名在 :409，落在窗口外。
- 修正：把 ref 改为 :407（窗口 402–412，同时覆盖 :403 的 outputDir 与 :409 的 outputFile），并把文本括号改为"第 403–409 行附近"。

## PASS 的部分

- facts 机械校验：81/81 ref 文件存在、行号无越界、无错文件。
- 抽查 30 条 facts（#0,2,8,13–20,26,30,36,37,38,46,48–56,58,60–66,69–75,77–80）：除上述 FAIL-1/FAIL-3 外，断言全部为真且 ±5 窗口完整支撑；无虚构符号；PendingMessageQueueStore 已正确写为 `internal class`（writer 自述的 object 笔误确已修正，源码 :16 为 `internal class PendingMessageQueueStore`）。
- quality 9 条：除 FAIL-2 外，evidence 8/8 与源码逐字命中；两条 warn 重点核实——AIChatScreen.kt:681 `catch (e: Exception)` 为空且日志行被注释（属实）、FloatingWindowDelegate.kt 5 处 `catch (_: Exception)` 空块（:91/:118/:250/:255/:277，grep 计数确为 5，属实）；severity 评级合理（warn 2 / suggestion 7，无 high 膨胀）。
- 正文：89 处行内 `file:line` 引用全部有效（文件存在、行号不越界）；结构含概述/## AI 速览（核心符号清单+主入口+数据流向一句话）/核心机制/关键符号/输入→处理→输出/来源；frontmatter 四字段齐全。
- status.json：`{"id":"ui-chat-screen","issue":89,"status":"review-pending","source_repo":"operit","source_commit":"dbf71916fae9750cfdc9f9a774f5a0fee56633fb","refs_valid":81,"critic":""}`，字段全对。
- 禁用词：5 文件全文"通过/批准/LGTM" 0 命中；severity 仅 warn/suggestion。

## 修错清单（给修错员）

1. facts[37] 拆成两条原子事实（定义位置 / 置 Idle 行为），第二条 ref 可沿用 :1659；如拆分后 facts 总数变为 82，同步更新 status.json 的 refs_valid。
2. quality[5] evidence 删掉末尾多余的 `\"`。
3. facts[75] ref 改为 :407，文本括号改为"第 403–409 行附近"。
4. 修完后 4 文件（md/facts/quality/status，不含 lint.md）复制到 /tmp 隔离跑 `python3 scripts/lint.py --src ~/workspace/Operit`，确认 0 硬失败/0 警告，并更新 lint.md。

下一步：修错后派另一名独立 critic 复验。
