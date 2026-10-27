---
title: 插件能力目录
module: 附录
sources: 31
date: 2026-10-02
issue: 138
---

# appendix-plugin-capabilities（插件能力目录）

> 种子：`app/src/main/assets/packages/`（31 个 JS 沙盒包）+ 插件机制代码（`core/tools/packTool/`、`core/tools/skill/`、`data/mcp/`）@ `dbf71916`

> 一句话：本体原生能力之外，AI 的全部扩展能力来自插件。31 个随 APK 内置的 JS 沙盒包是主力——生图、12306 查票、学术搜索这些原生没有的东西，全是插件给的；市场还有 QQbot 等外部插件。

## 概述

人话：Operit 本体是个"裸机"——能聊天、能调工具、能上网，但不会画画、不会查 12306 余票、不会接 QQ。装上插件之后，AI 才长出这些本事。本页是一张"能力目录"：哪个插件给 AI 加了什么本事、要不要配 Key、是不是默认开的。

wiki 其他页讲的是插件**机制**（包怎么解析、JS 怎么跑、MCP 怎么桥接）；本页讲的是插件**能力**（装完之后 AI 到底多会干什么）。机制页见 `data-mcp`（MCP 桥接）、`ui-packages-manager`（包管理界面）。

## AI 速览

- **核心符号清单**：`PackageManager`（沙盒包加载/启用）、`JsTools`（JS 包执行）、`ToolPackage`（bundle 容器包数据模型）、`MCPRepository`（MCP 插件仓库）、`RemoteMcpRuntimeSession`（远程 MCP 会话）、`SkillPackage`（Skill 包）、`enabledByDefault`（默认启用标记）、`isBuiltIn`（内置标记）。
- **主入口**：`PackageManager` 从 APK assets 加载 31 个内置包（`isBuiltIn=true`），`enabledByDefault=true` 的 18 个自动启用；用户在"包管理"界面开关；MCP 插件经 `MCPRepository` 注册进 AI 运行时。
- **数据流向一句话**：APK assets 内置包 → `PackageManager` 解析元数据 → 默认启用的自动进 AI 工具注册表 → 用户手动开其余包；市场 bundle / MCP 插件走各自通道注册；AI 调用时统一走工具执行器。

## 四种插件形态

人话：插件有四种"物种"，住的地方和来源都不一样。

- **JS 沙盒包**：单个 `.js` 文件，跑在 QuickJS 沙盒里。31 个随 APK 内置，放在 `app/src/main/assets/packages/`；加载时标记 `isBuiltIn=true`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1274`）。元数据用 Hjson 解析，`enabledByDefault` 字段决定是否默认启用（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:126`）；18 个默认启用的在启动时自动进工具注册表（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1792`）。管理入口：包管理 → 沙盒包标签页。
- **ToolPkg / bundle 容器包**：打包的工具包，有 bundle id（如 `com.operit.QQbot`）。数据模型是 `ToolPackage`（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:301`）。走市场分发，不在 APK 里。
- **MCP 插件**：外部 MCP 服务器。本地经 Node bridge 的 TCP 启动，远程经 Kotlin MCP SDK 直连；`MCPRepository` 管插件的安装卸载与状态（`app/src/main/java/com/ai/assistance/operit/data/mcp/MCPRepository.kt:50`）。启用后工具以 `"$pluginId:$toolName"` 的名字注册进 AI 运行时。管理入口：包管理 → MCP。
- **Skill 包**：`SkillPackage` 数据类确认存在（`app/src/main/java/com/ai/assistance/operit/core/tools/skill/SkillPackage.kt:5`），含 name/description/directory/skillFile 四个字段；文档极少，本页不展开。

## 31 个内置包能力全表

人话：下面 31 个全是随 APK 内置的，开箱就有（18 个默认启用，其余手动开）。"配置要求"列的是包头元数据里声明的环境变量，没写的就是零配置直接用。

### 生图（7 个）——原生完全没有此能力

- `openai_draw`（OpenAI 绘图）：OpenAI 格式图像生成 API（`/v1/images/generations`）文生图，图片存 `/sdcard/Download/Operit/plugins/draw/openai_draw/draws/`。配置：`OPENAI_API_KEY`（必填）、`OPENAI_API_BASE_URL`、`OPENAI_IMAGE_MODEL`（`app/src/main/assets/packages/openai_draw.js:16`）。
- `zhipu_draw`（智谱生图）：智谱 AI 图像生成 API 文生图。配置：`ZHIPU_API_KEY`、`ZHIPU_IMAGE_MODEL`（如 `cogview-3-flash`）（`app/src/main/assets/packages/zhipu_draw.js:14`）。
- `qwen_draw`（Qwen 绘图）：阿里云百炼/DashScope 文生图（通义万相，异步任务轮询）。配置：`DASHSCOPE_API_KEY`、`DASHSCOPE_API_BASE_URL`、`QWEN_IMAGE_MODEL`（`app/src/main/assets/packages/qwen_draw.js:15`）。
- `siliconflow_draw`（硅基流动绘图）：图像 + 视频双能力，图片走 `/v1/images/generations`，视频走 `/v1/video/submit` + `/v1/video/status`。配置：`SILICONFLOW_API_KEY`、`SILICONFLOW_API_BASE_URL`、`SILICONFLOW_IMAGE_MODEL`、`SILICONFLOW_VIDEO_MODEL`（`app/src/main/assets/packages/siliconflow_draw.js:15`）。
- `xai_draw`（xAI 图片与视频）：xAI 官方接口生图 + 生视频。配置：`XAI_API_KEY`、`XAI_API_BASE_URL`、`XAI_IMAGE_MODEL`、`XAI_VIDEO_MODEL`（`app/src/main/assets/packages/xai_draw.js:14`）。
- `minimax_draw`（MiniMax 绘图）：MiniMax 图像生成（`/v1/image_generation`），文生图 + 参考图生图。配置：`MINIMAX_API_KEY`、`MINIMAX_API_BASE_URL`、`MINIMAX_IMAGE_MODEL`、`BEEIMG_API_KEY`（`app/src/main/assets/packages/minimax_draw.js:15`）。
- `nanobanana_draw`（Nanobanana 绘图）：Nano Banana 文生图/图生图（本地图片先上传图床拿公网 URL）。配置：`NANOBANANA_API_KEY`、`NANOBANANA_API_BASE_URL`、`BEEIMG_API_KEY`（`app/src/main/assets/packages/nanobanana_draw.js:14`）。

生图包的详细配置流程见教程区 issue #129（包管理 → 沙盒包 → 齿轮 → 配置环境变量），本页不重复。

### 联网搜索（6 个）——原生只有网页访问，无 AI 搜索 API

- `tavily`（Tavily 搜索）：高级网络搜索、内容提取、网站爬取、站点地图生成。配置：`TAVILY_API_KEY`（必填，无 Key 直接抛错）（`app/src/main/assets/packages/tavily.js:14`）。
- `duckduckgo`（DuckDuckGo 搜索）：网络搜索 + 内容抓取。零配置（`app/src/main/assets/packages/duckduckgo.js:4`）。
- `google_search`（Google 搜索）：普通搜索 + Google Scholar 学术搜索，可设语言与返回条数。零配置（`app/src/main/assets/packages/google_search.js:3`）。
- `various_search`（多平台搜索）：必应/百度/搜狗/夸克多平台搜索（含图片搜索），**默认启用**。零配置（`app/src/main/assets/packages/various_search.js:11`）。
- `zhipu_search`（智谱搜索）：智谱独立搜索 API，返回结构化结果。配置：`ZHIPU_SEARCH_API_KEY`（`app/src/main/assets/packages/zhipu_search.js:15`）。
- `crossref`（Crossref 学术文献查询）：DOI 查询、关键词搜索、作者搜索，**默认启用**。零配置（`app/src/main/assets/packages/crossref.js:13`）。

### 生活系统（6 个）

- `12306_ticket`（12306 拓展）：12306 余票、中转、经停站查询，**默认启用**。零配置（`app/src/main/assets/packages/12306.js:10`）。
- `daily_life`（日常生活工具包）：天气、短信、电话、微信/QQ 单条消息、朋友圈发布、闹钟、截图拍照等 30+ 工具，**默认启用**。零配置（`app/src/main/assets/packages/daily_life.js:11`）。
- `system_tools`（系统工具）：设置管理、应用安装卸载启动、通知获取、位置服务、Intent/广播调用，**默认启用**。零配置（`app/src/main/assets/packages/system_tools.js:13`）。
- `super_admin`（超级管理员）：终端命令与 Shell 高级功能（terminal 跑在 Ubuntu 环境，shell 经 Shizuku/Root 直调 Android 命令），**默认启用**。零配置（`app/src/main/assets/packages/super_admin.js:11`）。
- `automatic_ui_base`（自动化基础工具）：UI 自动化基础操作（点击、滑动、输入），**默认启用**。零配置（`app/src/main/assets/packages/automatic_ui_base.js:11`）。
- `automatic_ui_subagent`（自动化 AutoGLM 子代理）：主屏运行 UI 子代理，按自然语言意图自动规划执行界面操作。默认**关闭**，零配置（`app/src/main/assets/packages/automatic_ui_subagent.js:29`）。

### 开发效率（12 个）

- `github`（GitHub API）：GitHub REST API 工具集（仓库/Issue/PR/文件提交/分支）+ 本地 apply_file。配置：`GITHUB_TOKEN`、`GITHUB_API_BASE_URL`（`app/src/main/assets/packages/github.js:13`）。
- `code_runner`（代码运行器）：JS/Python/Ruby/Go/Rust/C/C++ 多语言代码执行，**默认启用**。零配置（`app/src/main/assets/packages/code_runner.js:9`）。
- `browser`（Browser 自动化操作）：对齐 Playwright MCP 默认 browser 工具面的浏览器自动化，**默认启用**。零配置（`app/src/main/assets/packages/browser.js:12`）。
- `ffmpeg`（FFmpeg 工具集）：多媒体内容处理，**默认启用**。零配置（`app/src/main/assets/packages/ffmpeg.js:13`）。
- `file_converter`（文件转换器）：音视频/图像/文档格式互转，**默认启用**。零配置（`app/src/main/assets/packages/file_converter.js:13`）。
- `extended_chat`（增强对话）：对话增删改查、跨话题读消息、角色卡绑定对话，**默认启用**。零配置（`app/src/main/assets/packages/extended_chat.js:13`）。
- `extended_file_tools`（增强文件工具）：file_exists/move/copy/info、zip/unzip、open/share，**默认启用**。零配置（`app/src/main/assets/packages/extended_file_tools.js:14`）。
- `extended_http_tools`（增强 HTTP 工具）：文件上传、GET/POST 网络直访，**默认启用**。零配置（`app/src/main/assets/packages/extended_http_tools.js:13`）。
- `extended_memory_tools`（增强记忆工具）：记忆增删改查/链接、用户偏好更新，**默认启用**。零配置（`app/src/main/assets/packages/extended_memory_tools.js:14`）。
- `operit_editor`（Operit 平台编辑器）：平台配置直改（MCP/Skill/沙盒包/角色卡/模型参数/TTS/STT），**默认启用**。零配置（`app/src/main/assets/packages/operit_editor.js:13`）。
- `time`（时间）：时间相关功能，**默认启用**。零配置（`app/src/main/assets/packages/time.js:13`）。
- `workflow`（工作流管理）：工作流列表/创建/触发/管理，**默认启用**。零配置（`app/src/main/assets/packages/workflow.js:14`）。

## 市场与外部插件（社群经验，非代码事实）

> 口径声明：以下插件在源码全仓无对应（`grep` 无命中），结论来自社群文档与教程区，是用户经验不是代码事实，不要当代码引用。

- **QQbot 工具包**（bundle id `com.operit.QQbot`）：QQ 官方 Bot 接入——Gateway WebSocket 收消息、群/C2C 发消息、监听开关 + 自动回复。配置：去 `q.qq.com` 申请 QQ 机器人拿 AppID/AppSecret，未过审开沙盒模式。来源：社群文档"关于QQbot插件.txt"。注意：对话里必须关流式输出，否则逐字刷屏（社群案例"流式输出导致QQbot乱回复"）。
- **APK 逆向工具包**：基于内置 dex-jar 运行时的 APK 逆向能力，包管理开开关即用。来源：社群文档"关于APK逆向工具包.txt"。
- **Windows 工具包**：手机-Windows 联动（PC 端运行 agent，同一局域网下发任务/连接认证）。来源：社群文档"关于Windows工具包相关文件.txt"。
- **MCP 插件**：任意外部 MCP 服务器的能力（Filesystem、GitHub MCP 等），配置各插件自定。来源：教程区 issue #127 + wiki `data-mcp` 页（机制部分是代码事实）。

## 原生 vs 插件能力边界

人话：下面四项是"本体打死也不会，装了插件才会"——源码里原生代码零对应，实锤为纯插件能力。另有两项是增强/重叠关系。

- **生图/生视频**：`app/src/main/java` 下搜 `images/generations`、`textToImage` **零命中**——原生没有任何图像生成代码；7 个生图包是唯一来源。纯插件能力。
- **12306 余票查询**：原生只有"铁路12306 → com.MobileTicket"的 App **启动映射**（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:87`），没有余票查询接口；`12306_ticket` 包提供 25 个查询工具。纯插件能力。
- **GitHub 仓库操作（AI 可调用）**：原生 GitHub REST 客户端（`app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt:149`）虽然完整，但只被内部服务调用（`UpdateManager` 应用更新、`MarketInteractionController` 插件市场），`ToolRegistration.kt` 里**零注册**为 AI 工具；AI 能用的 GitHub 能力（54 个工具）只来自 `github` 沙盒包。纯插件能力（AI 视角）。
- **QQ 接入**：全仓搜 `QQbot` **零命中**；`com.operit.QQbot` bundle 是唯一来源。纯插件能力。
- **联网搜索**：原生有 `StandardWebVisitTool`（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:93`）网页访问能力；插件提供的是 AI 搜索 API（Tavily 等结构化搜索）。**增强关系**，非独占。
- **FFmpeg**：原生有 `StandardFFmpegToolExecutor`（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:17`）；`ffmpeg` 沙盒包是同一能力的另一封装。**重叠关系**。

## 来源

- 31 个包的能力/配置/默认启用：各包 `/* METADATA */` 头（`app/src/main/assets/packages/*.js`），Hjson 解析（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2467`）。
- 四种插件形态：`PackageManager.kt`、`ToolPackage.kt`、`MCPRepository.kt`、`SkillPackage.kt`（见正文引用）。
- 市场/外部插件：社群文档"关于QQbot插件.txt"、"关于APK逆向工具包.txt"、"关于Windows工具包相关文件.txt"，教程区 issue #127（MCP）、#129（生图配置）。
- 边界表阴性结论：源码 `grep` 实测（`images/generations`、`QQbot` 零命中；`GitHubApiService` 仅内部调用）。
