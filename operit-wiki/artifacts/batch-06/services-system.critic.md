# Critic 复核报告：services-system（Issue #78）

- 复核范围：`review/batch-06/services-system.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 HEAD 一致）
- 方法：127 条 facts 全部拉 ref±5 行窗口逐条比对源码；11 条 quality evidence 逐字比对；正文 97 处行内引用抽验；种子覆盖与页面问题核对。

## 总体 verdict：FAIL（需修错后由另一名独立 critic 复验）

## 一、facts（127 条）：124 PASS / 3 条需修

机械检查：127 个 ref 全部可解析、文件存在、行号无越界；无复合事实、无虚构符号。

需修 3 条：

1. **[57] 事实表述不准确** —— "createLayoutParams 针对 6 种 FloatingMode 生成不同的窗口尺寸与 flag"。实际 `when` 只有 **4 个分支**：`FULLSCREEN/SCREEN_OCR` 共用分支、 `BALL/VOICE_BALL` 共用分支、`WINDOW`、`RESULT_DISPLAY` 各一分支（FloatingWindowManager.kt:509-560）。"不同"二字不成立。修正建议：改为"6 种模式分 4 组分支生成窗口参数"，或重锚到 :536。
2. **[49] 锚点落在错误行** —— ref `:157` 是 `setCloseCallback` 的行，`getChatCore` 在 `:154`。±5 窗口（152-162）虽含 154，支撑成立，但锚点应为 :154。修正：ref 改 `:154`。
3. **[93] 引用窗口支撑不全** —— "初始为悬浮球，点击后展开为全屏分析模式"，ref `:113`。窗口（108-118）只覆盖了 `updateWindowLayout` 的展开逻辑；"初始为悬浮球"的证据（`isExpanded` 默认 false 在 :46、"Start with floating ball size" 注释在 :61）落在窗口外。修正：拆成两条或补锚。

其余 124 条 PASS（含数字断言：通知 ID 1001、崩溃 60 秒/3 次熔断、10 分钟 WakeLock、200 条通知上限、IME 200ms/4 次重试、48dp 模糊半径、12 个回调方法、7 个委托 getter，均与源码一致）。

## 二、quality（11 条）：evidence 逐字全中，但 2 处行号错、2 处描述夸大

evidence 11/11 与源码逐字一致；severity 分级合理（warn 5 / suggestion 6，无 high 膨胀）。

必须修：

4. **Q[9] 行号错** —— evidence `(application as OperitApplication).initializeMainApplication()` 实际在 **:215**，不是 :213。修正：line 213→215。（描述本身成立：该强转不在 try 块内，ClassCastException 会从 onCreate 抛出。）
5. **Q[10] 行号错** —— evidence `return super.onGetSupportedVoiceActions(voiceActions)` 实际在 **:40**，不是 :38。修正：line 38→40。

描述需修正：

6. **Q[4] "互相拉活"夸大** —— 绑定是**单向**的：只有 `UIDebuggerService` 以 `BIND_AUTO_CREATE` 绑定 `FloatingChatService`（:77），后者并未反向绑定。描述中"两个前台服务互相拉活：任一被杀都会被对方重新拉起"不成立。修正：改为单向绑定表述（UIDebuggerService 存活期间 FloatingChatService 被系统保活）。
7. **Q[1] "几乎无法彻底关闭"过强** —— 用户经悬浮窗关闭按钮走 `onClose`→`stopSelf()`（:716）可正常关闭；`onTaskRemoved` 自重启只针对"划掉任务"场景。修正：软化表述为"划掉任务后服务会自重启，用户需经窗口内关闭按钮才能彻底停止"。

## 三、正文：PASS，2 处行内引用锚点建议挪位（不阻塞）

- 固定结构完整（概述 / AI 速览 / 核心机制 / 关键符号 / 输入→处理→输出 / 来源），行内引用 97 处。
- 15 个种子文件全覆盖（14 个 services/ kt + FloatingMode.kt），"来源"行数（3738 行≈"约 3728"）一致。
- 页面 3 个问题（前台服务职责划分、悬浮窗窗口生命周期、系统助手语音入口与通知监听）全部覆盖；走查未写入正文。
- 建议（修错时顺手）：正文"snapshot 按时间戳倒序"引用 `:61`，关键行 `sortedByDescending` 在 :68，超出 ±5，建议重锚 :64 或 :68；"extractText 合并"引用 `:81`（函数声明行），合并逻辑在 85-101，建议重锚 :85。

## 四、status.json / lint / 禁用词：PASS

- issue=78（整数）、source_commit=`dbf71916…`、refs_valid=127（=facts 实际条数）、status=`review-pending`、critic 留空。
- 评审触发词 5 文件 0 命中。
- lint 0 硬失败 / 0 警告（记录与隔离重跑一致）。

## 修错清单（共 7 项）

1. facts[57]："不同"→"6 种模式分 4 组分支"，或重锚。
2. facts[49]：ref :157→:154。
3. facts[93]："初始为悬浮球"补锚或拆条。
4. quality[9]：line 213→215。
5. quality[10]：line 38→40。
6. quality[4]：删除"互相拉活"表述，改为单向绑定。
7. quality[1]：软化"几乎无法彻底关闭"表述。

修错后必须由另一名独立 critic 复验（本 critic 不复验自己的结论）。
