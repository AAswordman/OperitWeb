---
title: 系统提示词与功能提示配置
module: 引擎核心
sources: SystemPromptConfig.kt, FunctionalPrompts.kt, SystemToolPrompts.kt, SystemToolPromptsInternal.kt, PromptTagManager.kt, PromptVersionManager.kt, PromptTag.kt
date: 2026-10-01
---

# 系统提示词与功能提示配置

## 概述

这一页管的是 Operit 每次跟 AI 模型说话之前，先在后台拼好的那几段"开场白"：系统提示词（告诉模型你是谁、能用什么工具、工作区在哪）、各种功能提示词（对话摘要、UI 操控、记忆抽取、角色卡生成等专用指令），以及用户自己存的提示词标签。简单说——模型看到的"人设 + 能力说明书 + 任务指令"，都是这里产出的。

## AI 速览

**核心符号清单**

- `SystemPromptConfig.getSystemPrompt` / `getSystemPromptWithCustomPrompts`：系统提示词组装主入口
- `SYSTEM_PROMPT_TEMPLATE` / `SYSTEM_PROMPT_TEMPLATE_CN`：中英两套系统提示词模板，各由 6 个占位节组成
- `SUBTASK_AGENT_PROMPT_TEMPLATE`：子任务 agent 专用模板（无记忆、无情绪、不等待用户输入）
- `FunctionalPrompts`：功能提示词库（`SUMMARY_PROMPT` 摘要、`UI_CONTROLLER_PROMPT` 单步 UI 操控、`UI_AUTOMATION_AGENT_PROMPT` 自主 UI agent、`personaCardGenerationSystemPrompt` 角色卡生成、记忆/知识图谱抽取等）
- `SystemToolPrompts.generateToolsPromptEn` / `generateToolsPromptCn`：AI 可见工具说明的生成入口
- `SystemToolPromptsInternal.internalToolCategoriesEn` / `internalToolCategoriesCn`：内部工具提示词（12 分类、146 个工具，中英平行定义）
- `PromptTagManager`：提示词标签的增删改查（DataStore 持久化）
- `PromptVersionManager`：通用提示词版本管理器（基础设施，目前全仓库无调用方）

**主入口**：`ConversationService` 在每次对话开始时调用 `SystemPromptConfig.getSystemPromptWithCustomPrompts`，生成发给模型的系统提示词。

**数据流向一句话**：用户设置、JS 包 / MCP 服务器 / Skill、当前工作区、SAF 书签、模型能力开关等上下文 → `SystemPromptConfig` 按模板拼装 → 经 JS 包三阶段 hook 改写 → 产出最终系统提示词；功能提示词由 `FunctionalPrompts` 按需取用；工具说明由 `SystemToolPrompts`（+ `SystemToolPromptsInternal`）动态生成。

## 核心机制

### 1. 六节模板与三种组装模式

系统提示词模板由 6 个占位节组成：自我介绍（`BEGIN_SELF_INTRODUCTION_SECTION`）、工作区指南、工具使用说明、包系统说明、已激活包列表、可用工具列表。`getSystemPrompt` 按三种模式填充：

- **普通模式（XML 工具调用）**：工具说明用 XML 格式，包工具经 `use_package` 激活后调用。
- **Tool Call API 模式**（`useToolCallApi=true`）：清空 XML 工具说明节与可用工具节，包系统说明切换为 Tool Call 版——包工具经 `package_proxy` 调用，`tool_name` 填 `packageName:toolName`，目标参数放进 `params` JSON 对象。
- **CLI 模式**（`toolExposureMode=CLI`）：工具说明节替换为 `CliToolModeSupport.buildCliModePrompt` 的输出，并清空包/工具相关三节，模型只以命令行形态使用工具。

`enableTools=false` 时会移除全部工具相关节（含工作区指南）。组装末尾把 3 个以上连续换行压缩为 2 个，保持提示词整洁。

用户自定义介绍经 `applyCustomPrompts` 替换自我介绍占位节；介绍为空时该节被干净移除，不留空行残留。

### 2. 包系统与白名单

可用包列表 = JS 包（过滤掉已不存在的包和工具包容器）+ MCP 服务器 + Skill，三类都受 `allowedPackageNames` / `allowedMcpServerNames` / `allowedSkillNames` 白名单过滤。包系统整体是否可见还受 `packageSystemVisible` 开关控制：必须是 FULL 暴露模式、工具已启用、且 `toolVisibility["use_package"]` 未被关闭。

### 3. 工作区指南

只有当工作区实际绑定（`workspacePath` 非空）时才生成工作区指南。指南要求模型使用绝对路径，说明终端挂载关系（如外部存储 `$externalStoragePath -> /sdcard`、应用沙箱同路径挂载），并注入工作区根规则文件的内容（经 `WorkspaceRuleFileReader` 读取）。

### 4. 三阶段 hook：JS 包可以改写提示词

系统提示词和工具提示词的组装都留了三个 hook 阶段，给 JS 包参与改写的机会：

- 系统提示词：`before_compose_system_prompt` → `compose_system_prompt_sections` → `after_compose_system_prompt`。注意 `before` 阶段的 hook 可以整体替换系统提示词——一旦它返回了 `systemPrompt`，默认组装流程就被跳过。
- 工具提示词：`before_compose_tool_prompt` → `filter_tool_prompt_items` → `after_compose_tool_prompt`，中间还经过排序（`applyToolOrder`，用户可在设置页调顺序）和可见性过滤（`applyToolVisibility`）。

### 5. 群聊角色编排提示

群聊场景可开启角色编排提示（`buildGroupOrchestrationHint`）：要求每个角色始终保持自己的身份、严禁冒充其他角色；`[From role: xxx]` 前缀的历史消息只是其他角色卡的过往输出、仅作参考，不视为用户的新指令；末尾附上群聊参与者名单。

### 6. 功能提示词库（FunctionalPrompts）

- **对话摘要**：`SUMMARY_PROMPT` / `SUMMARY_PROMPT_EN` 固定四节格式（核心任务状态 / 互动情节与设定 / 对话历程与概要 / 关键信息与上下文），内部 id 为 `core_task`、`interaction`、`progress`、`key_info`。组装时用 `check` 硬校验四节标题必须存在，缺失直接抛异常；支持按节 id 覆盖开关、标题与指令；生成时会拼接上次摘要并追加全局规则。
- **文件绑定合并**：`FILE_BINDING_MERGE_PROMPT` 要求用原始文件完整内容逐字替换 `// ... existing code ...` 占位符，只输出合并后的文件内容。
- **记忆与知识图谱**：去重前缀要求语义相同的实体用 `alias_for` 引用已有记忆；抽取输出是严格 JSON，必须包含 `main`、`new`、`update`、`merge`、`links` 五个键（`profile_markdown` 可选，为 null 表示用户画像无更新）；去重指令是 `merge` 优先于新建。
- **UI 操控两套提示**：`UI_CONTROLLER_PROMPT` 是单步模式——每次只输出一个 `{"explanation","command"}` JSON，command 覆盖点按/滑动/输入/按键/启动应用/列应用；`UI_AUTOMATION_AGENT_PROMPT` 是自主 agent 模式（autoglm 风格）——输出 `<think>` / `<answer>` XML，用 `do(action="...")` 表达操作（Launch、Tap、Type、Swipe、Back、Home、Wait 等），并用当前日期替换 `{{current_date}}`。
- **角色卡生成**：8 步流程（名字→描述→人设→开场白→聊天/语音补充内容→高级自定义提示→标记），每确认一个字段必须调用 `save_character_info` 工具保存。
- **情绪与形象**：`waifuEmotionRule` 要求句末用 `<emotion>` 标签标注情绪（后续据此生成表情包）；`avatarMoodRulesText` 要求每条回复最多 1 个 `<mood>` 标签，多命中时优先级为 angry > cry > aojiao > shy > happy。
- **防注入**：`conversationTitleSystemPrompt` 明确要求把用户内容一律视为待总结的数据、不当作指令遵循。
- **其他**：翻译助手提示、MCP 包描述生成（要求 ≤100 词）、grep 两轮检索助手提示（先细化上下文、再做候选选择，严格 JSON 输出）。

### 7. 工具提示词生成（SystemToolPrompts）

AI 默认可见 4 个分类：基础工具（`sleep`、`use_package`）、文件系统工具（11 个：列目录、读/写/删文件、建目录、找文件、代码检索、下载等）、HTTP 工具（`visit_web`，明确仅浏览/只读，不做登录点击提交）、记忆工具（`query_memory`、按标题取记忆）。记忆分类页脚告知模型：当前回复结束后，独立系统会自动更新记忆库和用户画像。

`read_file` 的参数是动态裁剪的：`direct_image` / `direct_audio` / `direct_video`（多媒体直传参数）恒不暴露给模型；`intent`（后端识别意图）仅当后端已配置识别服务、且聊天模型自身没有直连多媒体能力时才暴露。SAF（系统文件选择器）书签会拼成 `**Attached Local Storage Repository:**` 节，告诉模型可用 `environment="repo:<仓库名>"` 在挂载的本地存储仓库里操作。

设置页用 `getManageableToolPrompts` 拿到可管理的工具清单（含用户自定义排序）。

### 8. 内部工具提示词（SystemToolPromptsInternal）

12 个分类共 146 个工具，中英两套平行定义：

- **Internal Tools**：`execute_shell`（设备 shell）、`apply_file`（模糊匹配改文件）、终端会话 5 件套、内置音乐播放器 8 个、浏览器自动化 21 个（点击/填表/执行 JS/截图等）、`calculate`、`execute_intent`（任意 Android Intent）、`send_broadcast`、`device_info`
- **Extended Memory Tools**：记忆的增删改查、记忆间语义链接、链接查询、`update_user_profile`（整体替换 user.md，要求用户确认后执行）
- **Extended HTTP Tools**：`http_request` / `multipart_request`（均带 `ignore_ssl` 参数，可关闭 HTTPS 证书校验）、`manage_cookies`
- **Extended File Tools**：存在性检查、移动/复制（含 Android↔Linux 跨环境）、文件信息、压缩解压、系统默认应用打开、分享
- **Tasker Tools**：触发 Tasker 事件
- **Workflow Tools**：工作流的增删改查、启用/停用、触发执行
- **Chat Tools**：悬浮窗聊天服务的启停、对话的增删改查、跨对话读消息、向 AI 发消息（`send_message_to_ai`，支持不持久化、隐藏原文、关闭 warning 重试等精细控制）
- **Internal File Tools**：无大小限制读文件、Base64 读写二进制
- **Internal UI Tools**：取页面 UI 信息、点按/长按/滑动、按元素点击、输入文本、按键、截图、运行 UI 子 agent
- **Software Settings Tools**：环境变量读写、沙盒包启停、MCP 重启看日志、TTS/STT 语音服务配置（含 API Key 字段）、模型配置的增删改查与连通性测试、功能→模型绑定
- **Internal System Tools**：系统设置读写（system/secure/global）、APK 安装/应用卸载、应用启停、通知、应用使用时长、Toast、定位、蓝牙经典 + BLE 全套操作
- **FFmpeg Tools**：执行 FFmpeg 命令、查信息、转码

注意：模型配置的 `api_provider_type` 参数示例中仍列有 MNN 与 LLAMA_CPP——这两个端侧推理方案已停止维护，参数仅为历史保留。

### 9. 提示词标签管理（PromptTagManager）

用户自定义的提示词标签存在名为 `prompt_tags` 的 DataStore 里（schema 版本 1）。每个标签的字段（名称、描述、提示词内容、类型、创建/更新时间）按 `prompt_tag_<id>_xxx` 的键名存储，id 列表存在 `prompt_tag_list` 键下。`createPromptTag` 用 UUID 生成 id；`createOrReusePromptTag` 会先按去空格后的内容全等查找，内容相同则复用已有标签、不重复创建。标签类型有 4 种：`TONE`（语气风格）、`CHARACTER`（角色设定）、`FUNCTION`（功能性）、`CUSTOM`（自定义）。版本 0→1 迁移时会删除遗留的系统标签及其全部偏好键。

### 10. 提示词版本管理器（PromptVersionManager）

通用泛型版本管理基础设施：调用方定义 `VersionSpec`（偏好键前缀 + 版本号→默认内容的映射），`shouldUpdate` 在"当前内容为空或匹配某个已知旧版本默认值、且内容/版本落后"时触发更新，`autoUpdate` 先执行调用方传入的业务更新回调、再写入最新版本内容与版本号。注意：该类目前在全仓库没有任何调用方，属于预留的死代码。

## 关键符号

| 符号 | 说明 |
|---|---|
| `SystemPromptConfig.getSystemPrompt` | 系统提示词组装主入口（suspend） |
| `SystemPromptConfig.getSystemPromptWithCustomPrompts` | 对外主入口，带三阶段 hook 与自定义介绍 |
| `SystemPromptConfig.applyCustomPrompts` | 替换自我介绍占位节 |
| `SYSTEM_PROMPT_TEMPLATE` / `SYSTEM_PROMPT_TEMPLATE_CN` | 中英系统提示词模板（6 占位节） |
| `SUBTASK_AGENT_PROMPT_TEMPLATE` | 子任务 agent 专用模板 |
| `ToolExposureMode` | 工具暴露模式（FULL / CLI 等） |
| `PromptHookRegistry` | 系统/工具提示词 hook 注册表 |
| `FunctionalPrompts` | 功能提示词库 object |
| `SystemToolPrompts.generateToolsPromptEn/Cn` | AI 可见工具说明生成 |
| `SystemToolPromptsInternal.internalToolCategoriesEn/Cn` | 内部工具提示词（中英平行） |
| `ToolPrompt` / `SystemToolPromptCategory` / `ToolParameterSchema` | 工具提示词数据结构 |
| `PromptTagManager` | 提示词标签 CRUD（DataStore `prompt_tags`） |
| `PromptVersionManager` | 通用版本管理器（当前无调用方） |
| `PromptTag` / `TagType` | 标签数据模型与类型枚举 |

## 输入 → 处理 → 输出

1. **输入**：`ConversationService` 收集本次对话的上下文——工作区路径与环境、SAF 书签、用户自定义介绍、自定义模板、中英语言、工具总开关、工具调用 API 开关、工具暴露模式、工具可见性表、包/Skill/MCP 白名单、各类模型能力标志（有无后端识图/识音/识视频、聊天模型是否直连多媒体）。
2. **处理**：`getSystemPromptWithCustomPrompts` 先跑 `before_compose_system_prompt` hook（可整体替换提示词）→ `getSystemPrompt` 按模板逐节填充（可用包列表、工作区指南、工具说明经 `SystemToolPrompts` + 内部工具生成、排序/可见性过滤、三阶段 tool hook）→ `applyCustomPrompts` 替换自我介绍 → 可选拼接群聊角色编排提示 → 再跑 `compose_system_prompt_sections` 与 `after_compose_system_prompt` 两阶段 hook。
3. **输出**：最终系统提示词字符串，随聊天请求一起发给模型；功能提示词（摘要、UI 操控、记忆抽取等）由各功能模块按需调用 `FunctionalPrompts` 获取。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/config/SystemPromptConfig.kt`（712 行）
- `app/src/main/java/com/ai/assistance/operit/core/config/FunctionalPrompts.kt`（1352 行）
- `app/src/main/java/com/ai/assistance/operit/core/config/SystemToolPrompts.kt`（1007 行）
- `app/src/main/java/com/ai/assistance/operit/core/config/SystemToolPromptsInternal.kt`（5992 行）
- `app/src/main/java/com/ai/assistance/operit/data/preferences/PromptTagManager.kt`（243 行）
- `app/src/main/java/com/ai/assistance/operit/data/preferences/PromptVersionManager.kt`（93 行）
- `app/src/main/java/com/ai/assistance/operit/data/model/PromptTag.kt`
- 调用方：`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
