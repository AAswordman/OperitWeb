---
title: Operit-wiki 大纲 v3（草案）
module: meta
sources: [repo-map.json, outline-v3.yaml]
date: 2026-09-30
---

# Operit-wiki 大纲 v3（草案，待评审）

> 全量细粒度大纲：**116 页 / 11 章**，覆盖 app 模块 1359/1362 个 kt 文件（est. 478,237 行，不含 5 个总览页）。
> 替代已批准的 outline-v2（27 页）。v2 及 batch-01 的 5 页保留为历史/总览，不重做。
> 停维护的不覆盖：llm/mnn、llm/llama、avator/mmd（3 个文件已排除）。源码版本钉住 `dbf71916`（v1.12.2）。

## 章节与页面（共 116 页，est. 489,304 行）

### 架构总览（1 页，est. 976 行）
1. **整体架构（总览）** `arch-overview`（5 seeds, est. 976 行）

### 工具系统（13 页，est. 90,122 行）
2. **工具系统（总览）** `core-tools`（2 seeds, est. 830 行）
3. **工具注册与执行框架** `core-tools-registry`（7 seeds, est. 6,568 行）
4. **标准工具·文件系统** `core-tools-standard-filesystem`（1 seeds, est. 7,808 行） —— 本页仅覆盖 standard/ 下文件系统 3 件（StandardFileSystemTools/SafFileSystemTools/LinuxFileSystemTools）；目录内其他文件归属 core-tools-standard-webchat / core-tools-standard-system
5. **标准工具·浏览器/网络/聊天/工作流** `core-tools-standard-webchat`（1 seeds, est. 9,430 行） —— 本页仅覆盖 standard/ 下 StandardBrowserSessionTools、StandardWebVisitTool、StandardHttpTools、StandardChatManagerTool、StandardWorkflowTools、MemoryQueryToolExecutor 6 件；目录内其他文件归属 core-tools-standard-filesystem / core-tools-standard-system
6. **标准工具·系统操作/多媒体/UI** `core-tools-standard-system`（1 seeds, est. 8,164 行） —— 本页覆盖 standard/ 下其余 13 件（系统操作/软件设置/设备信息/广播/Intent/终端/Shell/蓝牙/音乐/FFmpeg/UI/计算器/Cookie）
7. **网页会话·浏览器宿主** `core-tools-websession-browser`（1 seeds, est. 8,225 行）
8. **网页会话·用户脚本引擎** `core-tools-websession-userscript`（1 seeds, est. 5,522 行）
9. **工具执行模式（Debugger/Root/无障碍/Admin）** `core-tools-execmodes`（6 seeds, est. 6,578 行）
10. **JS 引擎与 Java 互操作桥** `core-tools-jsengine`（1 seeds, est. 10,061 行） —— 本页仅覆盖 javascript/ 下引擎与桥接 12 件（JsEngine/JsJavaBridge/JsJavaBridgeDelegates 等）；脚本执行与注册 9 件归属 core-tools-jstools
11. **JS 工具脚本执行与注册** `core-tools-jstools`（1 seeds, est. 5,077 行） —— 本页仅覆盖 javascript/ 下 JsTools/JsExecutionScriptBuilder/JsToolPkgExecutionContext/JsToolPkgRegistration/JsToolManager/JsExecutionResultProtocol/JsExecutionTrace/ScriptExecutionReceiver/JsTimeoutConfig 9 件
12. **插件包（ToolPkg）管理与解析** `core-tools-packtool`（1 seeds, est. 9,791 行）
13. **系统底层能力（Shell 执行器/Action 监听器/终端/截屏投屏）** `core-tools-system`（1 seeds, est. 6,145 行）
14. **专项工具（PhoneAgent/计算器/MCP/Skill/CLI 模式/条件）** `core-tools-misc`（6 seeds, est. 5,923 行）

### 聊天与消息（2 页，est. 11,184 行）
15. **聊天与消息处理（总览）** `core-chat`（8 seeds, est. 9,000 行）
16. **聊天运行时（消息管理/Hook/插件）** `core-chat-runtime`（1 seeds, est. 2,184 行）

### 云端 Chat API（32 页，est. 30,186 行）
17. **云端 Chat API 接入（总览）** `api-chat`（2 seeds, est. 261 行）
18. **OpenAI 供应商** `api-chat-openai`（1 seeds, est. 3,509 行）
19. **Gemini 供应商** `api-chat-gemini`（1 seeds, est. 2,252 行）
20. **Claude 供应商** `api-chat-claude`（1 seeds, est. 2,080 行）
21. **DeepSeek 供应商** `api-chat-deepseek`（1 seeds, est. 1,462 行）
22. **MNN 端侧供应商（已停止维护）** `api-chat-mnn`（1 seeds, est. 1,021 行） —— 端侧 MNN 引擎已长期停止维护，本页仅存档封装层实现
23. **OpenAI Responses 供应商** `api-chat-openai-responses`（1 seeds, est. 791 行）
24. **Kimi 供应商** `api-chat-kimi`（1 seeds, est. 512 行）
25. **OpenCode 供应商** `api-chat-opencode`（1 seeds, est. 434 行）
26. **Llama 端侧供应商（已停止维护）** `api-chat-llama`（1 seeds, est. 410 行） —— 端侧 Llama 引擎已长期停止维护，本页仅存档封装层实现
27. **Codex 供应商** `api-chat-codex`（1 seeds, est. 303 行）
28. **OpenRouter 供应商** `api-chat-openrouter`（1 seeds, est. 129 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
29. **通义千问供应商** `api-chat-qwen`（1 seeds, est. 125 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
30. **Mistral 供应商** `api-chat-mistral`（1 seeds, est. 95 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
31. **NVIDIA AI 供应商** `api-chat-nvidia`（1 seeds, est. 81 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
32. **xAI 供应商** `api-chat-xai`（1 seeds, est. 75 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
33. **豆包供应商** `api-chat-doubao`（1 seeds, est. 73 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
34. **小米 Mimo 供应商** `api-chat-mimo`（1 seeds, est. 48 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
35. **Ollama 供应商** `api-chat-ollama`（1 seeds, est. 36 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
36. **NousPortal 供应商** `api-chat-nousportal`（1 seeds, est. 32 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
37. **FourRouter 供应商** `api-chat-fourrouter`（1 seeds, est. 32 行） —— 小体量供应商，多为 OpenAI 兼容接口的薄封装
38. **Key 池轮询（ApiKeyProvider）** `api-chat-keypool`（2 seeds, est. 317 行） —— ApiKeyProvider 不是供应商而是密钥池机制，独立成页
39. **供应商接入基础设施** `api-chat-providers-base`（6 seeds, est. 1,736 行）
40. **thinking 配置机制** `api-chat-thinking`（1 seeds, est. 581 行）
41. **统一参数模型与自定义参数** `api-chat-params`（2 seeds, est. 411 行） —— api/ 内无独立统一参数模型文件，自定义参数以内联方式散落在各 Provider
42. **错误/限流/重试** `api-chat-errors`（6 seeds, est. 256 行）
43. **工具调用与流式协议** `api-chat-tools-stream`（2 seeds, est. 1,572 行）
44. **Token 统计与 usage 上报** `api-chat-tokens`（1 seeds, est. 360 行）
45. **多模态媒体链接与能力探测** `api-chat-media`（3 seeds, est. 321 行）
46. **对话编排运行时** `api-chat-runtime`（4 seeds, est. 5,514 行）
47. **对话增强管线** `api-chat-enhance`（1 seeds, est. 3,763 行）
48. **会话记忆与上下文总结** `api-chat-memory`（1 seeds, est. 1,594 行）

### 语音服务（2 页，est. 9,855 行）
49. **语音识别流水线** `api-speech`（1 seeds, est. 4,147 行）
50. **语音合成（TTS）服务** `api-voice`（1 seeds, est. 5,708 行）

### 数据层（14 页，est. 45,546 行）
51. **数据模型（总览）** `data-model`（0 seeds, est. 0 行） —— 总览页已评审通过，seed_files 待补；细分见本章 data-* 各页
52. **Room 数据库与 DAO** `data-room-db`（2 seeds, est. 1,901 行）
53. **数据模型与实体类** `data-models`（2 seeds, est. 3,669 行）
54. **记忆仓库** `data-repo-memory`（2 seeds, est. 2,939 行）
55. **聊天历史仓库** `data-repo-chat`（1 seeds, est. 2,889 行）
56. **扩展仓库（Avatar/表情/工作流/Skill/插件黑名单/UI 层级）** `data-repo-misc`（3 seeds, est. 3,856 行） —— repository/ 下 MemoryRepository、MemoryAutoSaveCandidateRepository、ChatHistoryManager 归属 data-repo-memory / data-repo-chat，本页为其余 5 文件
57. **模型与 API 配置（偏好设置）** `data-prefs-model`（1 seeds, est. 2,802 行） —— 本页仅覆盖 preferences/ 下模型与 API 配置 9 文件（ModelConfigManager、ApiPreferences、GitHubAuthPreferences 等）
58. **角色卡与人格配置** `data-prefs-character`（1 seeds, est. 3,687 行） —— 本页仅覆盖 preferences/ 下角色卡与人格 10 文件（CharacterCardManager、PromptTagManager 等）
59. **应用基础/主题/语音/记忆搜索配置** `data-prefs-app`（1 seeds, est. 3,843 行） —— 本页覆盖 preferences/ 下其余 18 文件
60. **Token 用量统计与模型定价数据** `data-stats-pricing`（2 seeds, est. 3,416 行）
61. **数据备份、恢复与导入导出** `data-backup-export`（4 seeds, est. 4,796 行）
62. **MCP 服务与插件桥接** `data-mcp`（1 seeds, est. 6,973 行）
63. **OAuth 与外部 API 客户端** `data-api-oauth`（1 seeds, est. 2,885 行）
64. **应用更新与公告** `data-update-announce`（2 seeds, est. 1,890 行）

### 引擎其他（4 页，est. 18,800 行）
65. **虚拟形象引擎** `core-avatar`（7 seeds, est. 4,777 行） —— avatar/impl/mmd/（3 文件/373 行）已停止维护，不在 seed 内
66. **系统提示词与功能提示配置** `core-config-prompts`（1 seeds, est. 9,063 行）
67. **应用生命周期、性能监控与工作流调度** `core-app-workflow`（3 seeds, est. 3,421 行）
68. **安装包编辑与逆向（APK/EXE）** `core-subpack`（1 seeds, est. 1,539 行）

### 系统服务与集成（6 页，est. 25,259 行）
69. **聊天服务核心 Delegate 群** `services-chatservice`（1 seeds, est. 7,954 行） —— 与 batch-01/core-chat 有重叠，本页深挖 Delegate 级实现细节
70. **系统服务与悬浮窗** `services-system`（10 seeds, est. 3,728 行）
71. **插件机制与工具包桥接** `plugins`（1 seeds, est. 3,911 行）
72. **WebChat 本地 HTTP 服务** `integrations-webchat`（1 seeds, est. 4,671 行）
73. **外部聊天入口与自动化集成** `integrations-external`（4 seeds, est. 2,018 行）
74. **桌面小组件与文档提供器** `widget-provider`（2 seeds, est. 2,977 行）

### 工具函数库（6 页，est. 16,466 行）
75. **文件、媒体与文档处理工具** `util-file-media`（19 seeds, est. 5,819 行）
76. **消息渲染与文本处理** `util-text-chat`（13 seeds, est. 3,263 行）
77. **响应式流框架** `util-stream-core`（10 seeds, est. 2,689 行） —— stream/plugins/ 归属 util-stream-parse
78. **流式内容解析插件与原生实现** `util-stream-parse`（2 seeds, est. 2,551 行）
79. **系统诊断、日志与平台服务** `util-system`（16 seeds, est. 2,001 行）
80. **向量索引与本地检索** `util-search`（2 seeds, est. 143 行）

### 用户界面（32 页，est. 220,372 行）
81. **聊天主界面与状态管理** `ui-chat-screen`（5 seeds, est. 9,081 行）
82. **聊天消息内容区与交互组件** `ui-chat-components`（28 seeds, est. 10,817 行） —— components/ 根目录 28 文件（ChatHistorySelector.kt 归属 ui-chat-screen；lazy/part/style/input/attachments/config 子目录各有独立页）
83. **聊天输入区** `ui-chat-input`（1 seeds, est. 7,037 行）
84. **消息气泡与样式** `ui-chat-styles`（3 seeds, est. 4,023 行） —— style/input/ 归属 ui-chat-input
85. **消息体渲染（XML/工具调用/文件差异）** `ui-chat-parts`（3 seeds, est. 5,282 行）
86. **本地化 LazyColumn 聊天列表** `ui-chat-lazylist`（1 seeds, est. 10,029 行） —— 本地化的 androidx LazyColumn 源码，抽取时聚焦"魔改点/为何本地化"而非复读上游逻辑
87. **工作区与 WebView 基础设施** `ui-chat-workspace`（17 seeds, est. 9,758 行） —— webview/ 根 4 文件（LocalWebServer/WebViewHandler 等）+ workspace 根文件 + workspace/process + webview/computer；editor/ 归属 ui-chat-editor
88. **内置代码编辑器** `ui-chat-editor`（1 seeds, est. 5,416 行）
89. **模型与提示词配置界面** `ui-settings-model`（8 seeds, est. 11,349 行）
90. **主题与显示设置界面** `ui-settings-theme`（15 seeds, est. 12,184 行）
91. **聊天/备份/历史设置界面** `ui-settings-chat`（13 seeds, est. 9,341 行）
92. **偏好与其他设置界面** `ui-settings-misc`（14 seeds, est. 9,989 行）
93. **扩展包管理界面** `ui-packages-manager`（14 seeds, est. 6,395 行） —— packages/components/ 根文件以实际为准；components/dialogs/ 归属 ui-packages-mcp
94. **扩展市场浏览界面** `ui-packages-market`（21 seeds, est. 7,527 行）
95. **扩展发布界面** `ui-packages-publish`（10 seeds, est. 5,450 行）
96. **MCP 配置与部署界面** `ui-packages-mcp`（4 seeds, est. 5,097 行）
97. **文件管理器界面** `ui-toolbox-filemanager`（1 seeds, est. 3,533 行）
98. **开发调试工具界面** `ui-toolbox-dev`（6 seeds, est. 5,035 行）
99. **系统与媒体工具界面** `ui-toolbox-apps`（10 seeds, est. 6,046 行）
100. **工具包 Compose DSL 渲染** `ui-common-dsl`（1 seeds, est. 11,098 行）
101. **Markdown 与富文本渲染** `ui-common-markdown`（2 seeds, est. 10,947 行）
102. **主界面框架与导航** `ui-main`（9 seeds, est. 7,568 行）
103. **悬浮窗界面** `ui-floating`（1 seeds, est. 8,093 行） —— floating/ui/pet/AvatarEmotionManager.kt（108 行，avatar 相关）已排除
104. **记忆/知识库界面** `ui-memory`（1 seeds, est. 5,150 行）
105. **Token 用量统计界面** `ui-tokenstats`（1 seeds, est. 4,862 行）
106. **工作流界面** `ui-workflow`（1 seeds, est. 7,032 行）
107. **内置浏览器界面** `ui-websession`（1 seeds, est. 3,531 行）
108. **助手配置界面** `ui-assistant`（1 seeds, est. 3,118 行）
109. **权限引导与演示界面** `ui-demo`（1 seeds, est. 4,761 行）
110. **权限与 Token 配置界面** `ui-permission`（3 seeds, est. 3,208 行）
111. **关于/更新/登录/帮助界面** `ui-about`（8 seeds, est. 4,123 行）
112. **启动/恢复/性能界面** `ui-startup`（3 seeds, est. 3,492 行）

### 附录（4 页，est. 20,538 行）
113. **单元测试·api/core（附录）** `appendix-tests-unit-api-core`（2 seeds, est. 7,608 行） —— 附录页，非产品代码
114. **单元测试·data（附录）** `appendix-tests-unit-data`（3 seeds, est. 4,343 行） —— 附录页，非产品代码
115. **单元测试·ui/util（附录）** `appendix-tests-unit-ui-util`（2 seeds, est. 3,248 行） —— 附录页，非产品代码
116. **插桩测试、模板与本地化三方源码（附录）** `appendix-tests-android`（5 seeds, est. 5,339 行） —— 附录页，非产品代码

## 请你重点评审

1. 116 页的拆分粒度合适吗？有没有过细/过粗、需要合并或再拆的？
2. 21 个供应商页 + 7 个跨供应商机制页的划分有没有遗漏的机制？
3. 83 个文件的跨页拆分（notes 中注明归属）划分得对吗？
4. 42 个 est.<3000 行的小页（多为小供应商）可以接受吗，还是合并？
5. 章节结构（11 章）合理吗？
