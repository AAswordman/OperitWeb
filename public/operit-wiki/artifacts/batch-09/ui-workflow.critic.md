# Critic 评审报告：ui-workflow（Issue #114）

- 评审人：独立 critic（新 session，只读 md/facts 与源码）
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 评审时间：2026-10-01
- 结论：**FAIL（需修改，非推倒重来）**——1 条事实锚点错位需修复，其余全部通过

## 1. facts 抽查：32 条，命中 31 / 错位 1

随机抽样（seed=114）32/169 条，逐条 sed 实地核对源码窗口（±5 行口径）：

命中 31 条（断言与源码一致，0 编造），包括：
- [61] NodeActionMenu.kt:43 菜单五按钮顺序（编辑/查看日志/创建连接/删除节点红字/取消），逐行核对 :46–:115 一致
- [86] WorkflowListScreen.kt:724 成功率公式 `(successfulExecutions.toFloat()/totalExecutions*100).toInt()`
- [12] ConnectionMenu.kt:313 initialMode 三模式推导（空→DEFAULT、false 忽略大小写→FALSE、其余→CUSTOM）
- [39] GridWorkflowCanvas.kt:141 标签规则 true→"T"、false→"F"、其他取前 12 字符加 "R:" 前缀
- [165] WorkflowViewModel.kt:1548 `node.position.x/y` 直接修改做落点持久化
- [158] WorkflowViewModel.kt:1303 CancellationException → 清空执行状态并静默重载
- [111] WorkflowDetailScreen.kt:754 工具过滤 `package_proxy`/`proxy`/`search`
- [77] WorkflowListScreen.kt:163 FAB 图标 `animateFloatAsState` 旋转 45f/0
- 其余 [144][25][62][160][159][132][135][162][75][148][16][137][95][27][23][118][101][28][94][134][117][59][57] 全部精确命中

错位 1 条：
- **[122]** `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:1958` —— 断言"app_open 触发类型只显示帮助文本，不提供 JSON 配置框"为真，但 :1958 落在 `triggerType == "schedule"` 分支（定时配置按钮）；app_open 分支实际在 **:1970**（`} else if (triggerType == "app_open") {`，:1971–1974 仅显示帮助文本）。→ 应改为 `:1970`。

全量 169 条机器校验：键恰为 `{fact, ref}`、ref 全部为仓库根相对全路径、文件全部存在、行号全部合法——0 异常。

## 2. quality.json 核查：8/8 真实

warn 3 / suggestion 5，file:line 全部存在，evidence 与源码一致，severity 合理：
- [0] warn GridWorkflowCanvas.kt:325 — 连接标签 `Paint()` 在绘制作用域内逐帧分配（实地命中 :325 `val labelTextPaint = Paint().apply`）
- [1] suggestion :328 — 标签色 `android.graphics.Color.BLACK` 硬编码（同窗口 :328）
- [2] warn WorkflowViewModel.kt:1617 — `isWorkflowScheduled` 主线程 `runBlocking`
- [3] warn ScheduleConfigDialog.kt:52 — `remember(initialConfig)` 被用作副作用（解析配置并写 calendar）
- [4] suggestion :416 — `intervalValue.toLongOrNull() ?: 15` 无下限校验（0/负数可通过）
- [5] suggestion WorkflowViewModel.kt:1548 — 就地改 position 且异常静默吞掉
- [6] suggestion GridWorkflowCanvas.kt:190 — `Regex(effectiveCondition)` 每次调用编译
- [7] suggestion WorkflowDetailScreen.kt:2043 — JSON 解析失败 catch 后返回 emptyMap() 静默置空

字段齐全（category/confidence/detail/evidence/file/line/severity/title），severity 只用 warn/suggestion，无 high。

## 3. md 结构核查：§9 合规

- 六节齐全：## 概述 / ## AI 速览 / ## 核心机制 / ## 关键符号 / ## 调用链 / ## 来源；AI 速览含核心符号清单+主入口+数据流向一句话
- frontmatter 齐全：title / module / sources=8 / date / issue=114；sources=8 = facts 去重引用文件数（8），一致
- 禁用词（可能/大概/似乎/应该/也许）facts 与正文均为 0 命中
- 无编造：调用链 7 条的 refs 抽查（:1462 connectionExists、:140 runningWorkflowIds、:1277 triggerWorkflow）全部命中；种子"8 文件、7,032 行"与正文一致
- 人话到位：列表/画布/连接线/节点卡片/连接管理/节点编辑/定时/执行日志/状态中枢九节叙事清晰，术语首现带解释

## 4. status.json 核查：合规

refs_valid=169 = facts 数，status=review-pending，issue=114，source_repo=operit，source_commit=完整 hash dbf71916fae9750cfdc9f9a774f5a0fee56633fb。

## 5. lint：本页 0 硬失败 / 0 警告

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09` 按 ui-workflow.* 过滤：真实条目文件（md/facts/quality/status）0 硬失败 / 0 警告。唯一报错落在 `ui-workflow.lint.md` 自检报告自身（frontmatter/禁用词扫描自检报告），系 lint.py 扫描自检报告的已知工具 quirks，batch-08 同理，不阻塞。

## 必须修复清单（1 项）

1. fact[122]：ref `.../screens/WorkflowDetailScreen.kt:1958` → `:1970`（app_open 分支实际位置）

修复后针对性复验该条即可 PASS，无需重审全文。
