---
title: 插件机制与工具包桥接
module: 插件体系
sources: app/src/main/java/com/ai/assistance/operit/plugins/
date: 2026-10-01
---

# 插件机制与工具包桥接

## 概述

这一页覆盖 Operit 的插件体系：它由两层构成。

1. **Kotlin 原生插件层**：`OperitPlugin` 接口（`id` + `register()`）与 `PluginRegistry` 单例。应用启动时 `PluginRegistry.initializeBuiltins()` 注册三个内置插件并逐个安装。五个 hook 注册表/插件（应用生命周期、聊天视图、聊天消息菜单项、工具箱、工作流生命周期）是 Kotlin 代码之间互相挂钩子的总线。
2. **ToolPkg 桥接层**：工具包（ToolPkg，一种 JS 容器包）里的插件想参与 App 行为，必须经过 13 座“桥”——每座桥一头实现某个 Kotlin hook 接口，另一头把事件翻译成 `PackageManager.runToolPkgMainHook` 调用发给 JS，再把 JS 的返回翻译回平台语义。

人话总结：**Kotlin 插件是“自己人”，直接调函数；ToolPkg 插件是“外宾”，一切经过翻译官（桥接）**。桥接负责三件事：事件翻译、超时预算、把 JS 的各种返回格式收敛成平台能懂的决策（拦截/替换/放行/渲染）。

## AI 速览

- **核心符号**：`OperitPlugin`、`PluginRegistry`、`AppLifecycleHookPluginRegistry`、`ChatViewHookPluginRegistry`、`ChatMessageMenuItemRegistry`、`ToolboxPlugin`、`WorkflowLifecyclePlugin`、`ToolPkgCommonBridgePlugin`、`ToolPkgPromptHookBridge`、`ToolPkgSummaryHookBridge`、`ToolPkgToolLifecycleBridge`、`ToolPkgChatInputHookBridge`、`ToolPkgChatViewHookBridge`、`ToolPkgChatMessageHookBridge`、`ToolPkgChatMessageMenuItemBridge`、`ToolPkgChatRuntimeHookBridge`、`ToolPkgAiProviderRegistry`、`ToolPkgHookExecutionBudget`、`ToolPkgMessageProcessingCancellationRegistry`、`decodeToolPkgHookResult`、`sortedByToolPkgLoadOrder`
- **主入口**：`PluginRegistry.initializeBuiltins()`（应用启动时安装内置插件，`app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:201` 调用）、`ToolPkgCommonBridgePlugin.register()`（注册 12 座 ToolPkg 桥）、`ToolboxPlugin.register()`（注册第 13 座：应用生命周期桥）
- **数据流向一句话**：平台事件 → Kotlin hook 注册表派发 → 各桥接把事件翻译成 `runToolPkgMainHook` 发给 JS 容器 → JS 返回经 `decodeToolPkgHookResult` 解码 → 桥接收敛为平台决策（拦截/替换/放行/渲染/菜单项/开关定义），超时由 `ToolPkgHookExecutionBudget` 统一裁决。

## 核心机制

### 插件注册表（PluginRegistry）

`OperitPlugin` 接口极简，只有 `val id: String` 与 `fun register()`（`app/src/main/java/com/ai/assistance/operit/plugins/PluginRegistry.kt:12`）。`PluginRegistry` 是 object 单例：用 `CopyOnWriteArrayList` 存插件、用 `ConcurrentHashMap.newKeySet()` 记录已安装 id（`:15`）。

- `register(plugin)`：先移除同 id 旧插件再追加——同 id 注册即覆盖（`:23`）。
- `initializeBuiltins()`：`builtinsInitialized` 标志保证只跑一次；注册 `ToolboxPlugin`、`ToolPkgCommonBridgePlugin`、`WorkflowLifecyclePlugin` 三个内置插件，然后 `installAll()`（`:29`）。
- `installAll()`：只有 `installedPluginIds.add` 成功的插件才会调 `register()`，单个插件绝不重复安装（`:40`）。

写一个新插件的最小形态可以看 `WorkflowLifecyclePlugin`：实现 `OperitPlugin`，`id = "builtin.workflow.lifecycle"`，`register()` 里只做一件事——向 `AppLifecycleHookPluginRegistry` 注册内部 hook（`app/src/main/java/com/ai/assistance/operit/plugins/workflow/WorkflowLifecyclePlugin.kt:50`）。

### 五个 Kotlin hook 注册表

`plugins/` 下有五个互相独立的钩子总线，风格高度一致：插件实现带 `id` 的接口并注册，注册表派发事件，单个插件异常只记日志不连累别人。

| 注册表 | hook 接口 | 派发特点 |
|---|---|---|
| `lifecycle/AppLifecycleHookPluginRegistry` | `AppLifecycleHookPlugin.onEvent(event, params)` | 12 种 `AppLifecycleEvent`（应用+Activity 两级）；`dispatch`/`dispatchAsync`；只回放 `APPLICATION_CREATE` 与 `APPLICATION_FOREGROUND`（`:99`） |
| `chatview/ChatViewHookPluginRegistry` | `ChatViewHookPlugin.onEvent(event, params)` | `VIEW_OPENED/UPDATED/CLOSED`；用 `LinkedHashMap` 记住当前打开的视图，供新加载的 hook 回放（`:41`） |
| `chatmessage/ChatMessageMenuItemRegistry` | `ChatMessageMenuItemPlugin.createMenuItems(params)` | 返回菜单项列表，按 `order/title/id` 排序；`changeVersion` StateFlow 广播变更（`:44`） |
| `toolbox/ToolboxPlugin` | 内部 `ToolPkgAppLifecycleHookPlugin` | 把应用生命周期事件转给 ToolPkg（见下） |
| `workflow/WorkflowLifecyclePlugin` | 内部 `WorkflowAppLifecycleHookPlugin` | 首次 `ACTIVITY_START` 触发冷启动工作流（`firstActivityStartHandled` 防重，`:25`） |

生命周期事件的线名（wireName）直接复用 packTool 包的 `TOOLPKG_EVENT_*` 常量，例如 `TOOLPKG_EVENT_APPLICATION_ON_CREATE = "application_on_create"`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgCommonPluginConstants.kt:5`）。

`AppLifecycleEvent` 的 `wireName` 直接取自这些常量（`app/src/main/java/com/ai/assistance/operit/plugins/lifecycle/AppLifecycleHookPluginRegistry.kt:24`）。

回放是“迟到者补偿”：`APPLICATION_BACKGROUND` 会清空已保存的前台参数（`:136`），所以后台事件不会被回放——只有 CREATE 与 FOREGROUND 两种事件值得补发。

### 13 座 ToolPkg 桥接

`ToolPkgCommonBridgePlugin.register()` 一次注册 12 座桥（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgCommonBridgePlugin.kt:905`）。

加上应用生命周期桥（`app/src/main/java/com/ai/assistance/operit/plugins/toolbox/ToolboxPlugin.kt:149`），13 座桥至此齐全：

1. `ToolPkgMessageProcessingBridgePlugin`（`builtin.toolpkg.message-processing-bridge`，`:90`）——消息处理
2. `ToolPkgXmlRenderBridgePlugin`（`builtin.toolpkg.xml-render-bridge`，`:454`）——XML 标签渲染
3. `ToolPkgInputMenuToggleBridgePlugin`（`builtin.toolpkg.input-menu-toggle-bridge`，`:639`）——输入菜单开关
4. `ToolPkgPromptHookBridge`（内含 7 个子桥接，`:53`）——prompt 流水线
5. `ToolPkgSummaryHookBridge`（`builtin.toolpkg.summary-generate-hook-bridge`）——摘要生成
6. `ToolPkgToolLifecycleBridge`（`builtin.toolpkg.tool-lifecycle`）——工具调用生命周期
7. `ToolPkgChatInputHookBridge`（`builtin.toolpkg.chat-input-hook-bridge`）——聊天输入
8. `ToolPkgChatViewHookBridge`（`builtin.toolpkg.chat-view-hook-bridge`）——聊天视图
9. `ToolPkgChatMessageHookBridge`——消息落盘
10. `ToolPkgChatMessageMenuItemBridge`（`builtin.toolpkg.chat-message-menu-item-bridge`）——消息菜单项
11. `ToolPkgChatRuntimeHookBridge`（`builtin.toolpkg.chat-runtime-hook-bridge`）——聊天运行时状态
12. `ToolPkgAiProviderRegistry`——AI provider（模型列表/发消息/连通性测试/token 计算）
13. `ToolPkgAppLifecycleHookPlugin`（`builtin.toolbox.toolpkg-app-lifecycle`，`app/src/main/java/com/ai/assistance/operit/plugins/toolbox/ToolboxPlugin.kt:26`）——应用生命周期

每座桥的“同步”逻辑都一样：监听 `PackageManager` 的 `ToolPkgRuntimeChangeListener`，容器变化时从各容器的 `*Hooks` 列表重新收集注册。

排序按 `sortedByToolPkgLoadOrder`（容器加载顺序 → 包名小写 → 注册 id）（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookBridgeSupport.kt:170`）。注册数据类（`ToolPkg*Registration`）全部集中定义在 `ToolPkgHookBridgeSupport.kt`（自 `:14` 起）。

### 消息处理桥接：先试探，后执行

这是最复杂的一座桥。`createExecutionIfMatched`（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgCommonBridgePlugin.kt:98`）对每条消息先试探、后执行。

试探载荷带 `probeOnly=true`（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgCommonBridgePlugin.kt:113`）。

试探返回的 `matched` 字段缺省为 true（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgCommonBridgePlugin.kt:383`）。

只有判匹配的 hook 才创建真正的流式执行并立即返回（`:177`），都不匹配则返回 null（`:185`）。

试探结果的三种形态（`:364`）：`Boolean true` 视为匹配但无 chunk；非空 `String` 视为匹配且内容作单个 chunk；`JSONObject` 按 `matched` 字段判定（缺省 true，`:383`）。正式执行时，JS 的中间结果经 `runCatching { decodeHookResult }` 解码后，从 `chunk/chunks/text/content` 四个键提取文本（`:396`），经 `Channel<String>(UNLIMITED)` 转发为流式 chunk（`:301`）。执行 id 形如 `toolpkg-msg:<包名>:<插件id>:<uuid>`（`:286`），`finally` 块关闭队列并从 `ToolPkgMessageProcessingCancellationRegistry` 注销（`:346`）。

取消注册表支持“先取消、后注册”：`cancel` 找不到控制器时把 id 记入 `pendingCancels`，后续 register 时立即补取消并返回 false（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgMessageProcessingCancellationRegistry.kt:53`）。

### XML 渲染桥接

`ToolPkgXmlRenderBridgePlugin` 实现平台的 `XmlRenderPlugin` 接口。`supports(tagName)` 按 tag 去空格转小写查 hook 表（`:468`）；`resolve` 逐个 hook 发 `TOOLPKG_EVENT_XML_RENDER`，载荷含 `xmlContent` 与 `tagName`（`:476`）。JS 返回 `handled=false` 就换下一个 hook（`:527`）；返回 `composeDsl` 则转为 `XmlRenderResult.ComposeDslScreen`（要求 `screen` 非空，`:585`），纯文本则转为 `XmlRenderResult.Text`（`:542`）。hook 表变化时调 `XmlRenderPluginRegistry.notifyChanged()`（`:458`）。

### 输入菜单开关桥接

`ToolPkgInputMenuToggleBridgePlugin` 给输入框菜单提供可开关的功能项。开关定义缓存在内存里，缓存键为 `"$runtime|$chatId"`（`:694`）；参数变化或 `replaceHooks` 时清空缓存并递增 `hookRegistryVersion`（`:655`）。缓存未命中时先返回一个 id 为 `toolpkg_input_menu_loading` 的禁用加载开关占位，后台 `loadSpecs` 对每个 hook 发 `action="create"` 拉取真实定义（`:797`），定义要求 `id` 与 `title` 均非空（`:867`）。`onToggle` 时：如果该开关已在平台 `featureStates` 里，走平台自己的切换；否则调用 JS hook 的 `toggle` 动作（`:725`）。

### 输入 / Prompt / 摘要：三套“预算内串行”

- **聊天输入**（`ToolPkgChatInputHookBridge`）：一次输入事件的所有 hook 共享一个 `ToolPkgHookExecutionBudget`（`:59`）；每个 hook 调用带 `timeoutMillis=budget.remainingMillis()`，预算耗尽就跳过剩余 hook。`SUBMIT_REQUESTED` 超时时生成提示消息（`toolpkg_hook_timeout_continue_sending_with_plugin`）并中断后续 hook——**超时失败是“放行+提示”**，消息照发（`:72`）。`REPLACE` 动作链式累积文本（`:139`），`BLOCK`/`CONSUME` 直接终止链（`:137`）；非提交事件的结果直接丢弃（`:132`）。最终返回 `ALLOW`（`:153`）。
- **Prompt 流水线**（`ToolPkgPromptHookBridge`）：7 个子桥接覆盖 `prompt-input`、`prompt-history`、`prompt-estimate-history`、`system-prompt-compose`、`tool-prompt-compose`、`prompt-finalize`、`prompt-estimate-finalize` 七个阶段（`:53`）。`dispatchPromptHooks` 串行执行、mutation 链式累加（`:176`）；预算耗尽时回调 `current.onHookTimeout` 告知具体是哪个插件超时（`:185`）。字符串返回按阶段解释：input 阶段视为 `processedInput`（`:410`），system 阶段视为 `systemPrompt`（`:441`）；`prompt-history` 阶段的 `JSONArray` 按当前阶段写入 `chatHistory` 或 `preparedHistory`（`:422`），未知 `kind` 的消息被跳过（`:515`）。
- **摘要**（`ToolPkgSummaryHookBridge`）：字符串返回在 `after_generate_summary` 阶段视为 `summaryResult`，否则视为 `summaryPrompt`（`:196`）。注意它与 prompt 桥接不对称：超时直接 `break`，不回调 `onHookTimeout`（`:75`）。

### 工具生命周期桥接：失败即拦截

`ToolPkgToolLifecycleBridge` 实现 `AIToolHook`，`init` 块启动单消费者协程串行消费 `dispatchChannel`（`:40`）。`onToolCallRequested`/`onToolExecutionResult` 等只是异步入队（`:60`）；唯独 `onToolCallIntercept` 是**同步**的——hook 执行失败直接返回 `Block`（`:86`），返回值非法也直接 `Block`（`:99`），只有解析出明确决策才放行（无决策返回 `Allow`，`:107`）。决策只认 `action="block"` 且 `reason` 为字符串的结果（`:203`）。`enqueue` 用 `trySend`，满了就记 warn 丢弃（`:156`）；`deliver` 逐个 hook 串行调用，**没有超时预算**（`:168`）。

### AI Provider 注册表

`ToolPkgAiProviderRegistry.get(providerId)` 先执行 `register()` 再按 trim+小写查表（`:25`）。

每个 provider 注册 4 对 JS 处理器：`listModels`、`sendMessage`、`testConnection`、`calculateInputTokens`（函数名 + 内联源码）（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgAiProviderRegistry.kt:62`）。

token 别名有四种写法：`id`、`TOOLPKG_<id>`、`TOOLPKG_<小写id>`、`displayName`（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookBridgeSupport.kt:126`）。

别名冲突直接 `require` 抛异常（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgAiProviderRegistry.kt:40`）。

### 共享支撑：解码、预算、排序

- `decodeToolPkgHookResult`（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookBridgeSupport.kt:138`）：空字符串→null；JSON 解析失败→回退返回原文。

检测到 JS 执行错误信息时抛 `IllegalStateException`（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookBridgeSupport.kt:146`）。
- `ToolPkgHookExecutionBudget`（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookExecutionBudget.kt:23`）：超时秒数来自 `DisplayPreferencesManager`；`remainingMillis()` 耗尽返回 null，否则至少 1ms（`:33`）。

`logTimeoutIfPresent` 只认含 "timed out"（忽略大小写）的失败（`app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookExecutionBudget.kt:56`）。
- 事件线名常量全部来自 `core/tools/packTool/ToolPkgCommonPluginConstants.kt`（如 `TOOLPKG_EVENT_CHAT_VIEW`、`TOOLPKG_EVENT_TOOL_LIFECYCLE`），Kotlin 与 JS 共用同一套名字。

### 生命周期回放：迟到者的补偿

ToolPkg 容器安装晚于应用启动，CREATE 事件在其安装前即已派发。两处做了“回放”：

- 应用生命周期：`ToolboxPlugin` 在容器变化时，只把**新增**的 hook（`syncToolPkgRegistrations` 返回的新旧差集，`:72`）回放给 `getReplayableApplicationEvents()` 记录的可回放事件（`:156`）。
- 聊天视图：`ToolPkgChatViewHookBridge` 同步时只回放新增 hook（`:96`），对每个当前打开的视图用 `VIEW_OPENED` 的线名重新触发（`:129`）。

## 关键符号

- `OperitPlugin` / `PluginRegistry`（`plugins/PluginRegistry.kt`）——插件接口与注册表；`initializeBuiltins()` / `register()` / `installAll()`
- `AppLifecycleHookPluginRegistry`（`plugins/lifecycle/`）——12 种应用/Activity 生命周期事件；`dispatch` / `dispatchAsync` / `getReplayableApplicationEvents`
- `ChatViewHookPluginRegistry`（`plugins/chatview/`）——视图打开/更新/关闭；`getReplayableOpenViewParams`
- `ChatMessageMenuItemRegistry`（`plugins/chatmessage/`）——消息菜单项；`createMenuItems` / `notifyChanged` / `changeVersion`
- `ToolboxPlugin`（`plugins/toolbox/`）——`builtin.toolbox`；内含第 13 座桥 `ToolPkgAppLifecycleHookPlugin`
- `WorkflowLifecyclePlugin`（`plugins/workflow/`）——`builtin.workflow.lifecycle`；冷启动触发工作流的最小插件示例
- `ToolPkgCommonBridgePlugin`（`plugins/toolpkg/`）——`builtin.toolpkg.common-bridge`；`register()` 注册 12 座桥
- `ToolPkgMessageProcessingBridgePlugin`——`createExecutionIfMatched` / `createStreamingExecution`；试探-执行两阶段
- `ToolPkgXmlRenderBridgePlugin`——`supports` / `resolve`；`XmlRenderResult.ComposeDslScreen` / `Text`
- `ToolPkgInputMenuToggleBridgePlugin`——`createToggles`；`"$runtime|$chatId"` 缓存键；`toolpkg_input_menu_loading` 占位开关
- `ToolPkgPromptHookBridge`——7 子桥接；`dispatchPromptHooks`；`PromptHookMutation` / `applyMutation`
- `ToolPkgSummaryHookBridge`——`after_generate_summary` 阶段语义
- `ToolPkgToolLifecycleBridge`——`onToolCallIntercept`（同步 fail-closed）；`AIToolHookDecision.Block` / `Allow`
- `ToolPkgChatInputHookBridge`——`dispatchChatInputHooks`；`REPLACE` 链式累积；`ALLOW` 收尾
- `ToolPkgChatViewHookBridge` / `ToolPkgChatMessageHookBridge` / `ToolPkgChatMessageMenuItemBridge` / `ToolPkgChatRuntimeHookBridge`——视图/消息落盘/菜单项/运行时四座桥
- `ToolPkgAiProviderRegistry`——`get(providerId)`；四对 JS 处理器；四种 token 别名
- `ToolPkgHookExecutionBudget`——`create()` / `remainingMillis()` / `logTimeoutIfPresent()` / `logDeadlineReached()`
- `ToolPkgMessageProcessingCancellationRegistry`——`register` / `cancel`；`pendingCancels` 补取消
- `decodeToolPkgHookResult` / `sortedByToolPkgLoadOrder`（`ToolPkgHookBridgeSupport.kt`）——结果解码与容器排序

## 输入→处理→输出调用链

1. **应用启动安装插件**：
   - 输入：`OperitApplication.onCreate()`（`app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:201`）
   - 处理：`PluginRegistry.initializeBuiltins()` 注册 `ToolboxPlugin`、`ToolPkgCommonBridgePlugin`、`WorkflowLifecyclePlugin` → `installAll()` 逐个调 `register()`；各桥接向自己的 Kotlin 注册表注册，并向 `PackageManager` 添加 `ToolPkgRuntimeChangeListener`
   - 输出：13 座 ToolPkg 桥全部就位；`APPLICATION_CREATE` 事件经 `AppLifecycleHookPluginRegistry.dispatch` 派发给 Kotlin 插件与 ToolPkg 生命周期 hook
2. **用户发送消息（输入 hook → prompt hook → 工具拦截）**：
   - 输入：用户在输入框提交文本，`ChatInputHookRegistry` 触发 `SUBMIT_REQUESTED`
   - 处理：`ToolPkgChatInputHookBridge.dispatchChatInputHooks` 在共享预算内串行调 JS hook，`REPLACE` 链式改文本，`BLOCK`/`CONSUME` 截停；文本进入 prompt 流水线，7 个子桥接依次给 JS 修改 `processedInput`/`systemPrompt`/历史的机会；工具调用前 `ToolPkgToolLifecycleBridge.onToolCallIntercept` 同步问 JS 是否拦截
   - 输出：`ALLOW`（文本+超时提示）→ 模型请求；拦截则 `Block(reason)`，工具调用被阻止
3. **ToolPkg 容器后安装（同步与回放）**：
   - 输入：`PackageManager` 触发 `ToolPkgRuntimeChangeListener`（新容器启用）
   - 处理：各桥的 `syncToolPkgRegistrations` 从容器 `*Hooks` 列表重建注册并排序；`ToolboxPlugin` 计算新增 lifecycle hook，`ToolPkgChatViewHookBridge` 计算新增 view hook
   - 输出：新增 hook 收到回放事件（应用 CREATE/FOREGROUND、已打开视图的 VIEW_OPENED），与早到的 hook 看到一致的世界

## 来源

- `app/src/main/java/com/ai/assistance/operit/plugins/PluginRegistry.kt`（47 行）：插件接口与注册表
- `app/src/main/java/com/ai/assistance/operit/plugins/lifecycle/AppLifecycleHookPluginRegistry.kt`（146 行）：应用生命周期 hook 注册表
- `app/src/main/java/com/ai/assistance/operit/plugins/chatview/ChatViewHookPluginRegistry.kt`（103 行）：聊天视图 hook 注册表
- `app/src/main/java/com/ai/assistance/operit/plugins/chatmessage/ChatMessageMenuItemRegistry.kt`（79 行）：聊天消息菜单项注册表
- `app/src/main/java/com/ai/assistance/operit/plugins/toolbox/ToolboxPlugin.kt`（173 行）：builtin.toolbox，第 13 座桥（应用生命周期）
- `app/src/main/java/com/ai/assistance/operit/plugins/workflow/WorkflowLifecyclePlugin.kt`（56 行）：builtin.workflow.lifecycle，冷启动工作流触发
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgCommonBridgePlugin.kt`（982 行）：12 座桥的注册入口；消息处理/ XML 渲染/输入菜单开关三座大桥
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgPromptHookBridge.kt`（526 行）：prompt 流水线 7 子桥接
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgSummaryHookBridge.kt`（243 行）：摘要生成桥
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgToolLifecycleBridge.kt`（262 行）：工具生命周期桥（同步 fail-closed 拦截）
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgChatInputHookBridge.kt`（240 行）：聊天输入桥（预算内串行）
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgChatViewHookBridge.kt`（155 行）：聊天视图桥（含回放）
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgChatMessageHookBridge.kt`（113 行）：消息落盘桥
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgChatMessageMenuItemBridge.kt`（228 行）：消息菜单项桥
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgChatRuntimeHookBridge.kt`（156 行）：聊天运行时状态桥
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgAiProviderRegistry.kt`（79 行）：AI provider 注册表
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookBridgeSupport.kt`（184 行）：注册数据类、结果解码、容器排序、token 别名
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgHookExecutionBudget.kt`（75 行）：hook 执行预算
- `app/src/main/java/com/ai/assistance/operit/plugins/toolpkg/ToolPkgMessageProcessingCancellationRegistry.kt`（64 行）：消息处理取消注册表
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgCommonPluginConstants.kt`：事件线名常量（Kotlin/JS 共用）
- `app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:201`：插件体系启动调用点
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1191`：消息落盘 hook 驱动点
