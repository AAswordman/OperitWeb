---
title: 插件包（ToolPkg）管理与解析
module: app
sources: [18]
date: 2026-10-01
---

## 概述

ToolPkg（插件包）是 Operit 的插件分发格式：一个 `.toolpkg` 压缩包里装着 `manifest.hjson` 清单、一个 JS 主脚本、若干子包、资源文件、WASM 模块和 UI 描述。

`PackageManager` 是总控，管扫描、缓存、启用/禁用、激活，以及把包里的工具和钩子注册进系统。
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:62`

`ToolPkgArchiveParser` 负责把压缩包解析成运行时结构。
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:401`

`ToolPkgManager` 管 JS 执行引擎的复用与销毁。
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManager.kt:24`

`PackageManagerToolPkgFacade` 是包管理器暴露给 UI/工作流等上层的内部门面。
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:17`

和普通 JS 工具包的区别：JS 包（`.js`）是单个脚本文件，解析只读头部 `/* METADATA */`；ToolPkg 是带清单、多子包、多资源、声明依赖关系的完整容器，包本身不直接提供 AI 工具（解析出的 `ToolPackage.tools` 为空列表），而是靠子包提供工具、靠主脚本注册钩子来扩展 App 行为。

## AI 速览

核心符号清单：

- `PackageManager` — 包管理总控：扫描 / 缓存 / 启用 / 禁用 / 激活 / 注册
- `ToolPkgArchiveParser`（在 `ToolPkgParser.kt`）— `.toolpkg` 压缩包解析器：manifest、子包、资源、WASM、UI 路由、钩子
- `ToolPkgMainRegistrationScriptParser` — 执行主脚本 `registerToolPkg()` 并解析 23 个注册桶的 JS 返回值
- `ToolPkgManager` — 容器运行时注册表 + `JsEngine` 执行引擎池（按 contextKey 复用，带租约计数）
- `ToolPkgLoadOrderResolver` — 已启用容器的依赖拓扑排序
- `PackageManagerToolPkgFacade` — 内部门面：模板导入、资源读写、主钩子执行、compose_dsl 脚本读取
- `ToolPkgApiCompatibility` — API 版本门禁：`1.0.0` 常量支持，`1.0.1` 需 Operit ≥ `1.12.1+4`
- `ToolPkgRuntimeMonitor` — 插件调用耗时/内存/日志采样（每包 120 条日志上限）
- `ToolPkgMarketOriginCodec` — 市场来源声明的 XOR 编解码与校验

主入口：`PackageManager.ensureInitialized()` 触发全量初始化；`PackageManager.usePackage(name)` 激活包并注册工具；`PackageManagerToolPkgFacade.runToolPkgMainHook(container, function, event, …)` 执行插件主脚本钩子。
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:637`
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:891`

数据流向一句话：外部目录/assets 扫描 `.toolpkg` → 签名缓存判定是否重解析 → manifest+主脚本+子包解析成 `ToolPkgContainerRuntime` → 依赖拓扑排序 → 启用后执行 `registerToolPkg()` 注册 23 类钩子 → 激活时子包工具以 `包名:工具名` 注册给 AI，主钩子经 `JsEngine` 按事件执行。

## 核心机制

### 包三态与扫描流水线

包有三态：Available（扫描到的全部包）→ Enabled（用户启用的）→ Used（当前会话已加载注册给 AI 的）（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:58`）。初始化序列是：清旧缓存 → 建外部目录 → 读插件排序 → `loadAvailablePackages()` → `initializeDefaultPackages()` → `reconcileToolPkgCaches()` → 刷新运行时状态（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:672`）。`ensureInitialized` 在主线程调用时直接返回不阻塞，因为 toolpkg 解析依赖 WebView 主线程回调（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:637`）。

扫描分两路：`scanAssetPackages`（phase=asset，内置包）与 `scanExternalPackages`（phase=external），之后合并、校验依赖关系、应用快照（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1830`）。外部包先过远程安全拒绝名单（`PluginDenylistRepository.findDeniedImport`），且拒绝名单的签名混入缓存签名——名单一变缓存即失效重扫（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1327`）。外部 toolpkg 只允许覆盖内置容器，重名报 `Duplicate package name`（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1016`）。

缓存签名：外部包 = 路径|大小|修改时间|版本|main 入口；assets 包 = APK 内 CRC|大小（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:859`）。缓存目录名为清洗后包名 + `-` + hashCode 十六进制（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:749`）。`reconcileToolPkgCaches` 只保留 assets 容器和已启用容器的缓存，其余删除（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:919`）。

### manifest 解析与注册

`parseToolPkgFromIndexedEntries` 是解析总流程：找 manifest（根 `manifest.hjson` 优先，其次根 `manifest.json`，再嵌套）→ `ToolPkgApiCompatibility.requireSupported` 做 API 版本门禁 → `toolpkg_id` 必填 → main 入口必填且必须存在于包内 → 逐子包解析 → 资源/WASM/模板/UI 路由/导航/小部件/钩子/AI Provider 逐项校验 → 产出 `ToolPackage`（category 固定 `ToolPkg`，tools 为空）+ `ToolPkgContainerRuntime`（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:402`）。

安全细节：`normalizeZipEntryPath` 拒绝任何含 `..` 的路径，是 ZipSlip 防护，非法条目在解压时直接跳过（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:1614`）。条目索引大小写不敏感、首个命中为准（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:1557`）。

注册阶段：`ToolPkgMainRegistrationScriptParser.parse` 在 JS 引擎里执行主脚本的 `registerToolPkg()`，注入 `__operit_registration_mode=true` 等参数，把 JS 返回的 23 个注册桶逐个解析为强类型结构（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMainRegistrationScriptParser.kt:12`）。UI 模块/路由缺 `runtime` 时默认 `compose_dsl`；路由 id 缺省按 `toolpkg:<容器包名>:ui:<路由id>` 生成（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgCommonPluginConstants.kt:86`）。`parseMainRegistration` 一旦失败，整个包加载失败（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:660`）。

API 版本门禁是精确匹配：声明版本必须恰好落在支持列表里（`1.0.0` 恒支持；`1.0.1` 要求 Operit ≥ `1.12.1+4`），否则抛错并列出支持版本（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgApiVersion.kt:102`）。

### 依赖、启用与执行引擎

`enablePackage` 先经 `collectRequiredToolPkgPackages` 解析 `requires`：缺包、版本不满足、自依赖都抛 `IllegalArgumentException`（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3158`）。已启用容器的加载顺序由 `ToolPkgLoadOrderResolver` 做拓扑排序：被依赖的包必须已启用、自依赖记失败、依赖的容器加载失败会级联标记、环则把环内包全部记失败（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgLoadOrder.kt:30`）。`disablePackage` 在有已启用包依赖它时直接拒绝（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3800`）。

执行引擎由 `ToolPkgManager` 按 contextKey 复用 `JsEngine`（默认 key 为 `toolpkg_main:<容器包名>`），contextKey 与容器归属不一致时抛错；另有一套带 `activeLeases` 租约计数的 acquire/release，旧的仅 key 版 release 保留给老调用方（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManager.kt:134`）。插件包注册阶段则反其道而行：每个包用全新 `JsEngine`，finally 里销毁，超时 runtime 不保留、不阻塞下一个包（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2052`）。

激活（`usePackage`）时：容器本身不能被激活；校验 required 环境变量；`advice=true` 的工具被过滤不注册；其余工具以 `包名:工具名` 注册给 AI；多 state 包按 `ConditionEvaluator` 选 state（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3220`）。

### UI、模板与监控

`runToolPkgMainHook` 是执行插件主脚本函数的统一入口：组装 `event`/`eventPayload`/`toolPkgId` 等参数，拿到执行引擎后调 `executeScriptFunction`，全程 `runCatching` 包裹；只有 `toolpkg_message_processing` 事件记录分段耗时（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:891`）。

模板导入：工作流模板要求容器已启用、资源为文件，导入时生成新 UUID 并清空执行统计后经 `WorkflowRepository` 落库（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:405`）；工作空间模板要求目标目录为空或新建，导入后必须含 `.operit/config.json`（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:484`）。

`ToolPkgRuntimeMonitor` 记录每个包的调用次数、耗时（`elapsedRealtime`，防时钟回拨）、JS 堆内存增量与最近日志：每包最多 120 条、单条 4000 字符，超限丢最早（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgRuntimeMonitor.kt:7`）。包名从调用参数的 6 个键或 `registerToolPkg:` 前缀解析，解析不出就不记录（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgRuntimeMonitor.kt:92`）。

市场来源声明（`ToolPkgMarketOrigin`）是包自带的"官方市场"身份信息：`encodeForMetadata` 输出 `xor-v1:` + 与 `0x5a` 异或的字节序列；`validateForPackage` 只校验 market 为 `Operit`、toolpkgId 一致、version 非空——无签名，属自证式声明（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMarketOrigin.kt:16`）。

调试通道：三个广播 receiver（调试安装 / 刷新外部包 / compose_dsl 快照落盘）在 manifest 里均为 `exported=true`，但受 `android.permission.DUMP` 保护（`app/src/main/AndroidManifest.xml:358`）。

## 关键符号

- `PackageManager.ensureInitialized()` — 初始化入口，主线程不阻塞（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:637`）
- `PackageManager.loadAvailablePackages()` — 扫描流水线（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1830`）
- `PackageManager.enablePackage()` / `disablePackage()` / `usePackage()` / `deletePackage()` — 包状态机操作（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3145` / `3791` / `3246` / `3952`）
- `PackageManager.installDebugToolPkg()` — 调试安装（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2730`）
- `PackageManager.importPackageFileFromExternalStorage()` — 外部文件导入（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2507`）
- `ToolPkgArchiveParser.parseToolPkgFromIndexedEntries()` — 解析总流程（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:402`）
- `ToolPkgArchiveParser.normalizeZipEntryPath()` — ZipSlip 防护（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:1614`）
- `ToolPkgMainRegistrationScriptParser.parse()` — 执行 `registerToolPkg()` 并解析 23 个注册桶（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMainRegistrationScriptParser.kt:12`）
- `ToolPkgManager.getToolPkgExecutionEngine()` / `acquireToolPkgExecutionEngine()` / `releaseToolPkgExecutionEngine()` — 引擎复用与租约释放（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManager.kt:134`）
- `ToolPkgLoadOrderResolver.resolve()` — 依赖拓扑排序（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgLoadOrder.kt:30`）
- `ToolPkgApiCompatibility.requireSupported()` — API 版本门禁（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgApiVersion.kt:102`）
- `PackageManagerToolPkgFacade.runToolPkgMainHook()` — 主脚本钩子统一执行入口（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:891`）
- `PackageManagerToolPkgFacade.importToolPkgWorkflowTemplate()` / `importToolPkgWorkspaceTemplate()` — 模板导入（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:405` / `484`）
- `ToolPkgRuntimeMonitor.beginCall()` / `finishCall()` / `snapshot()` — 调用监控（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgRuntimeMonitor.kt:92`）
- `ToolPkgMarketOriginCodec.validateForPackage()` — 市场来源校验（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMarketOrigin.kt:50`）
- `ToolPkgComposeDslParser.parseRenderResult()` — compose_dsl 渲染结果解析（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgComposeDslParser.kt:21`）
- `buildToolPkgRouteId()` — 路由 id 生成 `toolpkg:<容器>:ui:<路由>`（app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgCommonPluginConstants.kt:86`）

## 调用链

**链路一：外部 `.toolpkg` 导入**

1. 输入：用户选择的 `.toolpkg` 文件 → `importPackageFileFromExternalStorage`
2. 处理：过拒绝名单 → 复制到 `Android/data/<包名>/files/packages` → 从目标路径重载 → `ToolPkgLoader.loadToolPkgFromExternalFile` 建 zip 索引 → `parseToolPkgFromIndexedEntries` 全量解析 → `canRegisterToolPkg` 防重名 → `registerToolPkg` 入注册表
3. 输出：容器 + 子包进入 Available 态；成功消息追加市场来源声明
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2507`

**链路二：包启用与工具注册**

1. 输入：`enablePackage(包名)`
2. 处理：`collectRequiredToolPkgPackages` 解析 requires（缺包/版本不符/自依赖抛错）→ 容器启用连带开子包 → 确保缓存 → `ToolPkgLoadOrderResolver` 定加载序 → `usePackage` 校验环境变量 → `registerPackageTools` 过滤 advice 工具 → 以 `包名:工具名` 注册
3. 输出：包进入 Used 态，工具对 AI 可见；23 类钩子经 `registerToolPkg()` 注册进系统
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3145`

**链路三：主脚本钩子执行**

1. 输入：`runToolPkgMainHook(容器包名, 函数名, 事件, 事件载荷, …)`
2. 处理：组装参数（含 `toolPkgId`、`__operit_script_screen`，有 chatId 则注入 `__operit_package_chat_id`）→ `resolveToolPkgExecutionContextKey` 得 `toolpkg_main:<容器>` → `getToolPkgExecutionEngine` 取复用引擎 → `executeScriptFunction` 执行 → `ToolPkgRuntimeMonitor` 记录耗时/内存
3. 输出：`Result<Any?>`；`toolpkg_message_processing` 事件额外记分段耗时日志
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt:891`

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManagerToolPkgFacade.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMainRegistrationScriptParser.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgRuntimeMonitor.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManager.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgLoadOrder.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgComposeDslParser.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgApiVersion.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgLoader.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgCommonPluginConstants.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgManifestRequirement.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgMarketOrigin.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgDebugInstallReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageDebugRefreshReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgHookModels.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgComposeDslDebugDumpReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgTemplateModels.kt`
