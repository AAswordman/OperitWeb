---
title: MCP 服务与插件桥接
module: 数据层 / app
sources: 17
date: 2026-10-01
---

## 概述

`data/mcp/` 是 Operit 的 MCP（Model Context Protocol，模型上下文协议）配置与插件桥接中心：共 14 个种子文件，约 7000 行。四个角色分工明确：`MCPLocalServer` 管配置（`mcp_config.json` 与 `server_status.json` 分开存）、`MCPRepository` 管插件的安装卸载与仓库对接、`McpConfigImportParser` 管标准配置导入、11 个 `plugins/` 文件管运行时的双通道（本地走 Node bridge 的 TCP，远程走 Kotlin MCP SDK 直连）。

从用户视角看：插件装在 `~/mcp_plugins`，启用后工具以 `"$pluginId:$toolName"` 的名字注册进 AI 运行时，AI 就可以直接调用 `filesystem__read_file` 这样的工具。从开发者视角看：整个子系统是"配置→部署→注册→会话"四段式流水线，本地插件要先部署到终端再经 bridge 启动，远程插件只记元数据不建进程。

相关页面：[[core-tools-registry|工具注册中心（总览）]]。

## AI 速览

**核心符号清单**

- `MCPLocalServer` —— MCP 配置统一管理中心，私有构造单例 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:47`
- `MCPConfig` —— 配置顶层：mcpServers + pluginMetadata `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:116`
- `ServerConfig` —— 单服务器配置：command/args/disabled/autoApprove/env `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:123`
- `PluginMetadata` —— 插件元数据：id/name/type/connectionType/bearerToken 等 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:141`
- `ServerStatus` —— 运行时状态：起停时间戳/错误/工具缓存 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:191`
- `CachedToolInfo` —— 缓存的工具：name/description/inputSchema/cachedAt `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:210`
- `MCPRepository` —— 插件仓库：UI 状态/安装/卸载/远程管理 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:50`
- `McpConfigImportParser` —— 标准 MCP 配置导入解析器 `app/src/main/java/com/ai/assistance/operit/data/mcp/McpConfigImportParser.kt:42`
- `MCPBridge` —— 与 Node 桥接器的 TCP 通信单例 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridge.kt:43`
- `MCPBridgeClient` —— 单服务的桥接器命令构造器与连接器 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridgeClient.kt:17`
- `MCPStarter` —— 插件启动编排器（桥接器初始化/部署/注册） `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:29`
- `MCPDeployer` —— 插件部署流水线（分析/生成/终端执行） `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:25`
- `MCPProjectAnalyzer` —— 项目结构分析：类型判定/入口查找/配置示例 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPProjectAnalyzer.kt:12`
- `MCPCommandGenerator` —— 部署与启动命令生成 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPCommandGenerator.kt:11`
- `MCPConfigGenerator` —— 插件配置文件生成 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPConfigGenerator.kt:14`
- `BridgeMcpRuntimeSession` —— 本地运行时会话（经 Node bridge） `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/BridgeMcpRuntimeSession.kt:11`
- `RemoteMcpRuntimeSession` —— 远程运行时会话（Kotlin MCP SDK 直连） `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/RemoteMcpRuntimeSession.kt:29`
- `MCPSharedSession` —— 共享终端会话单例 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPSharedSession.kt:15`
- `McpRuntimeDescriptor` —— 运行时描述：Local 或 Remote `app/src/main/java/com/ai/assistance/operit/core/tools/mcp/McpRuntimeSession.kt:7`
- `McpRuntimeSession` —— 传输无关的会话接口：connect/listTools/callTool/close `app/src/main/java/com/ai/assistance/operit/core/tools/mcp/McpRuntimeSession.kt:38`

**主入口**：配置从 `MCPLocalServer.getInstance(context)` 进，插件安装从 `MCPRepository` 的三个 `installMCPServer*` 进，启动从 `MCPStarter.startPlugin` 进，工具调用从 `McpRuntimeSession.callTool` 进。

**数据流向一句话**：配置 JSON 落盘为两份文件（配置与状态分离），安装把仓库解压到 `~/mcp_plugins`，启动时部署/注册/建会话，工具以 `"$pluginId:$toolName"` 注册到 AI 运行时，调用经 bridge TCP 或 Kotlin MCP SDK 分流。

## 核心机制

### 配置中心：配置与状态分离存储

- `MCPLocalServer` 是私有构造的单例 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:47`
- 配置目录来自 `OperitPaths.mcpPluginsDir()` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:75`
- `mcp_config.json` 存配置（`MCPConfig`） `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:116`
- `server_status.json` 存运行状态（`ServerStatus`），两者分离 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:191`
- `MCPConfig` 含 `mcpServers` 与 `pluginMetadata` 两个可变 map `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:116`
- `ServerConfig` 的 `command` 是必填字段（无默认值） `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:125`
- `sanitizeServerConfig` 丢弃 `command` 为空的服务器配置 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:370`
- `autoFillMissingMetadata` 为 `mcpServers` 中缺元数据的服务器自动建默认元数据 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:291`
- 自动元数据 `isInstalled=true`、`type="local"` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:307`
- `ServerStatus` 记录 `lastStartTime`、`lastStopTime`、`errorMessage`、工具缓存与缓存时间 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:195`
- `resetRuntimeState` 注销 `"$serverId:"` 前缀工具、注销服务器、删除状态 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:398`
- 工具缓存有效期为 1 天（24*60*60*1000L） `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:823`
- `isServerLikelyRunning` 用起停时间戳推断运行态 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:855`
- 启用状态：本地读 `ServerConfig.disabled`，远程读 `metadata.disabled` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:864`
- 导出带 `exportTime` 与 `version` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:1074`
- 导入支持完整 MCPConfig 或单个 ServerConfig `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:1083`

### 标准配置导入：stdio 看 command，远程看 type

- `McpConfigImportParser.parse` 是公开解析入口，根节点必须是对象 `app/src/main/java/com/ai/assistance/operit/data/mcp/McpConfigImportParser.kt:42`
- 分支依据是服务器配置是否含 `"command"`：有则走 stdio，否则走远程 `app/src/main/java/com/ai/assistance/operit/data/mcp/McpConfigImportParser.kt:66`
- `declaredType` 为空或等于 `STDIO_TYPE` 时才视为 stdio 服务器，否则抛错 `app/src/main/java/com/ai/assistance/operit/data/mcp/McpConfigImportParser.kt:78`
- `"streamable_http"` 映射为内部连接类型 `"httpStream"`，`"sse"` 保持不变 `app/src/main/java/com/ai/assistance/operit/data/mcp/McpConfigImportParser.kt:98`
- 声明 `type=stdio` 却缺 `command` 时抛 `IllegalArgumentException` `app/src/main/java/com/ai/assistance/operit/data/mcp/McpConfigImportParser.kt:100`
- 导入时 stdio 服务器写入 `mcpServers` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:623`
- 导入时远程服务器从 `newServers` 移除、元数据写入 `newMetadata` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:660`
- 导入远程配置时 `bearerToken` 被置为 null `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPLocalServer.kt:359`

### 插件仓库：安装、远程与注册

- `MCPRepository` 统一管理插件的 UI 状态、安装与卸载 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:50`
- 插件目录优先 `Download/Operit/mcp_plugins`，不可写时回退应用私有目录 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:77`
- `npx`、`uvx`、`uv` 类插件不需要物理安装，用 `"virtual://$serverId"` 虚拟路径标记 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:213`
- 三个安装入口：按 id、按元数据对象、从本地 ZIP `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:296`
- GitHub 仓库安装：查默认分支 API，再下 `archive/refs/heads/<branch>.zip` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:565`
- 下载连接超时 10 秒，读取超时 15 秒 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:56`
- 解压跳过 `__MACOSX` 与 `.DS_Store` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:706`
- 有效插件目录至少含 `mcp.config.json`、`README.md`、`package.json`、`index.js` 等之一 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:817`
- `addRemoteServer` 只写元数据，不创建本地进程 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:856`
- 远程插件发现到工具且未禁用时触发 `registerToolsForPlugin` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1116`
- 注册的工具名带 `"$pluginId:"` 前缀，已注册过的跳过（幂等） `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1238`
- 本地运行时 endpoint 形如 `"mcp://plugin/<serviceName>"` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1216`
- local 类型生成 `McpRuntimeDescriptor.Local` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1348`
- remote 类型生成 `McpRuntimeDescriptor.Remote` `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1350`
- 其他类型抛错 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1360`
- AI 工具描述为空时用 `EnhancedAIService` 自动生成 `app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:1050`

### 运行时双通道：bridge TCP 与 Kotlin MCP SDK

- `MCPBridge` 是私有构造单例，桥接器端口 8752，SSH 转发端口 8751 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridge.kt:43`
- 端口探测优先 8752 失败用 8751，结果缓存 3500 毫秒 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridge.kt:111`
- `startBridge` 在终端以后台方式启动桥接器 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridge.kt:298`
- 启动后等待 2 秒，再用 `listMcpServices` 最多验证 3 次 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridge.kt:395`
- cmdType 为 `spawn` 时走独立 TCP 连接（soTimeout 180 秒），其余命令复用 3500 毫秒保活连接 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridge.kt:518`
- `MCPBridgeClient` 负责单服务的命令构造（register/spawn/listtools/toolcall/logs/reset 等） `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridgeClient.kt:17`
- `ping` 探测服务状态 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridgeClient.kt:280`
- 只有 `active` 与 `ready` 同时为真才算连通 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridgeClient.kt:290`
- `callTool` 未连接时先自动连接，遇到连接类错误标记断开、重连重试一次 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPBridgeClient.kt:377`
- `BridgeMcpRuntimeSession` 是本地会话实现，背后走 Node bridge `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/BridgeMcpRuntimeSession.kt:11`
- `RemoteMcpRuntimeSession` 用 Kotlin MCP SDK + Ktor 直连，连接超时 15 秒、请求 60 秒 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/RemoteMcpRuntimeSession.kt:29`
- 远程支持 `httpStream`（Streamable HTTP）与 `sse` 两种传输 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/RemoteMcpRuntimeSession.kt:58`
- 远程会话用 `nextCursor` 分页拉全工具列表 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/RemoteMcpRuntimeSession.kt:99`
- 远程鉴权：`bearerToken` 拼 `Authorization: Bearer` 头，自定义 headers 先 remove 再 append `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/RemoteMcpRuntimeSession.kt:149`
- Node 桥接器（`assets/bridge/index.js`）默认绑定 `127.0.0.1`，请求超时 180 秒，闲置 5 分钟回收，单服务最多重启 5 次 `app/src/main/assets/bridge/index.js:196`
- 会话工厂按描述符创建会话：Local 走 `BridgeMcpRuntimeSession`，Remote 走 `RemoteMcpRuntimeSession` `app/src/main/java/com/ai/assistance/operit/core/tools/mcp/MCPToolExecutor.kt:546`

### 启动编排：初始化、分批、自动部署

- `MCPStarter` 协调本地 bridge 插件与远程插件的启动 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:29`
- `initBridge` 先检查桥接器是否在运行，否则检查终端与 pnpm，再部署启动 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:99`
- 未启用的插件拒绝启动并回调 `"Plugin not enabled by user"` `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:253`
- 本地插件运行目录未就绪时自动走 `MCPDeployer` 部署 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:199`
- 本地插件经 `bridge.registerMcpService` 用 command/args/env/cwd 注册 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:340`
- `startAllDeployedPlugins` 把插件按启用/禁用分区，批量启动用 `Semaphore(4)` 限并发 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:370`
- 禁用插件的工具在批量启动时被反注册 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:388`
- 启动成功后缓存工具列表，空描述插件用 `EnhancedAIService.generatePackageDescription` 补描述 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:745`
- `verifyAllMcpPlugins` 逐个检查已启用插件是否响应 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPStarter.kt:802`

### 部署流水线：分析→命令→配置→终端执行

- `MCPDeployer` 协调项目分析、命令生成与配置生成完成部署 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:25`
- MCPProjectAnalyzer 判定项目类型：TypeScript 优先于 Node 高于 Python `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPProjectAnalyzer.kt:127`
- 分析器从 README 代码块提取 `mcpServers` 配置示例并校验可信度 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPProjectAnalyzer.kt:428`
- JS 系配置示例不含 `"@"` 时被过滤，Python 示例含 `path/to` 占位符被一票否决 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPProjectAnalyzer.kt:457`
- MCPCommandGenerator：Python 先建 venv 再 pip 装，TS/Node 换淘宝镜像用 pnpm 装 `--ignore-scripts` `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPCommandGenerator.kt:32`
- `pnpm run xxx` 脚本被转为 `##PNPM_RUN_SCRIPT:name##` 标记再执行 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPCommandGenerator.kt:245`
- MCPConfigGenerator：Python 用 `"$pluginDirPath/venv/bin/python -m <模块>"`，TypeScript 用 node + 编译产物 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPConfigGenerator.kt:97`
- 部署为每个插件建独立 `"deploy-<短名>"` 终端会话 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:265`
- 用 `copy_file` 工具做 Android 到 Linux 递归复制 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:316`
- 部署跳过启动类命令（`python -m`、`node`、`npm start`、`#` 注释） `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:347`
- 有市场配置（marketConfig）时部署优先使用它 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:163`
- 部署输出按 3500 字符分块流式回调，结束无论成败都延迟关闭会话 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPDeployer.kt:50`

### 共享终端会话

- `MCPSharedSession` 是 object 单例，会话名 `"mcp-shared"` `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPSharedSession.kt:15`
- 内部用 `Mutex` 实现双重检查锁 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPSharedSession.kt:22`
- `clearSession` 只清除引用，不会实际关闭会话 `app/src/main/java/com/ai/assistance/operit/data/mcp/plugins/MCPSharedSession.kt:69`

## 关键符号（英文原名）

| 符号 | 一句话 |
|---|---|
| `MCPLocalServer` | MCP 配置统一管理中心，私有构造单例 |
| `MCPConfig` | 配置顶层结构：`mcpServers` + `pluginMetadata` |
| `ServerConfig` | 单服务器配置，`command` 必填 |
| `PluginMetadata` | 插件元数据，含 type/connectionType/bearerToken |
| `ServerStatus` | 服务器运行时状态与工具缓存 |
| `CachedToolInfo` | 缓存的单个工具信息 |
| `MCPRepository` | 插件仓库：安装/卸载/远程管理/UI 状态 |
| `McpConfigImportParser` | 标准 MCP 配置导入解析器 |
| `MCPBridge` | Node 桥接器 TCP 通信单例（端口 8752） |
| `MCPBridgeClient` | 单服务的命令构造器与连接器 |
| `MCPStarter` | 插件启动编排器 |
| `MCPDeployer` | 插件部署流水线 |
| `MCPProjectAnalyzer` | 项目结构分析器 |
| `MCPCommandGenerator` | 部署与启动命令生成器 |
| `MCPConfigGenerator` | 插件配置文件生成器 |
| `BridgeMcpRuntimeSession` | 本地运行时会话（经 Node bridge） |
| `RemoteMcpRuntimeSession` | 远程运行时会话（Kotlin MCP SDK） |
| `MCPSharedSession` | 共享终端会话单例 |
| `McpRuntimeDescriptor` | 运行时描述（Local/Remote），`core/tools/mcp` |
| `McpRuntimeSession` | 传输无关的会话接口，`core/tools/mcp` |
| `MCPManager` | 会话工厂与服务器注册表，`core/tools/mcp` |

## 调用链（输入→处理→输出）

1. 输入：用户粘贴标准 MCP JSON 配置 → `McpConfigImportParser.parse` 按有无 `command` 分流为 stdio/远程 → 输出：stdio 写入 `mcpServers`，远程写入 `pluginMetadata`（`bearerToken` 置 null）。
2. 输入：用户点安装（pluginId/元数据对象/ZIP） → `MCPRepository.installMCPServer*` 查默认分支、下载 ZIP、解压到 `Download/Operit/mcp_plugins` → 输出：插件目录 + `type=local` 元数据；远程服务器只写元数据。
3. 输入：`MCPStarter.startPlugin` → 处理：`initBridge` 部署并启动 Node 桥接器 → 本地插件注册 `registerMcpService(command/args/env/cwd)` → 输出：`MCPManager.registerRuntime(Local)` + 工具以 `"$pluginId:$toolName"` 注册到 AI 运行时。
4. 输入：插件运行目录不存在 → 处理：`MCPProjectAnalyzer` 判定项目类型 → `MCPCommandGenerator` 生成部署命令 → `MCPDeployer` 在 `"deploy-<短名>"` 终端会话执行 → 输出：可运行的插件目录 + 存入 `MCPLocalServer` 的服务器配置。
5. 输入：AI 调用 `pluginId:toolName` → 处理：`MCPManager.getOrCreateSession` 按描述符建会话（Local 走 bridge TCP，Remote 走 Kotlin MCP SDK 直连） → 输出：`McpRuntimeCallResult(success/result/errorMessage)`。
6. 输入：远程服务地址 → 处理：`RemoteMcpRuntimeSession.connect` 按 `connectionType` 选 `StreamableHttpClientTransport` 或 `SseClientTransport`，`listTools` 用 `nextCursor` 分页 → 输出：工具列表回填并触发注册到 AI 运行时。

## 来源

- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- `data/mcp/` 全量 14 文件已全文阅读：`MCPLocalServer.kt`、`MCPRepository.kt`、`McpConfigImportParser.kt`、`plugins/` 下 11 个文件
- 相关调用方：`core/tools/mcp/McpRuntimeSession.kt`（`McpRuntimeDescriptor`/`McpRuntimeSession`）、`core/tools/mcp/MCPToolExecutor.kt` 的 `MCPManager`（会话工厂与注册）
- 运行时资产：`assets/bridge/index.js`（Node 桥接器：127.0.0.1/请求超时 180s/闲置 5 分钟回收/最多重启 5 次）
- 原子事实：`data-mcp.facts.json`（320 条），代码走查：`data-mcp.quality.json`
