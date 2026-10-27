---
title: 数据模型与实体类
module: 数据层 / app
sources: 54
date: 2026-10-01
---

## 概述

`data/model/` 与 `data/mnn/` 是 Operit 数据层的"字典"：53 个 Kotlin 文件定义了聊天消息、记忆、角色卡、工作流、模型配置等跨层传递的结构，`data/mnn/` 的 1 个文件管本地 MNN 模型的下载与状态。UI 层、Room 数据库、ObjectBox 数据库、网络层都对着这些类说话。

核心设计分三条线：

- 聊天线：UI 拿消息类，落库转 Room 实体，导出归档用归档类。
- 记忆线：`Memory` 是 ObjectBox 实体，用标签、属性、链接织成知识图谱，向量经转换器存成字节。
- 配置线：一份模型配置走遍 38 家供应商；本地 MNN 模型由下载器管下载、断点续传与状态。

相关页面：[[data-model|数据模型（总览）]]。

## AI 速览

**核心符号清单**

- `ChatMessage` —— 聊天消息的 UI 层载体 `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:10`
- `ChatEntity` —— Room 聊天实体，对应 chats 表 `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:11`
- `MessageEntity` —— Room 消息实体，对应 messages 表 `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:21`
- `MessageVariantEntity` —— 消息变体实体 `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:23`
- `Memory` —— ObjectBox 核心记忆单元 `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:18`
- `Embedding` —— FloatArray 的向量包装类 `app/src/main/java/com/ai/assistance/operit/data/model/Embedding.kt:9`
- `EmbeddingConverter` —— 向量与字节数组的 ObjectBox 转换器 `app/src/main/java/com/ai/assistance/operit/data/model/EmbeddingConverter.kt:9`
- `ModelConfigData` —— 模型配置全集 `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:95`
- `ApiProviderType` —— 38 种 API 供应商枚举 `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:7`
- `Workflow` —— 自动化工作流 `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:11`
- `WorkflowNode` —— 工作流 sealed 节点基类 `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:42`
- `CharacterCard` —— 角色卡 Room 实体 `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:42`
- `MnnModelDownloadManager` —— MNN 模型下载与状态管理单例 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:96`

**主入口**：消息走 `ChatMessage`，记忆走 `Memory`，配置走 `ModelConfigData`，本地模型走下载器的 `getInstance`。

**数据流向一句话**：UI 用消息类与会话类，落库转 Room 实体；记忆用 `Memory` 进 ObjectBox，向量经转换器存字节；模型配置直达各供应商 API，本地 MNN 模型由下载器管。

## 核心机制

### 消息：UI 类与数据库实体分离

- `ChatMessage` 是 `@Serializable` 的聊天消息 `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:10`
- 流式内容 `contentStream` 不参与序列化，该类实现 `Parcelable` 以跨进程传递 `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:31`
- 时间戳由 `next` 分配，用 `AtomicLong` 加 CAS 循环保证进程内单调递增 `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocator.kt:14`
- 外部传入的时间戳经 `observe` 合并进水位线 `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocator.kt:24`
- 消息实体外键指向 `ChatEntity`，删除级联 `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:14`
- 会话实体的 `displayOrder` 默认取 `-createdAt`，天然倒序 `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:19`
- `toChatMessage` 把实体还原为 UI 层消息 `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:43`
- `fromChatMessage` 从 UI 层消息构造实体 `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:68`
- `toChatHistory` 把毫秒时间戳转为系统时区的 LocalDateTime `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:30`
- `fromChatHistory` 从 ChatHistory 构造 ChatEntity 实体 `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:62`
- displayOrder 非零时保留原值，否则取负的当前时间 `-now` `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:83`

### 消息变体：同时间戳多版本

- 唯一索引 `chatId`、`messageTimestamp`、`variantIndex` 保证变体不重复 `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:18`
- `applyTo` 把变体内容回填为消息 `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:38`

### 记忆：ObjectBox 图谱

- `credibility` 与 `importance` 默认都是 `0.5f` `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:27`
- `folderPath` 建索引、可空，空即未分类 `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:42`
- `tags`、`properties`、`links` 用 `ToMany` 挂在记忆上 `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:57`
- `@Backlink` 反向查出 `backlinks` 与 `documentChunks` `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:64`
- `MemoryLink` 的 `type` 默认 `related`，`weight` 默认 `1.0f` `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:93`
- `source` 与 `target` 指向关联两端的记忆 `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:100`

### 向量：字节存取

- `convertToDatabaseValue` 按每个 float 4 字节写入 `ByteArray` `app/src/main/java/com/ai/assistance/operit/data/model/EmbeddingConverter.kt:19`
- `embedding` 经 `EmbeddingConverter` 转为字节存库 `app/src/main/java/com/ai/assistance/operit/data/model/DocumentChunk.kt:20`
- `Embedding` 用 `contentEquals` 正确比较浮点数组内容 `app/src/main/java/com/ai/assistance/operit/data/model/Embedding.kt:14`

### 模型配置：一份配置走遍供应商

- `fromProviderTypeId` 大小写不敏感匹配枚举名，空字符串返回 null `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:47`
- `apiProviderType` 默认 `DEEPSEEK` `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:99`
- `keyRotationMode` 可选 `ROUND_ROBIN` 或 `RANDOM` `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:105`
- 默认 `maxTokens` 为 4096、`temperature` 为 1.0f `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:118`
- `DEFINITIONS` 含 7 个标准参数定义 `app/src/main/java/com/ai/assistance/operit/data/model/StandardModelParameters.kt:50`
- `getModelByIndex` 从逗号分隔的模型名字符串按索引取值，越界回落第一个 `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:217`

### 工作流：sealed 节点树

- `TriggerNode` 是触发节点 `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:55`
- `triggerType` 默认值为 `manual` `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:61`
- `ParameterValue` 只有 `StaticValue` 与 `NodeReference` 两种 `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:161`
- `ExtractNode` 是抽取节点 `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:134`
- `mode` 默认 `ExtractMode.REGEX` `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:141`
- `WorkflowExecutionRecord` 的 `runId` 默认随机 UUID `app/src/main/java/com/ai/assistance/operit/data/model/WorkflowExecutionLog.kt:31`

### 角色卡：Room 实体兼容酒馆格式

- `TavernCharacterCard` 是酒馆角色卡格式 `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:86`
- `schema` 固定为 `operit_character_card_v1` `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:117`
- `normalized` 对白名单条目做去空去重 `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt:14`

### MNN 模型下载：状态机加断点续传

- `DownloadState` 有六种状态 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:79`
- `MODEL_DIR` 为 Download/Operit/models/mnn 公共目录 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:113`
- 模型市场地址指向 meta.alicdn.com 的 model_market.json `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:108`
- 请求失败或异常时回落本地缓存 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:246`
- 已在下载或连接中时忽略重复调用 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:345`
- 先发 HEAD 请求取 Content-Length `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:414`
- 已存在文件且大小匹配则跳过下载 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:432`
- 用 `Range` 请求头实现断点续传 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:463`
- 进度每 500ms 更新一次 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:517`
- 单文件下载完成经 `renameTo` 生效并清理持久化状态 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:541`
- `pauseDownload` 置暂停标志 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:563`
- `cancelDownload` 取消任务并回 Idle `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:567`
- `deleteModel` 递归删除模型文件夹并清理持久化状态 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:573`
- `getDownloadedModels` 返回按修改时间倒序的模型文件夹 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:598`

### 归档与导出

- 归档类型为 `operit_chat_archive`，`CURRENT_FORMAT_VERSION` 为 2 `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt:14`
- `fromChatHistory` 从会话构造归档聊天 `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt:64`
- `MemoryExportData` 的 `version` 默认为 1.0 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt:68`
- `ImportStrategy` 是导入策略枚举 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt:80`
- `SKIP`：跳过已存在的记忆 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt:84`
- `UPDATE`：更新已存在的记忆 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt:89`
- `CREATE_NEW`：即使 UUID 相同也创建新记录 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt:94`
- `DateSerializer` 把 Date 序列化为 Long 时间戳 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt:16`

## 关键符号

- `ActivePrompt` 是 sealed 接口，两个子类各携带一个 id `app/src/main/java/com/ai/assistance/operit/data/model/ActivePrompt.kt:3`
- `ChatMessageDisplayMode` 是枚举，仅 NORMAL 与 HIDDEN_PLACEHOLDER 两个值 `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageDisplayMode.kt:6`
- `ChatTurnOptions` 控制单轮对话行为 `app/src/main/java/com/ai/assistance/operit/data/model/ChatTurnOptions.kt:3`
- `InputProcessingState` 是 UI 状态 sealed 类 `app/src/main/java/com/ai/assistance/operit/data/model/InputProcessingState.kt:9`
- `AITool` 是 AI 可用工具 `app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:12`
- `ToolInvocation` 记录 AI 回复中的工具调用 `app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:20`
- `ToolResult` 记录工具执行结果 `app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:29`
- `FunctionType` 枚举 11 种功能类型 `app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:4`
- `PromptTag` 是表名为 prompt_tags 的 Room 实体 `app/src/main/java/com/ai/assistance/operit/data/model/PromptTag.kt:10`
- `ToolParameterSchema` 定义工具参数模式 `app/src/main/java/com/ai/assistance/operit/data/model/ToolPrompt.kt:6`
- `SystemToolPromptCategory` 把一组相关工具拼成系统提示词 `app/src/main/java/com/ai/assistance/operit/data/model/ToolPrompt.kt:74`
- `MemorySpace` 是长期记忆库元数据 `app/src/main/java/com/ai/assistance/operit/data/model/MemorySpace.kt:12`
- `MemorySearchConfig` 默认 keywordWeight 为 10.0f `app/src/main/java/com/ai/assistance/operit/data/model/MemorySearchConfig.kt:9`
- `MemoryAutoSaveCandidate` 是记忆自动保存候选 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryAutoSaveCandidate.kt:9`
- `STATUS_PENDING` 等状态常量定义在伴生对象中 `app/src/main/java/com/ai/assistance/operit/data/model/MemoryAutoSaveCandidate.kt:21`
- `CharacterGroupCard` 是群组角色卡 `app/src/main/java/com/ai/assistance/operit/data/model/CharacterGroupCard.kt:14`
- `CustomEmoji` 只存 fileName 不存路径 `app/src/main/java/com/ai/assistance/operit/data/model/CustomEmoji.kt:18`
- `DragonBonesModel` 是骨骼动画模型元数据 `app/src/main/java/com/ai/assistance/operit/data/model/DragonBones.kt:24`
- `ModelParameter` 是泛型模型参数 `app/src/main/java/com/ai/assistance/operit/data/model/ModelParameter.kt:6`
- `ApiKeyInfo` 是 API Key 详情 `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyInfo.kt:33`
- `isValid` 要求 key 非空且全为可打印 ASCII `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:6`
- `BillingMode` 有 TOKEN 与 COUNT 两种计费方式 `app/src/main/java/com/ai/assistance/operit/data/model/BillingMode.kt:7`
- `providerModel` 为 provider 与 model 以冒号拼接 `app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt:30`
- `TokenStatsModelEntity` 记录百万 token 定价 `app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt:9`
- `SerializableColorScheme` 是可序列化的配色方案 `app/src/main/java/com/ai/assistance/operit/data/model/SerializableColorScheme.kt:9`
- `toSerializable` 把 Compose 颜色值转为 Long 存入 `app/src/main/java/com/ai/assistance/operit/data/model/SerializableColorScheme.kt:41`
- `OperitNodeInfo` 是可序列化的无障碍节点替代类 `app/src/main/java/com/ai/assistance/operit/data/model/OperitNodeInfo.kt:10`
- `getBounds` 把方括号坐标解析为 Rect，失败返回 null `app/src/main/java/com/ai/assistance/operit/data/model/OperitNodeInfo.kt:47`
- `AttachmentInfo` 描述聊天消息附件 `app/src/main/java/com/ai/assistance/operit/data/model/AttachmentInfo.kt:7`
- `AiReference` 是 AI 回复中的引用 `app/src/main/java/com/ai/assistance/operit/data/model/AiReference.kt:10`
- `WorkflowExecutionLogEntry` 记录单条工作流日志 `app/src/main/java/com/ai/assistance/operit/data/model/WorkflowExecutionLog.kt:22`
- `resolvedDisplayMode` 解析失败回落 NORMAL `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageLocatorPreview.kt:11`
- `isReady` 要求启用且 endpoint、apiKey、model 均非空 `app/src/main/java/com/ai/assistance/operit/data/model/CloudEmbeddingConfig.kt:15`
- `EmbeddingDimensionUsage` 统计记忆与区块的向量维度分布 `app/src/main/java/com/ai/assistance/operit/data/model/EmbeddingDimensionUsage.kt:8`
- `LegacyUserProfile` 仅为后续迁移保留数据 `app/src/main/java/com/ai/assistance/operit/data/model/LegacyUserProfile.kt:7`
- `WorkspaceRenameResult` 记录工作区重命名的三元组 `app/src/main/java/com/ai/assistance/operit/data/model/WorkspaceRenameResult.kt:3`
- `MnnModel` 是模型市场条目 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:29`
- `PersistentDownloadState` 持久化下载状态 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:65`

## 调用链

1. 消息落库：输入消息对象 → `fromChatMessage` 转实体 → 写入 Room messages 表 `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:68`
2. 消息读取：输入 Room 行 → `toChatMessage` 还原 → 输出 UI 层消息 `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:43`
3. 会话落库：输入会话对象 → `fromChatHistory` 转实体 → 输出会话实体 `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:62`
4. 向量存取：输入向量属性 → `convertToDatabaseValue` 转字节 → 输出进 ObjectBox `app/src/main/java/com/ai/assistance/operit/data/model/EmbeddingConverter.kt:21`
5. 模型下载：输入市场 JSON → 下载入口判分支 → 断点续传 → 重命名生效 `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt:345`
6. 聊天归档：输入会话与消息 → `fromChatHistory` 构造归档 → 输出归档 JSON `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt:64`

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/mnn/MnnModelDownloadManager.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ActivePrompt.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/AiReference.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyInfo.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/AttachmentInfo.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/BillingMode.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCard.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/CharacterCardChatStats.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/CharacterGroupCard.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/CharacterGroupChatStats.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatHistory.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageDisplayMode.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageLocatorPreview.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocator.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatTurnOptions.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/CloudEmbeddingConfig.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/CustomEmoji.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/DocumentChunk.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/DragonBones.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/Embedding.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/EmbeddingConverter.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/EmbeddingDimensionUsage.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/InputProcessingState.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/LegacyUserProfile.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MemoryAutoSaveCandidate.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MemorySearchConfig.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MemorySearchDebugInfo.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MemorySpace.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ModelParameter.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/OpenAIModels.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/OperitNodeInfo.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/PromptFunctionType.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/PromptTag.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ProviderIdentityUtils.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/SerializableColorScheme.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/SerializableTypography.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/StandardModelParameters.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ToolPrompt.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/WorkflowExecutionLog.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/WorkspaceRenameResult.kt`
