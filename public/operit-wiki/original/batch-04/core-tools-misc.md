---
title: 专项工具（PhoneAgent/计算器/MCP/Skill/CLI 模式/条件）
module: 工具系统
sources:
  - app/src/main/java/com/ai/assistance/operit/core/tools/agent/
  - app/src/main/java/com/ai/assistance/operit/core/tools/calculator/
  - app/src/main/java/com/ai/assistance/operit/core/tools/climode/
  - app/src/main/java/com/ai/assistance/operit/core/tools/condition/
  - app/src/main/java/com/ai/assistance/operit/core/tools/mcp/
  - app/src/main/java/com/ai/assistance/operit/core/tools/skill/
date: 2026-10-01
issue: 25
---

# 专项工具：PhoneAgent / 计算器 / MCP / Skill / CLI 模式 / 条件

## 概述

这一页讲 Operit 里六个"专项工具"：`PhoneAgent`（自动操控手机的 AI 智能体）、`Calculator`（表达式计算器）、`MCP`（连外部 MCP 服务器的工具桥）、`Skill`（技能包）、`CliToolModeSupport`（弱模型用的 CLI 工具模式）、`ConditionEvaluator`（条件表达式求值器）。它们都在 `core/tools/` 下面，是"让 AI 能动手干活"的各种执行器。

`PhoneAgent` 是最复杂的一个：它是一个"看屏幕→想一步→点一下"的循环智能体，能自己打开 App、点按、输入、滑动。需要屏幕操作时走一条叫 Shower 的通道：Shower 服务端是个独立 jar（`shower-server.jar`），跑在 `app_process` 里，通过广播把它的服务 binder 交给 Operit，再用虚拟显示器（`VirtualDisplayManager`）抓屏、H.264 解码渲染到界面。

`Calculator` 是个自研小解析器：把 `1+2*Math.sqrt(9)` 这样的字符串解析成语法树再求值，还带单位换算、日期、统计函数。`MCP` 让 Operit 能调用外部 MCP 服务器的工具（格式 `server:tool`），结果超长自动存文件。`Skill` 从 `Download/Operit/skills` 目录加载技能包（每个技能一个 `SKILL.md` 说明文件）。`CliToolModeSupport` 给弱模型（LMSTUDIO/OLLAMA 等本地模型）用：只暴露 `search` 和 `proxy` 两个工具，模型想用别的工具要先搜、再代理调用。`ConditionEvaluator` 是个小布尔表达式求值器，给权限/条件判断用。

## AI 速览

**核心符号清单**

- `PhoneAgent` / `AgentConfig` / `ParsedAgentAction` / `ActionHandler` / `PhoneAgentJobRegistry` —— 智能体本体与配置、动作解析、Job 注册表
- `ShowerController` / `ShowerBinderReceiver` / `ShowerBinderRegistry` / `ShowerServerManager` / `ShowerVideoRenderer` / `VirtualDisplayManager` —— Shower 屏幕操控链
- `Calculator` / `JsCalculator` / `ExpressionParser` / `ExpressionContext` / `ExpressionNode` —— 计算器
- `MCPPackage` / `MCPToolExecutor` / `MCPManager` / `McpRuntimeSession` / `MCPToolParameter` —— MCP 桥
- `SkillManager` / `SkillPackage` —— 技能包
- `CliToolModeSupport` / `ToolExposureMode` / `HiddenToolSourceKind` —— CLI 工具模式
- `ConditionEvaluator` —— 条件求值

**主入口**

- 智能体任务入口：`PhoneAgent.run(task)`；单步执行：`PhoneAgent._executeStep`
- 计算：`JsCalculator.evaluate(expression)`
- MCP 工具调用：`MCPToolExecutor.invoke(tool, ...)`
- 技能提示词：`SkillManager.getSkillSystemPrompt(skillName)`
- CLI 工具搜索/代理：`CliToolModeSupport.searchHiddenToolCatalog` / `proxyToHiddenTool`
- 条件判断：`ConditionEvaluator.evaluate(expression, capabilities)`

**数据流向一句话**

PhoneAgent 每步抓屏发给模型，模型回 `do(action=…)` 指令，解析后经 Shower 或系统工具执行；计算器把表达式字符串变成语法树再求出数字；MCP 把 `server:tool` 格式的调用转成对应服务器的会话调用，结果超长落盘；Skill 把技能目录的 `SKILL.md` 拼成提示词喂给模型；CLI 模式下模型只能先搜工具名、再代理调用；条件求值器把布尔表达式算成 true/false。

## 核心机制

### PhoneAgent：看屏→想→动的循环

`PhoneAgent.run(task)` 是一个最多 `AgentConfig.maxSteps`（默认 20）步的循环。每一步：

1. `ActionHandler.captureScreenshotForAgent()` 抓当前屏幕；
2. 把截图发给 `uiService.sendMessage`（流式），拿到模型回复；
3. `parseThinkingAndAction` 把回复拆成思考过程和动作部分；
4. `parseAgentAction` 从动作部分找出最后一个 `finish(message="...")` 或 `do(action=...)`，用正则 `(\w+)\s*=\s*...` 解析出动作名和参数；
5. `ActionHandler.executeAgentAction` 执行：Tap 点按、Type 输入、Swipe 滑动、Launch 打开应用、Back/Home/Wait，以及 `Take_over`（把控制权交还用户）。

坐标是千分比相对坐标：模型说 `[500,800]`，`parseRelativePoint` 换成真实像素。`agentId` 默认为 `"default"`（操作主屏）；非 default 的 agentId 会要求虚拟屏（`requiresVirtualScreen`），任务结束时 `cleanupOnFinish` 关掉虚拟屏。`PhoneAgentJobRegistry` 按 agentId 登记协程 Job，支持按 agent 或全部取消。

### Shower 链：屏幕操控的幕后通道

Shower 是 Operit 操控屏幕的底层通道，分四段：

- **服务端**：`shower-server.jar` 打包在 app 的 assets 里，`ShowerServerManager` 把它拷到 files 目录，用 `app_process` 拉起来跑 `com.ai.assistance.shower.Main`。
- **Binder 交接**：服务端就绪后发广播 `SHOWER_BINDER_READY`，`ShowerBinderReceiver` 收到后把 binder 包里的 `IShowerService` 接口存入 `ShowerBinderRegistry`。
- **控制**：`ShowerController` 按 agentId 维护多实例（`ConcurrentHashMap`），提供截图、确保虚拟屏、打开应用、点按/滑动/按键注入。Tap 动作优先走 Shower，Shower 不可用时回退标准工具。
- **画面**：`VirtualDisplayManager` 建一个叫 `OperitVirtualDisplay` 的虚拟显示器（ImageReader，RGBA_8888），可抓最新帧转 Bitmap 或存 PNG；`ShowerVideoRenderer` 把 H.264 视频流解码渲染到 Surface（前两帧是编解码配置）。

### 计算器：自研表达式解析器

`Calculator` 只是 `JsCalculator` 的适配壳。真正干活的是 `ExpressionParser` + `ExpressionContext` + `ExpressionNode`：

- 词法 14 种 token，语法按固定优先级逐层下降：三元 → 赋值 → 或 → 与 → 相等 → 比较 → 加减 → 乘除 → 指数 → 一元 → 数组访问 → 基本表达式；
- 节点是密封接口 `ExpressionNode`，10 种节点，每种 `evaluate()` 返回 Double；
- 模板字符串用反引号，`${…}` 里嵌表达式；
- `ExpressionContext` 是单例：变量表、PI/E 常量、JS 风格数字转换（null→0、"abc"→NaN）、`Math.` 函数、`stats.mean/median/…`、`now()/today()` 日期、`factorial`（n>20 报错）、单位换算 `convert`；
- 结果格式化：整数不显示小数，否则最多 6 位去尾零。

### MCP：外部工具桥

MCP（Model Context Protocol）让 Operit 调用外部服务器提供的工具：

- `MCPServerConfig` 存服务器名、地址、描述；`MCPPackage.loadFromServer` 连上服务器、拉工具列表，按每个工具的 inputSchema（properties/required）生成参数定义，打包成工具包（category 为 `"MCP"`，包名直接用服务器名）；
- 调用格式 `server:tool`：`MCPToolExecutor.invoke` 先检查该服务器是否已 `use_package` 激活，否则报错提示先激活；参数经 `smartConvert` 按类型自动转换；
- 结果解析 MCP 标准 `content[]`（text/image/resource），图片进 `ImagePoolManager` 后以 `<link type="image">` 引用；text 是 JSON 会压成单行；超 5000 字（`ToolExecutionLimits.MAX_TEXT_RESULT_LENGTH`）写文件返回路径；
- 参数里含 U+FFFD 替换字符会被拦截（防止损坏内容写到远端）；
- `MCPManager` 缓存会话（Local 走 `BridgeMcpRuntimeSession`，Remote 走 `RemoteMcpRuntimeSession`），断连自动重连。

### Skill：技能包

技能是用户自己放的"能力包"：根目录在 `Download/Operit/skills`，每个子目录一个技能，靠 `SKILL.md`（或小写 `skill.md`）说明。`SkillManager` 扫描目录、解析 frontmatter 的 name/description（没有就扫前 40 行），重名报错跳过。`getSkillSystemPrompt` 把技能说明拼成提示词喂给模型。支持从 zip 导入：只收 zip、ZipSlip 路径校验、目标已存在拒绝、自动识别单层目录。删除就是整个目录删掉。

### CLI 工具模式：给弱模型的极简工具集

本地弱模型（LMSTUDIO、OLLAMA、OPENAI_LOCAL、MNN、LLAMA_CPP）进 `ToolExposureMode.CLI`，只看到两个工具：

- `search(query, limit)`：在隐藏工具目录里按名搜索，评分精确 300 / 前缀 140 / 包含 100 / 描述 40 / 参数 25，limit 钳 1–20；
- `proxy(tool_name, params)`：代理调用搜到的隐藏工具；`search`/`proxy`/`package_proxy` 本身禁被代理。

隐藏目录来源 5 种（BUILTIN/INTERNAL/PACKAGE/MCP/ACTIVATION）：内置工具、启用的工具包、AI 可见的 Skill、MCP 服务器缓存工具；空包或无工具的 MCP 服务器变成 `use_package` 激活条目。提示词明确要求模型"先 search 再 proxy，不许直接调隐藏工具"。

### 条件求值器

`ConditionEvaluator.evaluate(expr, capabilities)` 是个小布尔表达式解释器：支持 `&&` `||` `!`、`==` `!=` `>` `>=` `<` `<=`、`in`（数组成员）。空表达式返回 true；求值异常记 warn 返回 false。真值规则：Bool 按值、数字非 0 非 NaN、字符串非空、null 恒假、数组按空否。`&&`/`||` 短路。字符串只能和字符串比较。

## 关键符号

| 符号 | 作用 |
|---|---|
| `PhoneAgent` | 自动操控手机的 AI 智能体，run→循环单步 |
| `AgentConfig` | 智能体配置，`maxSteps` 默认 20 |
| `ParsedAgentAction` | 解析后的动作（名+参数表） |
| `ActionHandler` | 截图、解析、执行动作的实际干活类 |
| `PhoneAgentJobRegistry` | 按 agentId 登记/取消智能体协程 Job |
| `ShowerController` | 按 agentId 多实例的 Shower 服务控制器 |
| `ShowerBinderReceiver` | 收 SHOWER_BINDER_READY 广播，取 IShowerService binder |
| `ShowerBinderRegistry` | 存 Shower 服务接口的注册表 |
| `ShowerServerManager` | 从 assets 拷 jar 并用 app_process 启动 Shower 服务端 |
| `ShowerVideoRenderer` | H.264 解码渲染到 Surface |
| `VirtualDisplayManager` | 建 OperitVirtualDisplay 虚拟屏并抓帧 |
| `JsCalculator` | 计算器真正入口，`evaluate` 解析求值 |
| `ExpressionParser` | 递归下降解析器，14 种 token |
| `ExpressionContext` | 单例：变量、常量、函数库、单位换算 |
| `ExpressionNode` | 密封接口，10 种语法树节点 |
| `MCPServerConfig` / `MCPTool` / `MCPToolParameter` | MCP 服务器/工具/参数的数据类 |
| `MCPPackage` | 从服务器拉工具列表生成工具包 |
| `MCPToolExecutor` | `server:tool` 调用执行器，含结果解析与截断 |
| `MCPManager` | 会话缓存、重连、注册/注销 |
| `McpRuntimeSession` | 运行时会话接口（connect/listTools/callTool/close） |
| `SkillManager` / `SkillPackage` | 技能扫描、导入、删除、提示词组装 |
| `CliToolModeSupport` | CLI 模式工具目录、搜索、代理 |
| `ToolExposureMode` | FULL/CLI 两档 |
| `ConditionEvaluator` | 布尔条件表达式求值 |

## 调用链

**智能体一轮任务**

1. 输入：用户任务文本 → `PhoneAgent.run(task)`；
2. 处理：循环 `_executeStep`——抓屏 → `uiService.sendMessage` 流式 → `parseThinkingAndAction` → `parseAgentAction`（找最后一个 `finish(`/`do(`）→ `executeAgentAction`（Shower 优先，否则标准工具）；
3. 输出：`finish(message)` 的消息、或超步返回 `"Max steps reached"`、或 `Take_over` 交还用户。

**Shower 服务就绪**

1. 输入：`shower-server.jar`（assets）；
2. 处理：拷到 files → `app_process` 启动 → 发 `SHOWER_BINDER_READY` 广播 → `ShowerBinderReceiver` 取 binder → `ShowerBinderRegistry.setService`；
3. 输出：`ShowerController` 可用的 `IShowerService` 接口。

**一次计算**

1. 输入：表达式字符串 → `JsCalculator.evaluate`；
2. 处理：`ExpressionParser` 词法+递归下降 → `ExpressionNode` 语法树 → `ExpressionContext` 求值（变量/函数/单位换算）；
3. 输出：Double 结果，异常包成 `IllegalArgumentException`。

**一次 MCP 工具调用**

1. 输入：`invoke("server:tool", params)`；
2. 处理：查 `MCPManager` 会话是否激活 → 参数 `smartConvert` → 会话 `callTool` → 解析 content[]（文本/图片/资源）→ 超 5000 字写文件；
3. 输出：文本结果或文件路径，图片以 `<link type="image">` 引用。

**技能提示词组装**

1. 输入：技能名 → `SkillManager.getSkillSystemPrompt`；
2. 处理：刷新扫描 → 找技能目录 → 读 `SKILL.md` 全文 + 目录树；
3. 输出：拼好的系统提示词字符串。

**CLI 模式用工具**

1. 输入：模型调 `search(query)`；
2. 处理：`searchHiddenToolCatalog` 按评分排序取 topN → 模型调 `proxy(tool_name, params)` → `proxyToHiddenTool` 转发给隐藏工具；
3. 输出：隐藏工具的执行结果。

## 来源

- 智能体：`app/src/main/java/com/ai/assistance/operit/core/tools/agent/PhoneAgent.kt`（主循环 507、动作解析 669–716、8 种动作 966–1142、坐标换算 1220）
- Job 注册表：`.../agent/PhoneAgentJobRegistry.kt`（14–55）
- Shower 控制/交接/服务端/渲染/虚拟屏：`.../agent/ShowerController.kt`、`ShowerBinderReceiver.kt`、`ShowerServerManager.kt`、`ShowerVideoRenderer.kt`、`.../agent/VirtualDisplayManager.kt`（137–145）；广播声明 `app/src/main/AndroidManifest.xml`（438–446）
- 计算器：`.../calculator/Calculator.kt`、`JsCalculator.kt`（18–37）、`ExpressionParser.kt`（33–60、280–290、377）、`ExpressionNode.kt`（4–30）、`ExpressionContext.kt`（14–60、104–175、251–318）
- CLI 模式：`.../climode/CliToolModeSupport.kt`（19–43、66–125、209、349、636–655）
- 条件：`.../condition/ConditionEvaluator.kt`（9–23、200–255）
- MCP：`.../mcp/MCPServerConfig.kt`、`MCPTool.kt`、`MCPToolParameter.kt`（18–130）、`MCPJson.kt`（11–16）、`McpRuntimeSession.kt`（6–46）、`MCPPackage.kt`（38–178）、`MCPToolExecutor.kt`（43–60、80–130、236–302、380、422–445、509–602）
- Skill：`.../skill/SkillManager.kt`（30–94、157–224、268–410）、`SkillPackage.kt`
