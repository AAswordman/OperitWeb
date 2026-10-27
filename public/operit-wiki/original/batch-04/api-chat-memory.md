---
title: 会话记忆与上下文总结
module: app
sources: 5
date: 2026-10-01
---

## 概述

聊天产生大量对话，没人能每次都从头复述背景。**会话记忆**就是 App 的"笔记本"：它把聊过的内容提炼成结构化的记忆节点（事件、人物、结论），存成一张**记忆图谱**（节点是记忆，边是它们之间的关系），下次聊天时自动翻出来做上下文。

这一页讲记忆的三个入口：**手动/自动保存**（聊完提炼进图谱）、**自动分类**（给没进文件夹的记忆归类）、**重建**（把历史聊天批量重提炼进记忆）。记忆空间（memory space）是多套隔离的记忆集合，不同角色卡可以绑定不同的记忆空间。

## AI 速览

核心符号清单（一行一个 `符号 — 一句话职责`）：

- `MemoryLibrary` — 记忆库单例：AI 分析对话并写入记忆图谱的总入口
- `MemoryLibrary.saveMemoryNow` — 同步保存记忆（默认分析最近 10 条历史）
- `MemoryLibrary.saveMemoryAsync` — 后台协程保存记忆，带成功/失败回调
- `MemoryLibrary.saveMemoryWindowNow` — 按指定历史条数保存（重建流程用）
- `MemoryLibrary.autoCategorizeMemoriesAsync` — 后台给未分类记忆自动归文件夹
- `MemoryLibrary.ParsedAnalysis` — AI 返回的分析结果结构（main/new/update/merge/links/profile_markdown）
- `MemoryAutoSaveScheduler` — 每分钟 tick 的定时器，攒够候选自动提炼记忆
- `ChatMemoryRebuildManager` — 把历史聊天切窗、逐窗重提炼进记忆的管理器
- `ChatMemoryWindowPlanner` — 按"一问一答"切分聊天窗口的规划器（窗口 8–48 条，默认 32）
- `ChatMemoryRebuildTimeScope` — 重建范围：整聊（EntireChat）或日期区间（InclusiveLocalRange）
- `MemoryRepository` — 记忆的增删改查与图谱边存储（searchMemories/linkMemories/mergeMemories/updateMemory）

主入口：`MemoryLibrary.saveMemoryNow(context, toolHandler, conversationHistory, content, aiService, profileIdOverride)`。

数据流向一句话：对话历史 → 清洗去噪 → 混合检索找相关旧记忆 → AI 输出结构化指令（新建/更新/合并/连边）→ 落库成记忆图谱。

## 核心机制

### 1. 保存前先"洗"对话

工具调用输出和 AI 的思考过程是执行痕迹，不是 durable 的事实。保存前做三层清洗：

- `<tool_result>` 内容替换成占位符（省 token）
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:923`
- 去掉 Gemini 的思考签名元数据，再去掉思考内容
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:329`
- 过滤掉 system 消息；user 消息里 `<memory>...</memory>` 标签块删掉（那是之前注入的记忆引用，不是新事实）
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:338`

清洗后历史为空、或找不到 user 消息，就直接跳过不保存。琐碎寒暄不会污染记忆库。
`app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:352`

### 2. 混合检索 + LLM 裁决

直接把整段对话丢给 AI 很贵，还容易重复建节点。这里用"本地粗排 + LLM 终裁"：

1. 先拼一个紧凑的检索查询：核心问题 + 解决方案摘要（180 字）+ 最近 12 条消息（1200 字）
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:679`
2. 用六维权重（关键词/标签/向量/边/打分模式）从记忆库捞出最相关的 15 条候选旧记忆
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:591`
3. 候选里有同名重复的，先生成提示告诉 LLM 把它们合并
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:621`
4. 把候选记忆、现有文件夹列表、记忆空间资料一起塞进系统提示词，发给记忆专用模型（FunctionType.MEMORY）流式分析
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:637`

### 3. AI 返回的是"施工指令"，不是直接入库

AI 不直接写库，它返回一张 JSON 施工指令，字段固定缺一不可：

- `main`：本轮对话的核心问题（不许用别名）
- `new`：新抽出的实体（允许声明 `alias_for`，指认它是某个旧节点的别名）
- `update`：要更新的旧记忆（新内容/理由/可信度/重要度）
- `merge`：要合并的重复记忆
- `links`：节点之间的边（起点/终点/类型/描述/权重，权重必填）
- `profile_markdown`：记忆空间资料（人物画像式文档）的更新
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:834`

解析器对指令做强校验：必填字段缺失抛异常，可信度/重要度/权重必须在 0.0–1.0 之间。
`app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:870`

### 4. 落库分四步：合并 → 更新 → 新建 → 连边

顺序是刻意安排的，先消重再建新，避免边指向不存在的节点：

1. **合并**：`mergeMemories` 把重复记忆合成一个
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:406`
2. **更新**：按标题找到旧记忆更新内容；标题本身不改（代码注释明确"暂时不改标题"）
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:423`
3. **新建**：主问题节点 importance=0.8、credibility=1.0；别名实体复用已存在的规范节点，找不到才新建；新实体的 source 固定记 `memory_analysis`
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:464`
4. **连边**：`linkMemories(source, target, type, weight, description)`；源或目标找不到就记警告跳过，不让一条坏边中断全批
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:532`

全空的分析结果（寒暄类对话）直接跳过，不写库。
`app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:389`

整个 `saveMemory` 持一把全局 `mutex` 串行执行，避免并发写坏图谱。
`app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:323`

### 5. 定时自动保存：攒候选，够数才提炼

`MemoryAutoSaveScheduler` 是个每分钟 tick 一次的轮询器：

- 遍历所有记忆空间，每个空间按配置的间隔（默认 `DEFAULT_AUTO_SAVE_INTERVAL_MINUTES` 分钟）决定是否开工；下次运行时间同时写内存和持久化
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:177`
- 候选（聊天中标记"值得记"的消息）不足 5 条就继续攒，不浪费一次模型调用
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:101`
- 候选按聊天分组，每聊天每轮最多处理 20 条；用户手动选中的消息和系统自动收集的分开处理
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:131`
- 用户选中批：按时间戳找回原消息，只留 user 消息；自动批：取触发时间点之前倒序 48 条
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:216`
- 拼好对话历史后调 `MemoryLibrary.saveMemoryNow` 落库，成功删候选，失败标记 `markFailed` 留待下轮
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:279`
- 上一轮没跑完则本轮跳过（`AtomicBoolean` 防重入），不会堆积
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:70`

### 6. 重建：把历史聊天批量重提炼

`ChatMemoryRebuildManager` 用于"换记忆空间 / 换模型后，把旧聊天重新提炼一遍"：

- `start(chatIds, windowMessageCount, timeScope)`：已有任务在跑则直接返回；chatId 去空去重
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:78`
- 范围二选一：`EntireChat` 整聊，或 `InclusiveLocalRange` 日期区间（左闭右开，结束日自动加一天）
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildTimeScope.kt:21`
- `ChatMemoryWindowPlanner.plan` 按"一问一答"切窗：窗口 8–48 条（默认 32）；user 消息是 source，ai 回复配对到本轮 user；超窗时把本轮 user 作为下一窗的上下文带过去，保证每窗自包含
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryWindowPlanner.kt:72`
- 每窗调 `saveMemoryWindowNow`，`analysisHistoryLimit` 就等于窗口消息数；单窗失败只记 `failedWindows++`，不中断
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:173`
- 进度经 `StateFlow<Progress>` 实时暴露（状态/完成窗数/失败窗数/百分比），UI 可订阅
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:73`
- 记忆空间归属：聊天有角色组直接用当前空间；角色卡绑定了 `FIXED_PROFILE` 则用卡绑定的空间
  `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:230`

### 7. 自动分类：给"没进文件夹"的记忆归类

`autoCategorizeMemoriesAsync` 后台跑：查出全部 `folderPath` 为空的记忆，每 10 条一批，让 AI 按现有文件夹列表分类，调 `updateMemory` 写回（自动重算 embedding）。
`app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:219`

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| `MemoryLibrary` | 记忆库单例，分析对话并写入记忆图谱 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:35` |
| `saveMemoryNow` | 同步保存记忆，history limit 默认 10 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:145` |
| `saveMemoryAsync` | 后台保存，onSuccess/onError 回调 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:113` |
| `saveMemoryWindowNow` | 按指定历史条数保存（重建用） | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:165` |
| `autoCategorizeMemoriesAsync` | 后台自动给未分类记忆归文件夹 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:101` |
| `ParsedAnalysis` | AI 分析结果结构：main/new/update/merge/links/profile_markdown | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:77` |
| `generateAnalysis` | 混合检索 + LLM 生成结构化分析 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:556` |
| `parseAnalysisResult` | 强校验解析 AI 返回的 JSON 指令 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:813` |
| `MemoryAutoSaveScheduler` | 每分钟 tick 的长期记忆自动保存轮询器 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:24` |
| `runOnce` | 单轮扫描处理，防重入 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:70` |
| `ChatMemoryRebuildManager` | 历史聊天批量重提炼管理器 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:29` |
| `ChatMemoryWindowPlanner` | 按问答回合切分重建窗口 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryWindowPlanner.kt:5` |
| `ChatMemoryRebuildTimeScope` | 重建范围：整聊或日期区间 | `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildTimeScope.kt:8` |
| `MemoryRepository` | 记忆的增删改查与图谱边存储 | `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:55` |

## 调用链

### 链路 A：保存记忆（手动/定时共用）

1. **输入**：`conversationHistory`（(role, content) 对列表）+ `content`（本轮 AI 回复）+ 可选 `profileIdOverride`
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:145`
2. **处理**：拿全局 mutex → 定记忆空间 → 三层清洗对话（去工具输出/思考过程/旧记忆标签）→ 取最后一条 user 消息做 query → 混合检索 15 条相关旧记忆 → 发给记忆专用模型流式分析 → 强校验解析 JSON 指令 → 按"合并→更新→新建→连边"落库
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:323`
3. **输出**：记忆图谱新增/更新的节点与边；profileMarkdown 变化时自动更新记忆空间资料
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt:379`

### 链路 B：定时自动保存

1. **输入**：每分钟 tick；各记忆空间的候选消息（`MemoryAutoSaveCandidate`）
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:48`
2. **处理**：防重入检查 → 遍历记忆空间 → 未到间隔/候选不足 5 条则跳过 → 按聊天分组取前 20 → 用户选中与自动候选分组拼对话历史 → 调链路 A
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:82`
3. **输出**：成功删候选，失败 `markFailed` 留待下轮；下次运行时间写回持久化
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt:287`

### 链路 C：重建历史聊天

1. **输入**：`chatIds` + `windowMessageCount` + `timeScope`（整聊/日期区间）
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:78`
2. **处理**：加载聊天消息 → `ChatMemoryWindowPlanner.plan` 按问答回合切窗 → 逐窗 `saveMemoryWindowNow`（走链路 A 的落库部分）→ 进度实时推 `StateFlow`
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:115`
3. **输出**：`Progress(status=COMPLETED, failedWindows=N)`；取消/异常分别报 CANCELLED/FAILED
   `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt:197`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryLibrary.kt`（927 行）：记忆库单例，AI 分析与图谱落库
- `app/src/main/java/com/ai/assistance/operit/api/chat/library/MemoryAutoSaveScheduler.kt`（297 行）：定时自动保存轮询器
- `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildManager.kt`（245 行）：历史聊天重建管理器
- `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryWindowPlanner.kt`（82 行）：重建窗口规划器
- `app/src/main/java/com/ai/assistance/operit/api/chat/library/ChatMemoryRebuildTimeScope.kt`（43 行）：重建时间范围
