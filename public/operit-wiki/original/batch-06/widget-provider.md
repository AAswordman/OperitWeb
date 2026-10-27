---
title: 桌面小组件与文档提供器
module: 系统服务 / app
sources: 12
date: 2026-10-01
---

# 桌面小组件与文档提供器（widget-provider）

**概述**：这一页讲 Operit 在系统层面的两个"出口"。一是桌面小组件：用户把 Operit 放到手机桌面上，一类是"工具包小组件"——显示某个工具包（ToolPkg）自带的界面，点击跳回 App 内对应页面；另一类是"语音助手小组件"——桌面一点就直接进全屏语音对话。二是文档提供器（DocumentsProvider）：把 Operit 内部的三块数据（记忆库、应用私有数据目录、workspace 工作目录）包装成 Android 系统的文件浏览器能打开的"文档"，用户在系统文件 App 里就能浏览、创建、改名、删除这些数据，改动会实时写回数据库。

## AI 速览

- **核心符号**：`ToolPkgDesktopGlanceWidget`、`ToolPkgDesktopWidgetHost`、`ToolPkgDesktopWidgetConfigActivity`、`ToolPkgDesktopWidgetDslRenderer`（`loadToolPkgDesktopWidgetRenderData` / `RenderToolPkgDesktopWidgetDsl`）、`VoiceAssistantGlanceWidget`、`MemoryDocumentsProvider`、`OperitDataDocumentsProvider`、`WorkspaceDocumentsProvider`。
- **主入口**：桌面小组件渲染入口是 `ToolPkgDesktopGlanceWidget.provideGlance`；文档访问入口是三个 Provider 的 `queryRoots` / `queryChildDocuments` / `openDocument`。
- **数据流向一句话**：桌面点击选择 → 小组件配置页把"选了哪个工具包界面"存进 SharedPreferences → 系统请求刷新时读配置、用工具包的 JS DSL 脚本渲染出界面；系统文件 App 的浏览/读写请求 → DocumentsProvider 把文档 ID 翻译成"记忆空间/文件夹/记忆条目"或"真实文件路径" → 直接读写数据库或磁盘。

## 核心机制

### 1. 工具包桌面小组件（Glance 实现）

桌面小组件基于 Jetpack Glance（Compose for Widgets）实现，挂载点是 `ToolPkgDesktopWidgetReceiver`（`GlanceAppWidgetReceiver` 子类），实际渲染逻辑在 `ToolPkgDesktopGlanceWidget.provideGlance`。

**"一个桌面位置只能绑定一个工具包界面"**：`ToolPkgDesktopWidgetHost` 用 SharedPreferences（文件名 `toolpkg_desktop_widget_host`）按 `appWidgetId` 存 11 个键——选择键（`容器包名:小组件ID`）、跳转路由、渲染路由、容器包名、标题/副标题/描述/图标/排序。用户添加小组件时，`android:configure` 指向的 `ToolPkgDesktopWidgetConfigActivity` 会弹出来让用户挑一个工具包界面；选完 `saveSelection` 同步 `commit()` 落盘，再 `RESULT_OK` 结束。`onStop` 里等 300ms（等桌面把小组件实例建好）再 `refreshAll` 触发首次渲染。

渲染时 `provideGlance` 做三件事：① `GlanceAppWidgetManager.getAppWidgetId` 拿到系统小组件 ID；② `resolveSelection` 读出用户当初选的界面（如果工具包已卸载，退回用当初存下来的快照信息）；③ `loadToolPkgDesktopWidgetRenderData` 真正去渲染。

**渲染 = 跑一遍工具包的 JS 界面脚本**：`loadToolPkgDesktopWidgetRenderData` 按"容器包名 + renderRouteId"找到工具包的 UI 路由，取出它的 Compose DSL 脚本，用 `PackageManager.acquireToolPkgExecutionEngine` 拿一个 JS 引擎（执行上下文键含 appWidgetId、容器包名、模块 ID，保证隔离），先执行脚本得到初始界面树，再看界面树根节点的 `onLoad` 属性——有就再执行一次 `onLoad` 动作拿最终界面树。引擎用完在 `finally` 里释放。

`RenderToolPkgDesktopWidgetDsl` 把 DSL 节点树翻译成 Glance 组件：`column/row/box/text` 等常规布局一一映射；按钮统一渲染成蓝色底白字；进度条在小组件里画不出来，`linearprogressindicator` 被降格成"87%"这样的百分比文字，`circularprogressindicator` 直接显示 "Loading" 文字；不认识的节点类型就把它的子节点拍平成一列。不管 DSL 里有没有配点击，整个小组件默认可点——点一下按当初选的 `routeId` 启动 `MainActivity` 跳到对应页面；还没配置过的小组件点一下则打开配置页。

小组件从桌面删掉时，`ToolPkgDesktopWidgetReceiver.onDeleted` 会把该 appWidgetId 的配置清掉，不留垃圾。

两个细节：小组件描述文件里 `updatePeriodMillis="0"`，即不靠系统定时刷新，只在配置变更或 `refreshAll` 时刷新；两个小组件都只声明了 `home_screen` 分类。

### 2. 语音助手小组件

`VoiceAssistantGlanceWidget` 是个极简的快捷入口：蓝色半透明底（白天 `#CC2196F3`、夜间 `#CC1976D2`，70% 不透明）、麦克风图标 + "Operit" 字样。点一下不经过 `MainActivity`，直接 `startForegroundService` 启动 `FloatingChatService`，并带上 `INITIAL_MODE=FULLSCREEN` 和自动进入语音聊天的标志。挂载的 Receiver 是 `VoiceAssistantWidgetReceiver`。

### 3. 三个 DocumentsProvider（系统文件接入）

三个 Provider 都在 Manifest 里 `exported="true"`，authority 分别是 `${applicationId}.documents.memory`、`${applicationId}.documents.data`、`${applicationId}.documents.workspace`，都需要 `MANAGE_DOCUMENTS` 权限才能被系统文件 App 调用。

**MemoryDocumentsProvider（记忆库 → 虚拟文件树）**：最复杂的一个。它把"记忆空间（Profile）→ 文件夹 → 记忆条目"映射成四层文档树：

- 根（`root`）→ 各个记忆空间（`profile:<空间ID>`）
- 记忆空间 → 顶层文件夹 + 直属记忆条目
- 文件夹（`dir:<空间ID>:<Base64路径>`）→ 子文件夹 + 该文件夹的记忆条目
- 记忆条目（`mem:<空间ID>:<uuid>`）→ 以 `标题.json` 显示的单个文件

文档 ID 有两套写法：直接 ID（上面的前缀格式）和"合成树 ID"（用显示名逐级拼的路径，如 `root/我的空间/工作/会议纪要.json`），后者靠 `parseSyntheticTreeDocumentId` 按显示名逐级解析，方便外部应用按路径访问。

读文件（`openDocument` 读模式）：把记忆条目序列化成含 13 个字段的 JSON（uuid、标题、正文、类型、来源、可信度、重要度、文件夹路径、是否文档节点、创建时间/更新时间等），写进缓存目录的临时文件，以只读方式打开，关闭时删掉临时文件。

写文件（写模式）：同样先给一份当前 JSON 的临时文件；用户（外部编辑器）改完关闭后，后台单线程池把写回的内容解析出来调 `repo.updateMemory`。写回时只更新标题/正文/类型/来源/可信度/重要度，**文件夹路径永远不动**（防止外部编辑顺手把条目挪走）；如果是文档型记忆节点且写回的不是合法 JSON，直接忽略；普通记忆节点写回非 JSON 文本则按纯文本存。

增删改：`createDocument` 在空间或文件夹下建文件夹（调 `repo.createFolder`）或新建空记忆（来源标记为 `documents_provider`）；`deleteDocument` 删记忆条目，或按 uuid 批量删整个文件夹子树；`renameDocument` 改记忆标题、改文件夹名（含冲突检查）、改记忆空间名；`moveDocument` 移动记忆（改 folderPath）或移动文件夹（改路径前缀），**禁止跨空间移动**，禁止把文件夹移进自己里面。

**OperitDataDocumentsProvider（应用私有数据目录）**：把 `applicationInfo.dataDir`（App 私有数据根目录）整个暴露出去，文档 ID 就是相对路径（根是 `/`）。它是三个里面防护最严的：所有路径都过 `ensureInsideDataRoot` 做 canonical 路径校验，越界直接抛 `SecurityException`；`moveDocument` 还会校验"源父目录确实包含源文档"。值得注意的是它跑在独立的 `:repair` 进程里（Manifest 声明），删目录用递归删除。根目录的显示名用包名。

**WorkspaceDocumentsProvider（workspace 工作目录）**：把 `filesDir/workspace` 暴露出去（不存在就自动建）。文档 ID 也是相对路径。它的防护比上面那个松：`getFileForDocId` 只是简单拼接路径，`isChildDocument` 用 `startsWith` 做前缀判断——这两个地方是本页代码走查的高危项。

## 关键符号

| 符号 | 说明 |
|---|---|
| `ToolPkgDesktopGlanceWidget` | 工具包小组件的 Glance 实现，`provideGlance` 是渲染入口 |
| `ToolPkgDesktopWidgetHost` | 小组件配置的存取（SharedPreferences）与刷新，单例 object |
| `ToolPkgDesktopWidgetHost.WidgetSelection` | 一次选择的快照：选择键 + `ToolPkgDesktopWidget` |
| `ToolPkgDesktopWidgetConfigActivity` | 添加小组件时弹出的界面选择页 |
| `loadToolPkgDesktopWidgetRenderData` | 用 JS 引擎执行工具包 DSL 脚本得到渲染树 |
| `RenderToolPkgDesktopWidgetDsl` | 把 DSL 节点树翻译成 Glance 组件的 Composable |
| `ToolPkgDesktopWidgetRenderData` | 渲染结果：`renderRouteId` / `renderResult` / `errorMessage` |
| `VoiceAssistantGlanceWidget` | 语音助手快捷小组件，一点进全屏语音 |
| `VoiceAssistantWidgetReceiver` / `ToolPkgDesktopWidgetReceiver` | 两个小组件的系统挂载 Receiver |
| `MemoryDocumentsProvider` | 记忆库的 DocumentsProvider：空间→文件夹→记忆条目的虚拟文件树 |
| `MemoryDocumentsProvider.DocRef` | 文档 ID 的密封类：`Root` / `Profile` / `Directory` / `Memory` |
| `OperitDataDocumentsProvider` | 应用私有数据目录的 DocumentsProvider，带路径越界防护 |
| `WorkspaceDocumentsProvider` | `filesDir/workspace` 的 DocumentsProvider |

## 输入→处理→输出调用链

**链路一：用户在桌面添加工具包小组件**

1. 输入：用户在桌面"添加小组件"选中 Operit 工具包小组件，系统按 `toolpkg_desktop_widget_info.xml` 的 `android:configure` 启动 `ToolPkgDesktopWidgetConfigActivity`，Intent 里带 `EXTRA_APPWIDGET_ID`。
2. 处理：配置页在 IO 线程调 `ToolPkgDesktopWidgetHost.listAvailableWidgets` 列出所有工具包声明的小组件界面；用户点选某一张卡片 → `saveSelection` 把 10 个字段 `commit()` 写进 SharedPreferences → `setResult(RESULT_OK)` 结束 → `onStop` 里延迟 300ms 调 `refreshAll`。
3. 输出：`ToolPkgDesktopGlanceWidget().updateAll` 触发系统回调 `provideGlance`，小组件显示所选界面的渲染结果。

**链路二：小组件一次渲染**

1. 输入：系统请求刷新，`provideGlance(context, id)` 被调用。
2. 处理：`GlanceAppWidgetManager.getAppWidgetId` 换算系统 ID → `resolveSelection` 读配置 → `loadToolPkgDesktopWidgetRenderData` 按"容器包名 + renderRouteId"找到 UI 路由 → 取 DSL 脚本 → `acquireToolPkgExecutionEngine` 拿 JS 引擎 → 执行脚本得初始树 → 有 `onLoad` 就再执行一次得最终树 → `finally` 释放引擎。
3. 输出：`provideContent { ToolPkgDesktopWidgetContent(...) }`，有渲染树就走 `RenderToolPkgDesktopWidgetDsl` 画 DSL 界面，否则显示标题/副标题/错误信息；整个小组件可点击，点后按 `routeId` 打开 `MainActivity` 对应页面。

**链路三：外部文件 App 打开一条记忆**

1. 输入：系统文件 App 调 `openDocument("mem:<空间ID>:<uuid>", "r")`。
2. 处理：`parseDocumentId` 解析出 `DocRef.Memory` → `getRepository` 拿到该空间的 `MemoryRepository` → `findMemoryByUuid` 查条目 → `buildMemoryJson` 序列化成 13 字段 JSON → 写缓存临时文件。
3. 输出：返回只读的 `ParcelFileDescriptor`；关闭时回调删掉临时文件。

**链路四：外部编辑器改完记忆内容**

1. 输入：外部编辑器以写模式打开记忆的 JSON，改完关闭文件。
2. 处理：`openDocument` 的关闭回调把任务丢进 `writeBackExecutor` 单线程池 → 读回临时文件文本 → `applyWrittenContentToMemory` 解析 JSON 字段（文档节点只接受合法 JSON，非 JSON 写入被忽略；普通节点非 JSON 按纯文本存）→ `repo.updateMemory`，`newFolderPath` 固定传原路径。
3. 输出：数据库里的记忆条目被更新；临时文件被删除。

**链路五：OperitData 目录的越界防护**

1. 输入：任意文档操作传入 `documentId`（如 `"/../shared_prefs"`）。
2. 处理：`getFileForDocId` → `ensureInsideDataRoot` 对 canonical 路径做"相等或以父路径+分隔符开头"的校验。
3. 输出：越界直接抛 `SecurityException`，请求被拒绝。

## 来源

- `app/src/main/java/com/ai/assistance/operit/widget/`（7 个 kt，共 1164 行）：`ToolPkgDesktopGlanceWidget.kt`（176）、`ToolPkgDesktopWidgetConfigActivity.kt`（230）、`ToolPkgDesktopWidgetDslRenderer.kt`（423）、`ToolPkgDesktopWidgetHost.kt`（177）、`ToolPkgDesktopWidgetReceiver.kt`（20）、`VoiceAssistantGlanceWidget.kt`（122）、`VoiceAssistantWidgetReceiver.kt`（16）
- `app/src/main/java/com/ai/assistance/operit/provider/`（3 个 kt，共 1813 行）：`MemoryDocumentsProvider.kt`（1199）、`OperitDataDocumentsProvider.kt`（320）、`WorkspaceDocumentsProvider.kt`（294）
- `app/src/main/AndroidManifest.xml`：三个 Provider 声明（authority/exported/MANAGE_DOCUMENTS，`OperitDataDocumentsProvider` 跑在 `:repair` 进程）、两个小组件 Receiver 与配置 Activity 声明
- `app/src/main/res/xml/toolpkg_desktop_widget_info.xml`、`voice_assistant_widget_info.xml`：小组件尺寸/刷新/分类/配置页声明
