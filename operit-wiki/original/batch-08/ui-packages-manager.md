---
title: 扩展包管理界面
module: 扩展包 / 管理界面
sources: 19
date: 2026-10-01
issue: 101
---

# 扩展包管理界面

## 概述

扩展包管理界面是 Operit 里集中管理"扩展包"的地方。所谓扩展包，就是给 AI 加能力的插件：一段 JS 脚本、一个 `.toolpkg` 插件容器、一个技能（Skill）、一个 MCP 服务器，都算。

这个界面干四件事：

1. **看**：四个页签分别列出插件、脚本包、技能、MCP 服务器。
2. **开关**：每行一个 Switch，打开=启用（导入），关闭=停用，立即生效。
3. **装**：右下角"+"按钮从文件导入外部包（`.toolpkg` / `.js` / `.ts` / `.hjson`）。
4. **调**：点进详情可以看工具列表、直接试运行脚本、看运行监控、配环境变量。

设计上有个关键区分：**后端真实状态**和**UI 展示状态**是两套。点开关时先乐观更新 UI，再去调后端；后端失败就回滚 UI 并弹提示。这样开关手感跟手，又不会和真实状态脱节。

## AI 速览

**核心符号**（每条符号后跟源码定位）：

- `PackageManagerScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:127`）
- `PackageTab`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageTab.kt:3`）
- `PluginTabContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PluginTabContent.kt:55`）
- `PackageTabContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageTabContent.kt:48`）
- `packageMatchesSearch`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:8`）
- `pluginMatchesSearch`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:36`）
- `addPackageToolSearchText`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:83`）
- `PackageDetailsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:43`）
- `ToolPkgRuntimeMonitorDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:831`）
- `ScriptExecutionDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/ScriptExecutionDialog.kt:40`）
- `MCPPackageDetailsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/MCPPackageDetailsDialog.kt:78`）
- `PackageEnvironmentVariablesDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:107`）
- `PackageLoadErrorsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:48`）
- `QuickPluginCreatorDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/QuickPluginCreatorDialog.kt:29`）
- `MCPInstallProgressDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MCPInstallProgressDialog.kt:40`）
- `MarketManageScaffold`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MarketManageComponents.kt:54`）
- `MarketManageReviewFlow`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MarketManageComponents.kt:242`）
- `PackagesList`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/lists/PackageLists.kt:13`）
- `PackageItem`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageItem.kt:17`）
- `MCPViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:19`）
- `MCPCategories`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/model/MCPCategories.kt:9`）
- `visibleImportedPackages`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:153`）
- `requiredEnvByPackage`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:215`）

**主入口**：`PackageManagerScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:127`），五个导航回调全部有默认空实现。

**数据流向一句话**：进入屏幕时一次性在 IO 线程拉取六组数据存进 remember 状态 → 四个页签各自渲染 → 用户操作调 PackageManager 后端接口 → 成功刷新状态，失败回滚并提示。

## 核心机制

### 1. 四页签与顶栏搜索

页签枚举是 `PackageTab`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageTab.kt:3`）。

共四个：`PLUGINS`、`PACKAGES`、`SKILLS`、`MCP`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageTab.kt:4`，自动化配置页签被注释隐藏）。

`TabRow` 的选中下标直接取 `selectedTab.ordinal`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:623`）。

搜索是"输入→防抖→过滤"三段式。`LaunchedEffect` 监听 `pluginSearchInput`，320ms 防抖后写入 `pluginSearchQuery`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:244`）。

插件过滤用 `derivedStateOf` 包一层（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:174`）。

匹配函数是 `pluginMatchesSearch`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:36`）。

包过滤先用 `addPackageToolSearchText` 把工具名拼进待搜文本（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:83`）。

再跑 `packageMatchesSearch`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:8`）。

搜索匹配做得很深：包搜索会搜到工具名、工具描述、参数名、参数类型乃至各状态下的工具；插件搜索会搜到版本号、依赖、子包、workflow 模板、工作区模板、toolbox UI 模块。

### 2. 列表组织：插件 vs 脚本包

两个页签的列表组件是分开的，因为数据模型不同。

**插件页签**的入口是 `PluginTabContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PluginTabContent.kt:55`），数据是插件容器详情表。

长按拖拽排序经 `rememberReorderableLazyListState` 实现（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PluginTabContent.kt:82`）。

排完同时写 `packageManager.updateToolPkgPluginOrder` 和 `apiPreferences.savePluginOrder` 双持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:841`）。

每条用 `produceState` 异步加载 `logo`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PluginTabContent.kt:127`）。

**脚本包页签**的入口是 `PackageTabContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageTabContent.kt:48`），数据是脚本包表。

按 `category` 分组，`categoryOrder` 把展示顺序定死为 Automatic → Experimental → Draw → Other（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageTabContent.kt:75`）。

非搜索态顶部固定 `QuickPluginCreatorEntry` 快捷创建入口（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageTabContent.kt:108`）。

两个列表都用 Switch 做启用开关，checked 态来自"是否在已启用名单里"。

### 3. 开关的乐观更新

以插件开关为例：

1. **输入**：用户拨动 Switch。
2. **处理**：先把 `visibleImportedPackages` 本地改掉，UI 立刻响应（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:790`）；再起协程在 IO 线程调启用/停用接口，成功后拿已启用名单回写两套状态。
3. **输出**：成功=状态一致；失败=`visibleImportedPackages` 回滚到后端值，并弹 snackbar 提示。

关插件时连带移除 `details.subpackages`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:797`），保证子包不残留。

### 4. 外部包导入

右下角 `FloatingActionButton` 点一下就 `packageFilePicker.launch("*/*")`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:593`）。流程是"选→验→拷→导→刷"：

1. **输入**：用户选文件。
2. **处理**：从 contentResolver 查 `_display_name` 列拿文件名（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:298`），拿不到就提示中止。

按页签校验后缀，`lowerFileName.endsWith` 判定（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:320`）。

复制到 cache 临时文件；调 `packageManager.addPackageFileFromExternalStorage(tempFile.absolutePath)`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:356`）；finally 里删临时文件。
3. **输出**：成功（消息前缀 `Successfully imported`，`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:396`）→ 全量刷新六组数据。

带市场来源 → 弹 `AlertDialog` 提示来源（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:1102`）。

失败 → 拼进 `ErrorDialog` 展示（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:1096`）。

### 5. 对话框体系

包详情入口是 `PackageDetailsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:43`）。

打开时在 IO 线程做三件事。

`resolvePackageForDisplay` 解析展示信息（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:63`）。

`getToolPkgContainerDetails` 拉容器详情（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:89`）。

`getActivePackageStateId` 拿激活态（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:130`）。

toolpkg 容器展示版本号、资源数、wasm 模块数、UI 模块数、依赖版本范围；子包开关调 `packageManager.setToolPkgSubpackageEnabled`，乐观更新+失败自愈（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:471`）；底部有运行监控、删除（仅非内置包）、关闭三个操作。

运行监控是 `ToolPkgRuntimeMonitorDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:831`）。

每秒轮询 `getToolPkgRuntimeMonitorSnapshot`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:847`），展示调用次数、耗时、内存、日志。

支持 `clearToolPkgRuntimeMonitorLogs` 清日志（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:1069`）。

脚本试运行是 `ScriptExecutionDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/ScriptExecutionDialog.kt:40`），脚本框初始为工具脚本且可直接改。

先算 `missingParams`：必填参数里 `paramValues[it].isNullOrEmpty()` 的（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/ScriptExecutionDialog.kt:239`）。

再经 `JsToolManager.getInstance` 拿解释器调 `executeScript`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/ScriptExecutionDialog.kt:265`）。

执行按钮 `enabled = !executing`，执行中转圈（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/ScriptExecutionDialog.kt:311`）。

MCP 插件详情是 `MCPPackageDetailsDialog(server, installedPath, onDismiss)`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/MCPPackageDetailsDialog.kt:78`）。

经 `loadMcpPackageTools` 拉工具：`MCPManager.getInstance(context).getOrCreateSession(serverId)`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/MCPPackageDetailsDialog.kt:691`），单个解析失败跳过。

MCP 工具试运行先做必填校验，用 `isNullOrBlank`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/MCPPackageDetailsDialog.kt:575`），校验无误后执行。

环境变量配置是 `PackageEnvironmentVariablesDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:107`），按包分组展示所需变量，必填标红"!"。

用 `stickyHeader` 分组（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:148`）。

确认后经 `EnvPreferences.getInstance(context)` 读写（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:143`），空值删除。

加载错误列表是 `PackageLoadErrorsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:48`）。

外部来源可调 `deleteExternalPackageSource` 一键删除来源文件（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:1052`）。

快捷创建是 `QuickPluginCreatorDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/QuickPluginCreatorDialog.kt:29`），两步走：先运行环境搭建，再填需求。

确认后经 `runQuickPluginCreatorSetupAndPublishResult`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:96`）。

以 `PluginCreationIntent.Fresh` 发起 AI 辅助创建（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:1156`）。

MCP 安装进度是 `MCPInstallProgressDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MCPInstallProgressDialog.kt:40`）。

未完成时 `onDismissRequest` 里直接吞掉关闭（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MCPInstallProgressDialog.kt:52`）。

成功态渲染 `InstallResult.Success`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MCPInstallProgressDialog.kt:73`）。

`AutomationPackageDetailsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/AutomationPackageDetailsDialog.kt:24`）仅提示"自动化功能已移除"，是占位框。

`AutomationFunctionExecutionDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/AutomationFunctionExecutionDialog.kt:28`）同样是占位框。

### 6. MCP 安装状态机

`MCPViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:19`）暴露三个状态流。

`installProgress: StateFlow<InstallProgress?>`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:26`）。

`installResult` 与 `currentServer` 同理（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:30`）。

`installServer` 置 `InstallProgress.Preparing` 后调仓库安装并回调更新进度（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:48`）。

从 ZIP 安装走 `installServerFromZip(server, zipFilePath)`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:86`）。

要求调用前先 `setSelectedZipUri` 存好 zip 的 Uri（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:119`）。

`uninstallServer` 同样先置 Preparing（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:124`），remote 类型走移除远端分支。

`resetInstallState` 一键清空（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:175`）。

`getInstalledPath` 带内存缓存（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:182`）。

分类常量在 `MCPCategories`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/model/MCPCategories.kt:9`）：`ALL` / `SEARCH` / `API` / `GENERATION` / `FILE` / `DATABASE` / `WEB` / `DOCUMENT` / `OTHER`。

### 7. 通用组件

`MarketManageScaffold`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MarketManageComponents.kt:54`）是市场管理页通用脚手架：渐变顶栏、搜索栏、tab 行、筛选行。

`MarketManageReviewFlow`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MarketManageComponents.kt:242`）是审核进度三段条（待审核→审核中→已完成）。

`PackagesList`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/lists/PackageLists.kt:13`）是通用包 LazyColumn（底部留 88dp）。

`AvailablePackagesList`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/lists/PackageLists.kt:44`）已标 Deprecated 保留。

`ImportedPackagesList`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/lists/PackageLists.kt:69`）同样已标 Deprecated 保留。

`PackageItem`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageItem.kt:17`）是通用包条目卡片。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `PackageManagerScreen` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:127` | 主入口，四个页签+导入+对话框调度 |
| `PackageTab` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageTab.kt:3` | 页签枚举：PLUGINS/PACKAGES/SKILLS/MCP |
| `PluginTabContent` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PluginTabContent.kt:55` | 插件列表，拖拽排序+异步 logo |
| `PackageTabContent` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageTabContent.kt:48` | 脚本包列表，按分类分组 |
| `packageMatchesSearch` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:8` | 包全文搜索匹配 |
| `pluginMatchesSearch` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageSearch.kt:36` | 插件全文搜索匹配 |
| `PackageDetailsDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:43` | 包详情对话框 |
| `ToolPkgRuntimeMonitorDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:831` | 运行监控（每秒轮询快照） |
| `ScriptExecutionDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/ScriptExecutionDialog.kt:40` | 脚本试运行（可改脚本） |
| `MCPPackageDetailsDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/MCPPackageDetailsDialog.kt:78` | MCP 插件详情+工具试运行 |
| `PackageEnvironmentVariablesDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:107` | 环境变量配置 |
| `PackageLoadErrorsDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerDialogs.kt:48` | 加载错误列表+删来源 |
| `QuickPluginCreatorDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/QuickPluginCreatorDialog.kt:29` | 快捷插件创建两步对话框 |
| `MCPInstallProgressDialog` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MCPInstallProgressDialog.kt:40` | MCP 安装/卸载进度 |
| `MarketManageScaffold` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MarketManageComponents.kt:54` | 市场管理页通用脚手架 |
| `MarketManageReviewFlow` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/MarketManageComponents.kt:242` | 审核进度三段条 |
| `PackagesList` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/lists/PackageLists.kt:13` | 通用包 LazyColumn（另两个已废弃） |
| `PackageItem` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/components/PackageItem.kt:17` | 通用包条目卡片 |
| `MCPViewModel` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/viewmodel/MCPViewModel.kt:19` | MCP 安装/卸载状态机 |
| `MCPCategories` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/model/MCPCategories.kt:9` | MCP 九分类常量 |
| `visibleImportedPackages` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:153` | UI 展示用导入态（乐观更新） |
| `requiredEnvByPackage` | `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:215` | 已启用包所需环境变量聚合 |

## 调用链

**进入页面**：主入口 → `LaunchedEffect(Unit)` 在 IO 线程拉数据（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:446`）→ 六组 remember 状态 → 按页签分发到四个内容组件。

**拨开关**：拨动 Switch → 乐观改 `visibleImportedPackages`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:790`）→ IO 线程调启用/停用接口 → 回写状态，失败回滚+提示。

**导入文件**：点右下角按钮 → 文件选择器（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:593`）→ 读文件名 → 校验后缀 → 拷到 cache。
调导入接口（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/PackageManagerScreen.kt:356`）→ 全量刷新 → 成功/来源提示/错误弹窗。

**看详情**：条目点击 → 包详情对话框（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/dialogs/PackageDetailsDialog.kt:43`）→ 并行拉展示信息/容器详情/激活态 → 渲染工具/子包/模板 → 试运行走脚本对话框或 MCP 工具执行。

## 来源

- 种子：`ui/features/packages` 下 screens（5 个）、dialogs（6 个）、components（5 个，不含 components/dialogs）、viewmodel、model、lists 共 19 个 kt 文件，约 6395 行，源码 commit `dbf71916`，已 100% 阅读。
- 原子事实：`ui-packages-manager.facts.json`（130 条，引用逐条验真）。
- 代码走查：`ui-packages-manager.quality.json`（11 条：1 高危 / 4 警告 / 6 建议），高危为外部包导入的文件名路径穿越。
