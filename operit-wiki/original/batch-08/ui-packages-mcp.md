---
title: MCP 配置与部署界面
module: 设置 / 扩展包（packages）
sources: 13
date: 2026-10-01
issue: 104
---

# ui-packages-mcp（MCP 配置与部署界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/` 下 13 个 Kotlin 文件（2 个屏幕 + 6 个详情对话框组件 + 5 个部署对话框/ViewModel，共 5,097 行）@ `dbf71916`

## 概述

这是 Operit 设置页里的**扩展包管理界面**，管两样东西：

1. **MCP 服务**（`MCPConfigScreen`，2090 行，最大文件）——列出已配置的本地 MCP 插件和远程 MCP 服务：开关启用/禁用、查看详情、编辑 JSON 配置、从仓库/压缩包/远程地址/配置粘贴四种方式导入新插件，以及把本地插件**部署**成可发布的包（分析部署命令 → 自定义命令 → 执行部署看日志 → 配环境变量）。
2. **技能**（`SkillConfigScreen`，1140 行）——管理技能包：从仓库/压缩包/直接输入三种方式导入、长按拖拽排序、按开关控制技能对 AI 是否可见、查看 SKILL.md 与目录结构、删除技能。

两页共享 `ui/features/packages` 包，业务逻辑下沉到 `MCPViewModel`（导入/远程服务/描述生成）、`MCPDeployViewModel`（部署流程）、`MCPLocalServer`（本地插件运行时状态）与 `MCPRepository`（持久化仓库）。设计上“屏幕只管聚合状态、ViewModel 管动作、对话框管输入”。

## AI 速览

- **核心符号**：`MCPConfigScreen`（MCP 屏入口）、`SkillConfigScreen`（技能屏入口）、`MCPViewModel`（导入/远程服务）、`MCPDeployViewModel`（部署流程 5 个 StateFlow）、`MCPLocalServer`（本地服务单例）、`MCPRepository`（仓库）、`PluginListItem`/`SkillListItem`（列表行）、`MCPServerDetailsDialog`（详情/配置双 Tab 对话框）、`MCPDeployConfirmDialog`/`MCPCommandsEditDialog`/`MCPDeployProgressDialog`/`MCPEnvironmentVariablesDialog`（部署四件套）。
- **主入口**：`MCPConfigScreen(onNavigateToMCPMarket, searchQuery)`；`SkillConfigScreen(skillRepository, snackbarHostState, onNavigateToSkillMarket, searchQuery, skillOrder, onSaveSkillOrder)`。
- **数据流向一句话**：屏幕 `collectAsState` 收集 `MCPLocalServer.mcpConfig`/`serverStatus` 与各 ViewModel 的 StateFlow 渲染列表；用户操作（开关/导入/部署/删除）经 `scope.launch` 调用 `MCPLocalServer`/`MCPRepository`/ViewModel 落盘或执行，结果再经 StateFlow 回流刷新 UI。

## 核心机制

### 1. MCP 屏：状态聚合与初始化

`MCPConfigScreen` 用两个 Factory 创建 ViewModel：`MCPViewModel.Factory(mcpRepository, context)` 与 `MCPDeployViewModel.Factory(context, mcpRepository)`。它聚合的状态来源很多：`mcpLocalServer.serverStatus`（每插件运行状态）、`viewModel.installProgress/installResult/currentServer`（安装进度）、`mcpLocalServer.mcpConfig`（配置快照）、`deployViewModel` 的四个 StateFlow（部署状态/输出/当前插件/环境变量）。

初始化走 `LaunchedEffect(Unit)`：调 `refreshMcpScreen()`（同步桥接状态 + 刷新插件列表 + 清空锁定的排序），并记录各插件启用状态。导入新插件后用 `awaitPluginVisible` 以 `withTimeoutOrNull(20_000)` 等配置里出现目标 pluginId 再结束 loading——避免“装完了列表还没刷出来”的竞态。

### 2. 排序、搜索与工具名拉取

插件列表排序 `computedSortedPluginIds`：启用且拉到工具的排最前，其次启用的，再次其他的，最后按显示名；工具加载完成后用 `lockedPluginOrder` **冻结顺序**，防止状态变化导致列表跳动。搜索 `mcpPluginMatchesSearch` 检索 id、名称、描述、作者、版本、repoUrl、type、endpoint 与工具名。

工具名拉取分三路：远程插件走 `mcpRepository.getRemoteToolNames`；本地插件先看运行时目录是否就绪（`isPluginRuntimeReady` 为 false 直接跳过）；桥接工具只在存在本地插件时才调 `MCPBridge.listMcpServices()`。拉取结果按服务分组、`distinct` 去重。列表顶部状态卡片用圆点表示整体健康度（无启用插件灰/全部成功绿/部分成功橙/否则红），并显示“成功请求数/启用插件数”。

全屏加载遮罩有个硬上限：`delay(2_000)` 后强制关闭，防止某个拉取 hang 住把界面卡死。

### 3. 导入：MCP 四 Tab，技能三 Tab

MCP 导入对话框（标题 `import_or_connect_mcp_service`）四个 Tab：

- **仓库导入**：repo 链接输入框 + 跳转市场的“获取”按钮；
- **压缩包导入**：只读 zip 路径框 + 文件夹按钮打开系统选择器（`ACTION_GET_CONTENT` + `application/zip`，用 `DISPLAY_NAME` 取文件名，`setSelectedZipUri` 保存 uri）；
- **远程服务**：连接类型下拉（`httpStream`/`sse`）、Bearer Token 输入框、`RemoteHeadersEditor` 自定义请求头（每行可删、底部追加空行，`EditableHeader` 默认 id 为随机 UUID）；
- **配置粘贴**：粘贴 JSON 调 `mcpLocalServer.mergeConfigFromJson` 合并，成功 Toast 显示合并的服务器数量；也能 `ACTION_VIEW` 直接打开配置文件。

导入时 `proposedId = 插件名.replace(" ", "_").lowercase()`，与可见插件 id 冲突则 Toast 提示已存在；新插件默认 `version="1.0.0"`，远程 `type="remote"`、本地 `type="local"`。远程走 `viewModel.addRemoteServer`，仓库导入走 `installServerWithObject`，压缩包走 `installServerFromZip`。

技能导入三个 Tab：仓库（`importSkillFromGitHubRepo`）、压缩包（`zipPicker.launch("application/zip")` 选择，先复制到 `cacheDir` 临时文件，`finally` 里删除；只认 `.zip` 后缀）、直接输入（技能 ID/描述/内容三输入框 + 多附件选择，`SKILL_ID_PATTERN` 校验且排除 `"."`/`".."`，走 `importSkillFromDirectInput`）。导入中 `onDismissRequest` 被 `isImporting` 门控，点不掉对话框。

### 4. 部署四件套：确认 → 自定义命令 → 进度 → 环境变量

列表项的“部署”按钮设置 `pluginToDeploy`，弹出 `MCPDeployConfirmDialog`（取消/自定义命令/直接部署三按钮）。点自定义命令：若 `generatedCommands` 为空先 `getDeployCommands`，再进 `MCPCommandsEditDialog`（初始文本为命令列表按 `\n` 连接，确认时按行拆分、trim、过滤空行）。确认后调 `deployPluginWithCommands(pluginId, customCommands)`。

`MCPDeployViewModel` 持有 5 个 StateFlow：部署状态、当前插件、输出消息、生成命令、环境变量。`getDeployCommands` 对 `virtual://` 路径直接返回空命令；`deployPlugin` 对 npx/uvx 虚拟路径直接用空命令部署，命令为空则先获取再部署。`deployPluginWithCommands` 先清空输出、设置当前插件，再调 `MCPDeployer.deployPlugin`，状态回调里把带输出前缀的 `InProgress` 消息追加到 `outputMessages`（输出前缀兼容新旧两种字符串 key），其余状态更新 `_deploymentStatus`。`resetDeploymentState` 刻意**不**重置环境变量，注释写明供多次部署复用。

`MCPDeployProgressDialog`：进行中时禁用返回键和点击外部关闭；`LaunchedEffect(outputMessages.size)` 自动滚动到最后一行；日志区最大 180dp 并显示行数；失败显示重试按钮。标题栏可打开 `MCPEnvironmentVariablesDialog`（`mutableStateListOf` 管理，删除按 `Pair(key, value)` 精确移除，新增要求 key 非空，确认时 `associate` 转回 Map）。

### 5. 插件详情对话框：详情/配置双 Tab

`MCPServerDetailsDialog` 共 9 个参数。`supportsLocalConfigEditing = server.type != "remote"`——远程服务没有配置 Tab。对话框宽 95%、高 70%（钳制在 400dp 到屏幕 70% 之间），仅“已安装且支持本地编辑”时显示详情/配置两个 Tab；`localPluginConfig` 每次变化经 `LaunchedEffect` 回调 `onUpdateConfig` 同步给父屏，保存按钮调 `mcpLocalServer.savePluginConfig`。

底部 `MCPServerDetailsActions`：有 `repoUrl` 显示仓库按钮（`ACTION_VIEW` 打开，失败记 `AppLogger.e`）；已安装显示红色卸载按钮，否则显示安装按钮。配置 Tab 显示安装路径面板 + 占满剩余高度的 JSON 编辑框 + 生效提示条 + 右对齐保存按钮。

### 6. 技能屏：排序、可见性与详情

技能列表支持长按拖拽排序（手柄 `longPressDraggableHandle`，拖拽项带弹簧动画），排完调 `onSaveSkillOrder`；外部传入 `skillOrder` 非空且无搜索词时按外部顺序排。点击技能在 IO 线程构建详情数据，并以 `absolutePath` 校验防止列表刷新导致串位。有加载错误的技能显示红色悬浮按钮，点开按技能名排序展示错误文本。

`SkillListItem` 的开关绑定 `SkillVisibilityPreferences.isSkillVisibleToAi`，控制技能对 AI 是否可见。详情对话框分小节展示描述、目录路径、入口文件、文件数量；目录预览 `walk` 统计、上限 18 行、超出计入 `hiddenEntryCount`；支持展开查看 SKILL.md（`MarkdownTextComposable`，带开关）。删除按钮直接调 `skillRepository.deleteSkill`，成功后刷新并 Snackbar 提示。

## 关键符号

| 符号 | 位置 | 作用 |
|---|---|---|
| `MCPConfigScreen` | `screens/MCPConfigScreen.kt` | MCP 管理屏 @Composable 入口 |
| `SkillConfigScreen` | `screens/SkillConfigScreen.kt` | 技能管理屏 @Composable 入口 |
| `MCPViewModel` | `ui/features/packages/viewmodel`（外部） | 导入/远程服务/描述生成 |
| `MCPDeployViewModel` | `screens/mcp/viewmodel/MCPDeployViewModel.kt` | 部署流程：5 个 StateFlow + 命令获取/执行 |
| `MCPLocalServer` | 外部单例 | 本地插件运行状态、配置读写、安装 |
| `MCPRepository` | 外部 | 插件元数据持久化、远程工具名 |
| `PluginListItem` | `screens/MCPConfigScreen.kt` | MCP 列表行：状态灯/开关/徽标/工具 chips/部署按钮 |
| `SkillListItem` | `screens/SkillConfigScreen.kt` | 技能列表行：拖拽手柄/可见性开关 |
| `MCPServerDetailsDialog` | `components/dialogs/MCPServerDetailsDialog.kt` | 详情/配置双 Tab 对话框 |
| `MCPDeployConfirmDialog` | `screens/mcp/components/MCPDeployConfirmDialog.kt` | 部署确认：取消/自定义/直接部署 |
| `MCPCommandsEditDialog` | `screens/mcp/components/MCPCommandsEditDialog.kt` | 部署命令文本编辑 |
| `MCPDeployProgressDialog` | `screens/mcp/components/MCPDeployProgressDialog.kt` | 部署日志进度 + 重试 |
| `MCPEnvironmentVariablesDialog` | `screens/mcp/components/MCPEnvironmentVariablesDialog.kt` | 部署环境变量增删改 |
| `computedSortedPluginIds` | `screens/MCPConfigScreen.kt` | 插件排序（启用+有工具优先） |
| `awaitPluginVisible` | `screens/MCPConfigScreen.kt` | 20 秒超时等待插件出现在配置中 |
| `parseMCPServiceToolNames` | `screens/MCPConfigScreen.kt` | 工具名按服务分组解析 |
| `toHeaderMap` | `screens/MCPConfigScreen.kt` | 自定义请求头列表转 Map |

## 输入 → 处理 → 输出调用链

1. **打开 MCP 页**：`MCPConfigScreen` → `LaunchedEffect(Unit)` → `refreshMcpScreen()`（`syncBridgeStatus` + `refreshPluginList`）→ 收集 `mcpConfig`/`serverStatus`/`installProgress` 等 StateFlow → 渲染 `PluginListItem` 列表。
2. **导入压缩包插件**：导入对话框压缩包 Tab → 文件夹按钮 → `ACTION_GET_CONTENT` 选择器 → `DISPLAY_NAME` 取文件名 + `setSelectedZipUri` → 确认 → `installServerFromZip` → `awaitPluginVisible(importId)`（20 秒超时）→ 列表刷新。
3. **部署本地插件**：列表项部署按钮 → `pluginToDeploy` → `MCPDeployConfirmDialog`（直接部署或自定义命令）→ `deployPlugin`/`deployPluginWithCommands` → `MCPDeployer.deployPlugin`（`statusCallback` 分流输出与状态）→ `MCPDeployProgressDialog` 显示日志 → 成功 Toast。
4. **导入技能**：技能屏加号 → 导入对话框三 Tab（仓库/`importSkillFromGitHubRepo`，压缩包/cacheDir 临时文件，`importSkillFromDirectInput`）→ `refreshSkills()` → 列表刷新。
5. **拖拽排序技能**：长按手柄拖拽 → `onMove` 更新列表 → `onSaveSkillOrder(newOrder)` 回调给外部持久化。

## 来源

- 原子事实：`review/batch-08/ui-packages-mcp.facts.json`（138 条，每条带 `文件:行号` 引用，行号±5 行可验证）。
- 代码走查：`review/batch-08/ui-packages-mcp.quality.json`（10 条：高危 1、警告 5、建议 4，均带源码证据）。
- 种子范围：13 个 Kotlin 文件、共 5,097 行，`MCPConfigScreen.kt`（2,090 行）与 `SkillConfigScreen.kt`（1,140 行）已逐行读完，未跳读。
- 源码版本：Operit @ `dbf71916`（已用 `git rev-parse` 验证）。
