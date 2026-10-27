# ui-memory（记忆与知识库界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/memory/`（12 个 Kotlin 文件），共 12 文件、约 5,150 行 @ `dbf71916`

> 覆盖记忆屏的图谱可视化（自研力导向布局）、记忆空间切换、文件夹导航、记忆增删改查、文档分块编辑、记忆间连边、搜索权重配置、云向量索引管理与搜索模拟调试。

## 概述

记忆（Memory）界面是 Operit 的"第二大脑"管理台：所有被记住的事实、文档片段都以节点形式存在一张可交互的知识图谱上。用户在这里搜索记忆、手动增删改、按文件夹分类、在记忆之间拉关系线（边），还能调整搜索打分权重、配置云端向量模型、查看搜索打分的调试明细。

记忆按"记忆空间"（profile）隔离：顶部可切换空间，切换后整套图谱、文件夹、搜索配置随之更换，数据互不干扰。文档类记忆会被切成多个块（chunk），支持块级查看、搜索与改写。

## AI 速览

- 核心符号清单：MemoryScreen、MemorySearchBar、MemoryAppBar、MemoryViewModel、MemoryUiState、MemoryViewModelFactory、GraphVisualizer、Graph、Node、Edge、FolderNavigator、FolderNode、FolderExpandedState、EditMemoryDialog、DocumentViewDialog、MemoryInfoDialog、EdgeInfoDialog、EditEdgeDialog、LinkMemoryDialog、BatchDeleteConfirmDialog、MemorySearchSettingsDialog、MemorySearchSimulationDialog、ToolTestDialog。
- 主入口：MemoryScreen() → viewModel(key = selectedProfileId) → GraphVisualizer。
- 数据流向一句话：MemoryRepository（ObjectBox + 向量索引）→ MemoryViewModel.uiState（MemoryUiState）→ GraphVisualizer 力导向布局渲染；用户手势与对话框操作 → ViewModel → Repository 写回。

## 核心机制

### 1. 记忆空间（多 profile）

profile 列表来自 `memorySpaceListFlow`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:138`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L138)）。

当前空间 id 来自 `activeMemorySpaceIdFlow`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:143`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L143)）。

各空间名称经 `getMemorySpaceFlow(profileId).first()` 逐个加载（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:147`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L147)）。

`viewModel` 以 `selectedProfileId` 为 key 创建，切换记忆空间时 ViewModel 重建（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:158`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L158)）。

进入当前屏时触发 `loadMemoryGraph()` 与 `loadFolderPaths()`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:167`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L167)）。

切换空间时调用 `setActiveMemorySpace` 持久化（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:395`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L395)）。

顶栏把搜索框、设置按钮与空间下拉菜单放在同一行（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt:49`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt#L49)）。

搜索框占剩余宽度、高 46.dp（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt:75`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt#L75)）。

空间名称最大宽 100.dp、超出省略（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt:127`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt#L127)）。

### 2. 图谱可视化与力导向布局

`Graph` 只含 `nodes` 与 `edges` 两个列表（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:8`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L8)）。

`Node` 有 id/label/color/metadata（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:10`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L10)）。

`Edge` 有 Long 型 id、sourceId/targetId、可空 label（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:17`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L17)）。

`Edge` 默认 weight 为 1.0f（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:22`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L22)）。

边的 `isCrossFolderLink` 标记跨文件夹连接（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:24`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L24)）。

`GraphVisualizer` 用 Canvas 自研力导向布局（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:212`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L212)）。

节点数超 200 时迭代 150 次，否则 300 次（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:402`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L402)）。

增量更新按 changeScore 取 28/46/72 次迭代并保留已有节点位置，避免全图重置抖动（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:309`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L309)）。

力计算用网格空间分区算排斥力（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:451`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L451)）。

理想边长 560f、排斥强度 380000f（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:418`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L418)）。

跨文件夹边吸引力系数仅 0.45、理想长度为 1.35 倍（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:541`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L541)）。

跨文件夹边用虚线绘制（`dashPathEffect`）（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:1017`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L1017)）。

簇按实线边连通分量 BFS 划分，虚线边不参与（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:95`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L95)）。

节点配色按 surface 亮度 0.42 切换深浅两套（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:228`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L228)）。

节点视觉缩放钳制 0.15..2.2（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:181`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L181)）。

渲染只画至少一端在可见区域内的边（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:964`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L964)）。

渲染只画可见区域内的节点（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:1070`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L1070)）。

选中边用 error 色绘制（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:1013`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L1013)）。

边宽按 weight 缩放（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:1004`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L1004)）。

框选模式用 `detectDragGestures` 捕获拖拽（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:822`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L822)）。

普通模式用 `detectTransformGestures` 做平移缩放、缩放范围 0.2..5（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:897`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L897)）。

节点点击命中外扩 12px（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:918`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L918)）。

边点击用 `distanceToSegment` 小于 20f 判定（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:930`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L930)）。

### 3. 三种节点交互模式

`selectNode` 按当前模式分流：普通点击查记忆、连接模式追加候选、框选模式切换选中（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:473`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L473)）。

连接模式下点击把节点 id 追加到 `linkingNodeIds`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:478`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L478)）。

选满 2 个节点时弹出建边对话框（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:522`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L522)）。

确认后 `linkMemories` 按 uuid 查到记忆并建边、退出连接模式（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:875`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L875)）。

框选拖拽用屏幕矩形相交判定命中节点（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:845`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L845)）。

`deleteSelectedNodes` 在协程中执行批量删除（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:734`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L734)）。

批量删除调 `deleteMemoriesByUuids`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:746`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L746)）。

删除前有 `BatchDeleteConfirmDialog` 二次确认（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt:214`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt#L214)）。

连接模式与框选模式互斥，进入一方会清理另一方状态（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:827`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L827)）。

框选中的节点用 tertiary 色高亮描边（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:1199`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L1199)）。

### 4. 文件夹导航

左侧文件夹树是宽 250.dp 的滑入侧栏（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:141`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L141)）。

侧栏用 `AnimatedVisibility` 左右滑入（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:374`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L374)）。

扁平路径按 `/` 切分建成树（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:472`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L472)）。

"全部"选项对应空路径（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:228`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L228)）。

展开状态用 `rememberLocal` 持久化（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:126`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L126)）。

持久化 key 为 `folder_navigator_expanded_state`，默认展开集合为空即全部折叠（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:125`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L125)）。

长按文件夹弹出右键菜单（重命名/删除），菜单与对话框不同时显示（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:330`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L330)）。

创建要求输入非空（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:566`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L566)）。

重命名要求新路径非空且与当前不同（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:604`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L604)）。

`selectFolder` 设置选中路径并刷新图谱（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:419`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L419)）。

`refreshGraph` 按 `selectedFolderPath` 选择全图或文件夹子图（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:113`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L113)）。

新建文件夹用 `.folder_placeholder` 记忆占位来创建（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:902`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L902)）。

创建后自动选中新文件夹（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:907`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L907)）。

### 5. 记忆的增删改查

新建时 `contentType` 默认 `text/plain`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:46`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L46)）。

新建时 `source` 默认 `user_input`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:47`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L47)）。

`credibility` 默认 0.8f、`importance` 默认 0.5f（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:48`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L48)）。

可信度与重要性滑杆范围均为 0f..1f（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:139`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L139)）。

标签用 `FlowRow` 展示（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:234`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L234)）。

标签以 `InputChip` 展示，带删除按钮，添加时去重（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:245`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L245)）。

`createMemory` 用当前选中文件夹作为 folderPath（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:643`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L643)）。

`updateMemory` 对文档节点保持原内容不更新（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:661`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L661)）。

空文件夹路径视为 null（未分类）（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:686`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L686)）。

`deleteMemory` 后刷新图谱与文件夹并清空选中（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:705`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L705)）。

`MemoryInfoDialog` 展示标题、内容、文件夹、uuid、来源、重要性、可信度、创建与更新时间（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt:36`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt#L36)）。

时间格式为 `yyyy-MM-dd HH:mm:ss`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt:43`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt#L43)）。

### 6. 文档节点与分块编辑

点击文档节点时：有全局搜索词则按词搜 chunk，否则取全部 chunk（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:498`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L498)）。

打开文档视图时把全局搜索词预填进文档内搜索框（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:513`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L513)）。

文档对话框高度占屏幕 0.85（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt:55`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt#L55)）。

分块列表以 `chunk.id` 为 key 渲染（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt:108`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt#L108)）。

每块是独立输入框，改动经 `onChunkChange` 回传（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt:112`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt#L112)）。

文档内搜索框 IME 动作为 `ImeAction.Search`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt:91`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt#L91)）。

空查询时显示全部分块（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:547`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L547)）。

保存时仅更新标题变化与内容变化的 chunk（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:470`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L470)）。

块内容更新后刷新列表（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:613`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L613)）。

### 7. 搜索与权重配置

`searchMemories` 用 `searchConfig` 的四类权重调 `repository.searchMemories`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:148`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L148)）。

搜索结果经 `getGraphForMemories` 转成子图展示（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:167`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L167)）。

关键词与标签权重滑杆范围 0.0f..20.0f（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:125`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L125)）。

向量与边权重滑杆范围 0.0f..2.0f（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:139`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L139)）。

自动保存间隔滑杆上下限取自 `MemorySearchSettingsPreferences` 的 MIN/MAX（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:155`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L155)）。

保存前配置调 `normalized()`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:100`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L100)）。

配置持久化走 `Dispatchers.IO`（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:283`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L283)）。

重置按钮恢复 `BALANCED` 模式与 10.0/0.0/0.0/0.4 四项权重（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:369`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L369)）。

### 8. 云向量与索引重建

endpoint 初始化时过滤空白字符（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:82`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L82)）。

apiKey 默认 `PasswordVisualTransformation` 可切换明文（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:235`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L235)）。

保存时校验 endpoint：为空、非 http(s) 开头、含多个 URL 分别报错，非法时阻止保存（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:335`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L335)）。

向量索引重建中直接返回以防重入（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:328`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L328)）。

重建完成后刷新维度用量并提示完成条数（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:348`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L348)）。

进度区显示百分比与 processed/total/failed 及阶段文案（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:308`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L308)）。

`stageText` 映射 preparing 等 6 个阶段（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:485`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L485)）。

### 9. 搜索模拟调试

搜索模拟输入框 minLines=3（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt:53`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt#L53)）。

`SummaryCard` 展示 scope 计数、四类匹配数、打分/过阈/阈值与五项权重（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt:94`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt#L94)）。

`TokensCard` 展示 keywords 与 lexicalTokens（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt:153`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt#L153)）。

`CandidatesCard` 只取前 30 个候选（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt:192`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt#L192)）。

候选按 `passedThreshold` 标记 PASS 或 DROP（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt:214`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt#L214)）。

`runSearchSimulation` 在协程中执行搜索模拟（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:218`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L218)）。

搜索模拟调 `searchMemoriesDebug` 并限定当前文件夹（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:233`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L233)）。

工具测试结果用 Gson pretty printing 格式化（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:591`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L591)）。

### 10. 文件导入

文件选择器限定 text/*、pdf、doc、docx 四类 MIME（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:305`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L305)）。

文本类文件直接读取文本导入（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:206`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L206)）。

非文本文件先拷到 cacheDir 临时文件，再经 `read_file_full` 工具解析后导入（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:229`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L229)）。

临时文件在 finally 中删除（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:251`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L251)）。

`importDocument` 导入到当前选中文件夹并刷新图谱与文件夹（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:623`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L623)）。

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| `MemoryScreen` | 记忆屏根组合：多空间、文件导入、FAB、对话框层 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:135`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L135) |
| `MemoryViewModel` | 记忆屏业务逻辑：图谱加载、搜索、增删改、文件夹、索引重建 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:96`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L96) |
| `MemoryUiState` | 承载全部界面状态的数据类 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:33`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L33) |
| `GraphVisualizer` | Canvas 自研力导向图谱渲染与手势 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt:212`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt#L212) |
| `Graph` | 图谱：只含 nodes 与 edges 两个列表 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:5`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L5) |
| `Node` | 图谱节点：id/label/color/metadata | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:10`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L10) |
| `Edge` | 图谱边：Long id、起止节点、可空 label、权重 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt:17`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt#L17) |
| `FolderNavigator` | 左侧文件夹树侧栏 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt:104`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt#L104) |
| `MemoryAppBar` | 顶部搜索框 + 设置 + 空间下拉 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt:49`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt#L49) |
| `EditMemoryDialog` | 新建/编辑记忆对话框 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt:26`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt#L26) |
| `DocumentViewDialog` | 文档分块查看与编辑对话框 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt:38`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt#L38) |
| `MemorySearchSettingsDialog` | 搜索权重/云向量/索引重建设置 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt:54`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt#L54) |
| `MemorySearchSimulationDialog` | 搜索打分模拟调试 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt:28`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt#L28) |
| `LinkMemoryDialog` | 两节点建边对话框 | [`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt:170`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt#L170) |

## 调用链

1. 打开记忆屏：输入=进入记忆屏 → 处理=`LaunchedEffect` 触发入场加载 → 输出=图谱与文件夹渲染完成（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt:167`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt#L167)）。

2. 搜索记忆：输入=搜索框 query → 处理=`searchMemories` 用四类权重调仓库搜索 → 输出=转子图只显示命中节点（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:148`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L148)）。

3. 新建记忆：输入=FAB → 对话框填写 → 处理=`createMemory`，folderPath 取当前选中文件夹 → 输出=刷新图谱与文件夹列表（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:643`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L643)）。

4. 两记忆建边：输入=连接模式点选 2 个节点 → 对话框填类型/权重 → 处理=`linkMemories` 按 uuid 查记忆后建边 → 输出=退出连接模式，图谱刷新出新边（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:875`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L875)）。

5. 导入文档：输入=文件选择器选文件 → 处理=文本直读 / 工具解析 → `importDocument` 切块建文档节点 → 输出=图谱新增文档节点（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:623`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L623)）。

6. 重建向量索引：输入=设置页点重建 → 处理=跑向量索引重建，进度回调更新 UI → 输出=刷新维度用量并提示完成条数（[`app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt:346`](https://github.com/AAswordman/Operit/blob/dbf71916fae9750cfdc9f9a774f5a0fee56633fb/app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt#L346)）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryScreen.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/MemoryAppBar.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/FolderNavigator.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/GraphVisualizer.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/graph/model/GraphModels.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/DocumentViewDialog.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/EditMemoryDialog.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemoryDialogs.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSettingsDialog.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/MemorySearchSimulationDialog.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/screens/dialogs/ToolTestDialog.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/memory/viewmodel/MemoryViewModel.kt`
