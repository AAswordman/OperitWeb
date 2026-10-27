---
title: Operit-wiki 大纲（定稿）
module: meta
sources: [repo-map.json, dep-graph.json, modules.md, outline.yaml]
date: 2026-09-30
---

# Operit-wiki 大纲（定稿 v2）

> 状态：已批准（2026-09-30，用户评审通过，git tag `outline-v2`）。mnn/llama/mmd 等端侧推理模块已停止维护，不再覆盖。

> 生成依据：阶段 0 确定性脚本统计（`scripts/repo_map.py`）+ 人工通读仓库补遗，全部数字来自实际扫描，未做推测。
> 仓库事实：**app 模块占 1362/1402 个 kt 文件、4961/5039 个符号**，是绝对主体；其余 8 个模块合计 40 个 kt 文件。
> terminal 模块代码在独立仓库 `AAswordman/OperitTerminalCore`（47 kt），主仓库 settings 仅注册 `:terminal`。

## 章节与页面（共 27 页）

### 架构总览
1. **整体架构** —— Gradle 模块如何划分？各模块职责是什么？；模块间依赖方向是怎样的（dep-graph 显示全部以 app 为起点）？

### Agent 核心
2. **工具系统** —— 工具（Tool）如何定义、注册、发现？；工具调用的完整链路：模型输出 → 解析 → 执行 → 结果回填？
3. **聊天与消息处理** —— 一条用户消息从进入到回复的完整处理链？；各 Delegate（MessageProcessing/ChatHistory/TokenStatistics）如何分工？
4. **工作流引擎** —— 工作流的定义格式与执行语义？；工作流与单次工具调用的区别？
5. **虚拟形象（Avatar）** —— Avatar 子系统的职责边界？；dragonbones/fbx 两个 native 模块分别承担什么渲染能力？（注：mmd 已停止维护）
6. **配置体系** —— 配置项如何分层（应用/模型/功能）？；配置的读写链路：UI → preferences → 生效？
7. **角色卡与人设** —— 角色卡（酒馆卡兼容）的数据结构：CharacterCard / CharacterGroupCard？；角色卡如何与聊天绑定（模型绑定、记忆绑定）？

### 模型接入
8. **云端 Chat API 接入** —— 支持哪些云端模型渠道？如何新增一个渠道？；请求构造、流式响应的处理链路？
9. **语音能力（ASR/TTS）** —— 语音识别与语音合成的链路？；与聊天流程如何衔接？
10. **第三方 OAuth 接入** —— Codex / GitHub OAuth 的授权流程？；token 如何存储与刷新？

### 数据层
11. **数据模型** —— 核心实体（会话/消息/工具调用记录）的数据模型？；数据库选型与 DAO 分层？
12. **MCP 集成** —— MCP server 如何配置与连接？；MCP 工具如何汇入工具系统？
13. **备份、恢复与导出** —— 备份的数据范围与格式？；恢复与导出的链路？
14. **记忆系统** —— 记忆空间 MemorySpace 的设计：空间如何划分与隔离？；记忆自动保存的触发机制（MemoryAutoSaveScheduler）？

### 界面
15. **聊天界面** —— 聊天界面的主要组件与状态管理？；175 个文件按什么粒度组织？
16. **设置界面** —— 设置页的信息架构？；设置项与 core-config 的绑定方式？
17. **工具箱与技能包界面** —— 工具箱与 packages（技能包）两个功能的区别？；技能包的安装、管理、启用链路？
18. **悬浮窗与主界面框架** —— 悬浮窗的启动、权限、生命周期？；主界面的导航结构？
19. **其他功能页** —— memory / websession / assistant / tokenstats 各自解决什么问题？；记忆（memory）功能的数据链路？

### 脚本与扩展
20. **QuickJS 脚本引擎** —— QuickJS 在 Operit 里承担什么角色？；脚本如何调用 Android/工具能力？安全边界？
21. **插件与集成** —— plugins 与 integrations 的区别？；第三方如何开发一个插件？
22. **应用包编辑（APK/EXE）** —— subpack（子包）功能的定位：APK/EXE 编辑与逆向？；ApkEditor / ApkReverseEngineer 的能力边界？

### 周边模块
23. **Shower 客户端库** —— showerclient 的职责？（按 README 原文）；app 如何依赖它（dep-graph：app→showerclient 权重 9）？
24. **web-chat 前端** —— web-chat（Vite+TS）是什么？与 Android 端的关系？；它消费哪些后端/API？
25. **终端模块 TerminalCore（独立仓库）** —— terminal 模块代码在独立仓库 AAswordman/OperitTerminalCore（47 kt），主仓库 settings 仅注册 :terminal，目录为空：两者如何关联（submodule / composite build）？；TerminalManager 单例的职责边界？SessionManager / TerminalSession / Pty 各自负责什么？
26. **系统集成能力** —— DocumentsProvider 把哪些数据暴露给系统文件管理器？；桌面小部件（工具包小部件、语音助手小部件）的能力与配置流程？

### 附录
27. **工具类与后台服务** —— util 下 131 个文件的主要分组？；services 下的后台服务有哪些？各自的触发条件？

## 请你重点评审

1. 章节切分是否合理？有没有漏掉你关心的部分？
2. v2 新增的 4 页（记忆系统、角色卡与人设、应用包编辑、系统集成）粒度合适吗？
3. `terminal` 现已确认为独立仓库 `AAswordman/OperitTerminalCore`，说明页这样写可以吗？
4. `ui/features` 下 21 个功能目录合并为 5 页，粒度合适吗？
5. 以下模块职责脚本找不到出处，标了"未知，需人工确认"，你方便各补一句话吗：**app、mnn、llama、mmd、fbx**

## 来源

- `wiki-work/repo-map.json`（3067 文件 / 1402 kt / 5039 顶层符号，零声明文件 0%）
- `wiki-work/dep-graph.json`（8 条模块依赖边，全部以 app 为起点）
- `wiki-work/modules.md`
- `~/workspace/Operit/Repo_Arch_Basic.md`、`README.md`（项目介绍原文引用）
- `AAswordman/OperitTerminalCore` 的 README（终端模块职责原文）
- `AAswordman/OperitWeb/docs/`（插件市场接口、审核规范、拒绝名单、GitHub OAuth Broker）
