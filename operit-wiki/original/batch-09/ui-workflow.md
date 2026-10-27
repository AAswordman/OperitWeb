---
title: 工作流界面
module: UI / 工作流
sources: 8
date: 2026-10-01
issue: 114
---

# ui-workflow（工作流界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/`（8 个 Kotlin 文件、7,032 行）@ `dbf71916`

> 覆盖工作流的可视化编辑器：工作流列表（FAB 新建/模板/多选删除）、节点画布（网格/缩放/拖拽/连接线/执行状态着色）、节点卡片、连接管理、五种节点类型的创建与编辑对话框、定时配置、执行日志，以及背后的 WorkflowViewModel。

## 概述

工作流界面是 Operit 里"搭自动化流程"的可视化编辑器。用户在列表页管理工作流（新建、从模板创建、批量删除、开关启用），点进详情页后在一块可缩放的网格画布上摆放节点、拖拽连线、配置每种节点的参数，最后触发执行并查看日志。

整套 UI 围绕五个可组合部件：WorkflowListScreen（列表）、WorkflowDetailScreen（详情）、GridWorkflowCanvas（画布）、DraggableNodeCard（节点卡片）、NodeDialog（节点编辑），状态全部收拢在 WorkflowViewModel，经 WorkflowRepository 做持久化、触发执行与定时调度。

## AI 速览

- **核心符号清单**：WorkflowListScreen、WorkflowDetailScreen、GridWorkflowCanvas、DraggableNodeCard、NodeDialog、ConnectionMenuDialog、ConnectionConditionDialog、NodeActionMenuDialog、ScheduleConfigDialog、WorkflowExecutionLogDialog、WorkflowViewModel、WorkflowCard、ExecutionStatusBar、referenceEdges、isConnectionActive、connectionLabelText、buildExecuteActionConfig、templateNodePosition。
- **主入口**：WorkflowListScreen（列表）→ WorkflowDetailScreen（画布编辑）→ GridWorkflowCanvas（渲染+手势）/ NodeDialog（节点表单）；状态中枢 WorkflowViewModel。
- **数据流向一句话**：用户手势/表单 → WorkflowViewModel → WorkflowRepository 持久化或触发执行 → State/StateFlow 回流 → Compose 重组；执行中的节点状态经 nodeExecutionStates 实时推送到画布，按成功/失败/运行中给节点描边和连线着色。

## 核心机制

### 列表页：FAB 速度拨号与多选删除

`WorkflowListScreen` 是工作流的入口（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:50`）。
右下角 FAB 点开后展开三个动作：新建空白工作流、从模板创建、多选（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:100`）。
FAB 展开时图标经 `animateFloatAsState` 旋转 45 度，收起回 0（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:163`）。

多选模式下顶部出现 `WorkflowSelectionBar`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:422`）。
确认删除后调 `viewModel.deleteWorkflows(idsToDelete)`，成功后清空选择并退出多选（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:400`）。
`LaunchedEffect` 在多选模式下把已选 id 与现存工作流 id 取交集，列表删空时自动退出多选（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:67`）。

每张 `WorkflowCard` 显示名称、启用开关、禁用徽标、执行状态条、成功率、节点数与更新时间（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:623`）。
多选模式下卡片右侧为 `Checkbox`，普通模式为 `Switch`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:690`）。
`ExecutionStatusBar` 中 SUCCESS 配三级色对勾、FAILED 配红色错误图标（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:796`）。
成功率文字 ≥80% 三级色、≥50% 主色、否则红色（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:864`）。

### 画布：4000×3000 网格、缩放、拖拽吸附

`GridWorkflowCanvas` 是可缩放的网格画布（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:62`）。
画布逻辑尺寸 4000×3000 dp，网格单元 40 dp（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:51`）。
背景网格点用 `drawPoints` 绘制（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:296`）。

双指缩放用 `detectTransformGestures`，钳制 0.25–3（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:257`）。
双击调用 `fitViewportToNodes` 重置视图（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:269`）。
首次布局后自动适配一次，`hasAutoFitted` 防重复（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:242`）。

拖动时 `dragOffset` 按缩放折算（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:708`）。
松手后吸附到网格并经 `onNodePositionChanged` 回传持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:720`）。

### 连接线：贝塞尔曲线、条件标签、激活着色

连接线是三次贝塞尔曲线，端点取自节点矩形边缘交点（`getEdgePoint`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:487`）。
曲线中点和终点各画一个实心箭头（`drawArrow`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:671`）。

条件标签由 `connectionLabelText` 生成（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:132`）。
标签画在曲线中点，白色圆角底加线色描边（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:663`）。

`isConnectionActive` 按源节点执行结果与条件判定连线是否激活（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:163`）。
线宽按激活状态取值（`lineWidth`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:469`）。

引用边从 `ExecuteNode` 的 `actionConfig` 抽取 `ParameterValue.NodeReference`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:92`），表示"参数引用了那个节点的输出"，画成橙色虚线。

### 节点卡片：五种配色、四种执行描边

`DraggableNodeCard` 是可拖动的节点卡片（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:46`）。
卡片固定 120×80 dp（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:119`）。
五种节点类型各有配色（`NodeStyle`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:71`）：触发绿、执行蓝、条件橙、逻辑紫、提取青。

执行状态决定边框色（`executionBorderColor`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:61`）：Running 蓝、Success 绿、Skipped 灰、Failed 红。
有执行状态时边框 3 dp，否则 2 dp（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:178`）。

长按检测用 `delay(500)`，500ms 未拖动才触发（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:136`）。
拖动结束延迟 100ms 重置拖动标志，防误触点击（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:167`）。
长按弹出 `NodeActionMenuDialog`：编辑、查看日志、创建连接、删除节点、取消（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/NodeActionMenu.kt:22`）。

### 连接管理：条件三种模式

`ConnectionMenuDialog` 按源节点管理连接（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:28`）。
可连接目标排除自己和已连接（`availableTargets`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:42`）。

`ConnectionConditionDialog` 提供 DEFAULT/FALSE/CUSTOM 三种条件模式（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:307`）。
确认时 DEFAULT 映射为 null、FALSE 映射为 false 字符串、CUSTOM 取去空格文本（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:390`）。

### 节点编辑：五种节点、六种触发器

以 `node` 是否为 null 区分创建与编辑模式（`isEditMode`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:727`）。
支持 trigger/execute/condition/logic/extract 五种节点（`nodeTypes`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:991`）。

- **trigger**：六种触发类型（`triggerTypes`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:999`）：manual/schedule/tasker/intent/speech/app_open。
切换类型时自动重填 `triggerConfig` 默认示例（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:1941`）。
schedule 类型弹定时配置对话框，确认后转 JSON 写回 `triggerConfig`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:1958`）。
- **execute**：工具名来自 `AIToolHandler`，过滤掉代理与搜索工具（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:751`）。
下拉按输入模糊过滤取前 50（`filteredToolNames`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:759`）。
参数按 schema 合并排序并填默认值（`toolParameterSchemasByName`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:787`）。
`buildExecuteActionConfig` 丢弃空 key 与无值的非必填静态参数（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:694`）。
- **condition**：比较符转义为符号显示（`ConditionOperator.toDisplayText`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:64`），左右值可在静态值与节点引用间切换。
- **logic**：AND/OR 显示为 `&&`/`||`（`LogicOperator`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:80`）。
- **extract**：六种提取模式（`ExtractMode`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:88`）。
数字解析失败有兜底（`randomMax` 默认 100，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:2101`）。

### 定时配置：三种调度类型

`ScheduleConfigDialog` 支持 interval/specific_time/cron 三种调度（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:31`）。
interval 默认值取自 `interval_ms` 换算，不足取 15（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:43`）。
确认时换算为毫秒 `interval_ms`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:422`）。
cron 带 10 个常用预设（`cronPresets`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:91`）。
时间选择器固定 24 小时制（`TimePickerDialog`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:258`）。
回传固定含三个键（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:410`）：`schedule_type`、`enabled`、`repeat`。

### 执行与日志

详情页 FAB 按运行状态切换触发/取消（`runningWorkflowIds`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:140`）。
`WorkflowExecutionLogDialog` 显示执行记录与失败阶段（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:590`）。
支持按 `nodeId` 过滤（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:603`）。

### WorkflowViewModel：状态中枢与 8 个内置模板

`WorkflowViewModel` 继承 `AndroidViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:46`）。
对外暴露 `workflows`、`isLoading`、`error`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:55`）。
还有 `currentWorkflow` 与 `latestExecutionRecord`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:64`）。
节点执行状态经 `_nodeExecutionStates` 对外为只读流（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:70`）。
`runningWorkflowIds` 直接引用仓库（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:72`）。

并发加载用递增 `requestId` 防覆盖（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:123`）。
`isLoading` 用 `activeVisibleLoadCount` 引用计数管理（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:138`）。
订阅 `workflowUpdateEvents`，仓库变更时静默重载（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:88`）。
`setWorkflowEnabled` 乐观更新、失败回滚（`replaceWorkflowInState`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1179`）。

8 个内置模板由 `createChatTemplateWorkflow` 等函数生成（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:301`）。
模板节点坐标按 `templateNodePosition` 排布（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:448`）。
拖拽落点直接改 `node.position` 做持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1548`）。
删除节点时连带删除其连接（`deleteNode`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1374`）。

## 关键符号

- `WorkflowListScreen` —— 工作流列表页入口（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt:50`）
- `WorkflowDetailScreen` —— 工作流详情/画布编辑页（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:116`）
- `GridWorkflowCanvas` —— 可缩放网格画布（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:62`）
- `DraggableNodeCard` —— 可拖动节点卡片（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt:46`）
- `NodeDialog` —— 五种节点的创建/编辑对话框（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:720`）
- `ConnectionMenuDialog` —— 按源节点管理连接（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:28`）
- `ConnectionConditionDialog` —— 连接条件三模式编辑（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:307`）
- `NodeActionMenuDialog` —— 节点长按操作菜单（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/NodeActionMenu.kt:22`）
- `ScheduleConfigDialog` —— 三种调度类型配置（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt:31`）
- `WorkflowExecutionLogDialog` —— 执行日志与失败阶段（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:590`）
- `WorkflowViewModel` —— 状态中枢（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:46`）
- `referenceEdges` —— 参数引用边抽取（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:78`）
- `isConnectionActive` —— 连接激活判定（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:159`）
- `connectionLabelText` —— 连接条件标签（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:127`）
- `buildExecuteActionConfig` —— 执行参数组装（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:694`）
- `templateNodePosition` —— 模板节点布局（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:448`）
- `updateNodePosition` —— 拖拽落点持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1535`）

## 调用链

1. 打开列表：输入——路由进入列表页 → 处理——`loadWorkflows` 加载列表（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:116`）→ 输出——工作流卡片列表。
2. 从模板创建：输入——FAB → 从模板创建 → 选模板 → 处理——模板函数生成节点并落盘（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:301`）。
节点坐标按 `templateNodePosition` 排布（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:448`）→ 输出——跳详情页，画布按坐标渲染。
3. 拖动节点：输入——卡片拖拽 → 处理——画布按缩放折算位移（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt:708`）。
松手吸附网格后 `updateNodePosition` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1535`）→ 输出——节点落到网格点。
4. 创建连接：输入——长按节点 → 创建连接 → 点目标 → 处理——对话框列出可用目标（`availableTargets`，`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt:42`）。
创建前检查 `connectionExists`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1462`）→ 输出——贝塞尔连线出现在画布。
5. 编辑节点：输入——长按 → 编辑 → 处理——节点表单（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:720`）。
`buildExecuteActionConfig` 组装参数（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:694`）→ 输出——卡片与画布重组。
6. 触发执行：输入——FAB 触发 → 处理——`triggerWorkflow` 清空旧状态并按节点回调更新状态流（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt:1277`）→ 输出——节点描边与连线实时着色，FAB 切为"取消"。
7. 配置定时：输入——trigger 选 schedule → 配置定时 → 处理——返回后转 JSON 写回 `triggerConfig`（`app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt:1958`）→ 输出——工作流按配置调度。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowListScreen.kt`（942 行）：列表页、FAB 速度拨号、多选删除、工作流卡片、执行状态条、新建与模板选择对话框
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/screens/WorkflowDetailScreen.kt`（2,300 行）：详情页、FAB 菜单、NodeDialog 五种节点表单、执行日志对话框、连接菜单装配
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/GridWorkflowCanvas.kt`（771 行）：网格画布、缩放/双击/拖拽手势、贝塞尔连接线、条件标签、激活着色、引用边
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/DraggableNodeCard.kt`（339 行）：节点卡片、五种类型配色、执行状态描边、长按/拖拽/点击手势
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ConnectionMenu.kt`（467 行）：连接管理对话框、条件三模式编辑
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/NodeActionMenu.kt`（126 行）：节点长按操作菜单
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/components/ScheduleConfigDialog.kt`（456 行）：interval/specific_time/cron 三种调度配置
- `app/src/main/java/com/ai/assistance/operit/ui/features/workflow/viewmodel/WorkflowViewModel.kt`（1,631 行）：状态中枢、CRUD、触发/取消执行、8 个内置模板、调度
