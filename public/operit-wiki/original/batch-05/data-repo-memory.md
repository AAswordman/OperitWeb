---
title: 记忆仓库
module: 数据层
sources: MemoryRepository.kt, MemoryAutoSaveCandidateRepository.kt, MemorySpaceProfileDocumentRepository.kt, Memory.kt, MemoryAutoSaveCandidate.kt, MemoryExportModel.kt, DocumentChunk.kt, CloudEmbeddingConfig.kt, MemorySearchDebugInfo.kt
date: 2026-10-01
---

# 记忆仓库

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 的“长期记忆”存在哪、怎么存、怎么搜。

`MemoryRepository` 是记忆数据的总入口。它管四样东西：一是记忆本体 `Memory`（标题、内容、标签、可信度、重要性），二是记忆之间的关联 `MemoryLink`（A 导致 B、A 是 B 的一部分，带权重），三是外部文档拆成的 `DocumentChunk`（文档的一个段落），四是这一切的向量索引（HNSW，存在 App 私有目录的文件里）。底层存储是 ObjectBox，按用户 profile 隔离。

搜索是这套代码最复杂的部分：一次 `searchMemories` 会同时跑四路——关键词标题命中、标签命中、反向包含（查询里含着记忆标题）、语义向量检索——再按 RRF 公式加权融合，外加图谱扩散（高分记忆的邻居也沾光），最后按相关性阈值过滤。还有配套的 `searchMemoriesDebug`，把每条候选的各路分数拆开给你看，调权重时用得上。

`MemoryAutoSaveCandidateRepository` 是另一条小流水线：聊天回复定稿后，先把“这条聊天值得总结的点”排进候选队列表，由定时器慢慢消化，而不是在聊天线程里当场总结——削峰用的。

## AI 速览

- 核心符号：`MemoryRepository`（记忆总入口）、`Memory`（记忆实体）、`MemoryLink`（记忆关联）、`MemoryTag`（标签）、`DocumentChunk`（文档区块）、`MemoryAutoSaveCandidateRepository`（自动保存候选队列）、`CloudEmbeddingService`（云端向量生成）、`VectorIndexManager`（HNSW 向量索引）、`MemorySearchDebugInfo`（搜索调试信息）
- 主入口：`MemoryRepository(context, profileId)` → `searchMemories(query, …)` 混合检索；`saveMemory(memory)` 保存并自动生成向量；`MemoryAutoSaveCandidateRepository.enqueue(chatId, timestamp)` 入队自动保存候选
- 数据流向一句话：记忆写入 ObjectBox（本体/标签/关联/区块四张表）→ 文本经 `CloudEmbeddingService` 生成向量 → 按维度写入 HNSW 索引文件 → 搜索时四路打分（关键词/标签/反向包含/语义）融合 + 图谱扩散 → 按阈值过滤返回。

## 核心机制

### 1. 存储结构：四个 Box + profile 隔离

`MemoryRepository(context, profileId)` 构造时用 `ObjectBoxManager.get(context, profileId)` 拿到按 profile 隔离的存储，再开四个 Box：`memoryBox`（记忆）、`tagBox`（标签）、`linkBox`（关联）、`chunkBox`（文档区块）。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:90`

`Memory` 实体字段：标题、内容、内容类型、可信度/重要性（0~1）、文件夹路径（`@Index` 加速文件夹查询）、embedding（`EmbeddingConverter` 转 ByteArray 存）、时间戳。关系上有 `tags`、`links`（出边）、`backlinks`（`@Backlink(to="target")` 的入边）、`documentChunks`（`@Backlink(to="memory")` 的文档区块）。
`app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:14`

链接强度有三个推荐常量：`STRONG_LINK = 1.0f`（A 是 B）、`MEDIUM_LINK = 0.7f`（A 与 B 相关）、`WEAK_LINK = 0.3f`（A 有时与 B 相连）。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:59`

### 2. 保存：自动生成向量，属性先消毒

`saveMemory` 做四件事：文件夹路径规范化、可信度/重要性钳制到 [0,1]、按“文档节点取标题、普通记忆取内容”的规则生成 embedding、记录旧向量维度以便决定索引重建范围。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:834`

注意一个行为：如果云 embedding 未配置（默认就是未配置），`generateEmbedding` 返回 null，保存会把已有向量覆盖成 null。换 embedding 服务后随手保存一条旧记忆，它的语义检索能力就丢了，只能靠全量重建找回来。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:843`

`updateMemory` 更克制：只有内容/可信度/重要性变化（或文档节点标题变化）时才重新生成向量，否则沿用旧向量；标签是“清空再全量添加”。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2253`

`linkMemories` 创建关联前先查“同源+同目标+同类型”是否已存在，存在就直接返回不重复建；权重钳制到 [0,1]。但去重检查用的是 `source.links` 的缓存快照（没先 `reset()`），如果调用方传的是旧实体，缓存过期会导致去重检查基于过期快照，从而创建重复链接。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1046`

更新/删除链接后会重新 `put` 源记忆——这是刻意为之：告诉 ObjectBox“这个父实体的关系集合脏了”，避免后续查询拿到缓存的旧关系。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:980`

`deleteMemory` 按“先删文档区块、再删关联链接、最后删本体并清向量索引”的顺序来；还有个 30 秒节流的悬空链接清理器，定期删掉两端已不存在的野链接。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:892`

### 3. 混合检索：四路打分 + RRF 融合 + 图谱扩散

`searchMemories(query, folderPath, scoreMode, keywordWeight=10.0f, tagWeight=0.0f, semanticWeight=0.5f, edgeWeight=0.4f, relevanceThreshold=0.025, …)` 是搜索主入口；`searchMemoriesDebug` 走同一套计算，额外返回结构化调试信息（各路命中数、每条候选的各路分数、是否过阈值）。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1131`

查询先切关键词：含 `|` 按竖线切，否则按空白切；再做“词条扩展”——保留原词 + 用 Jieba（`TextSegmenter`）分词补充分片，最多保留 32 个词条按长度降序。这是为中文长句准备的：没开语义检索时也能靠分词召回。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:140`

词条要过两道卫生检查：长度 2~24、含字母数字或 CJK 字符（`0x4E00..0x9FFF`）。副作用是单字中文（如“猫”）进不了关键词分支，只能靠反向包含或语义检索。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:659`

查询支持 `*` 通配符：`a*b` 会被转成 `a.*b` 的正则（忽略大小写、`.` 匹配换行）；含通配符的分片不走数据库查询，直接在内存里对范围内记忆的标题做正则过滤。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:664`

四路打分：

1. **关键词**：词条分片对标题做 `contains` 查询，分数 = RRF 基分 × importance × 关键词权重 × 覆盖率乘子。其中 RRF 基分 = 1/(60+rank)，覆盖率乘子 = 1 + 0.6×(命中词条数/总词条数)。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1360`
2. **标签**：同一套公式，权重换成标签权重（默认 0，等于关闭）。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1391`
3. **反向包含**：查询文本里包含记忆标题就算命中（查“长安大学在西安”能召回标题为“长安大学”的记忆）。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1418`
4. **语义**：每个关键词生成向量，从 HNSW 索引取全部候选按余弦相似度排序；分数 = (RRF 基分 × √importance + 相似度 × 语义权重) × 关键词数归一化因子（1/√关键词数）。语义检索要求云 embedding 配置就绪。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1421`

打分模式 `MemoryScoreMode` 会整体缩放权重：`KEYWORD_FIRST` 是 (1.3, 0.8, 0.9)，`SEMANTIC_FIRST` 是 (0.8, 1.3, 1.1)，`BALANCED` 全 1.0。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:229`

最后一步图谱扩散：取总分前 10 的记忆当种子，沿出边和入边把分数按“源分数 × 边权重 × 边权重系数 + 0.03×边权重系数”传播给邻居。连上有关系的记忆也能沾光。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1467`

总分低于 `relevanceThreshold`（默认 0.025）的直接丢掉，不返回。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1530`

两个特殊查询：`"*"` 和空字符串都返回过滤后的全部记忆（文件夹占位记忆会被先滤掉）。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1274`

### 4. 向量索引：按维度分文件的 HNSW

索引文件按“清洗后的 profileKey + 向量维度”分文件：记忆索引是 `memory_hnsw_<key>_<维度>.idx`，文档区块索引是 `doc_index_<key>_<记忆id>_<维度>.hnsw`，都放在 `OperitPaths.vectorIndexDir` 下。profileId 里的非法字符会被正则替换成下划线，防止文件名注入。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:293`

底层 `VectorIndexManager` 用余弦距离建 HNSW。增删记忆不走增量更新，而是整维度重建——注释里写了原因：HNSW 删除留 tombstone，增量 add 容易撞容量上限。代价是每次保存都全量读一遍该维度的记忆重建索引，库大时会慢。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:353`

`ensureMemoryVectorIndex` 在索引文件缺失时先全量重建再打开，保证搜索不扑空。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:557`

文档区块索引按“各区块向量维度的众数”选目标维度，维度对不上的区块不进索引；换维度时旧索引文件会被删掉。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:461`

还有配套运维接口：`getEmbeddingDimensionUsage` 统计记忆/区块缺失向量的数量和维度分布；`rebuildVectorIndices` 用一段探针文本先确定目标维度，再批量补向量、重建全部索引，进度用 `EmbeddingRebuildProgress` 回调上报（preparing → memory_embedding → chunk_embedding → memory_index → chunk_index → done）。配置没就绪会直接抛异常。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1856`

### 5. 文档节点：外部文档进记忆库

`createMemoryFromDocument(documentName, originalPath, text, folderPath)` 把外部文档变成一条“文档节点”记忆：文档名生成整篇向量，按“两个以上换行”切块、删掉 `***`/`---` 这类分隔符行，每块是一个 `DocumentChunk`（内容 + 序号 + 独立向量），再建好区块索引。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:769`

文档内搜索 `searchChunksInDocument` 对区块跑“关键词 + 语义”两路打分（不计标签和图谱），空白查询直接返回前 N 个区块。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1647`

`updateChunk` 改单个区块内容后重生成向量并按新维度重建该文档的区块索引。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1797`

### 6. 文件夹：路径是字符串，不是实体

文件夹没有独立表，就是 `Memory.folderPath` 上的一个字符串（`work/项目A` 这种）。`normalizeFolderPath` 统一 trim、斜杠、去空段；空路径的记忆算“未分类”。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:72`

`getMemoriesByFolderPath` 用前缀匹配，天然包含子文件夹；`renameFolder` 重命名时子路径做前缀替换；`moveMemoriesToFolder` 目标选“未分类”就把路径置 null。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2084`

`createFolder` 是障眼法：实际创建一个标题为特定资源字符串的占位记忆，搜索时会先把这类占位过滤掉。但 `deleteFolder` 只精确匹配本级文件夹，子文件夹的记忆删完会留在原路径下成为孤儿——和查询的前缀语义不一致。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2170`

### 7. 图谱：节点颜色有语义

`getMemoryGraph`（全库）、`getGraphForFolder`（单文件夹）、`getGraphForMemories`（搜索结果+一跳邻居）都经 `buildGraphFromMemories` 构图。节点颜色：文档节点紫色 `0xFF9575CD`；首标签 `Person` 绿色、`Concept` 蓝色，其余浅灰。边只在两端都在当前节点集合里时才保留，跨文件夹的边打 `isCrossFolderLink` 标记。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2495`

### 8. 导入导出与合并

`exportMemoriesToJson` 导出全部**非文档节点**记忆和它们之间的链接（去重），JSON 里记忆用 UUID 互相引用，格式版本 `"1.0"`。注意文档节点不会被导出。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2589`

`importMemoriesFromJson(json, strategy)` 默认 `SKIP`：UUID 已存在就跳过；`UPDATE` 覆盖内容并刷新标签；`CREATE_NEW` 即使 UUID 相同也强制生成新 UUID 新建。链接导入时用旧 UUID→新对象的映射表重建关系，已存在的同类型链接不重复建。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2662`

`mergeMemories` 把多个源记忆合成一条：先在 `store.runInTx` 事务里建新记忆、把源记忆的全部出/入边重定向到新记忆、删掉源记忆（含文档区块），事务结束后再给新记忆生成向量、重建索引。源记忆少于 2 个直接返回 null。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2313`

`deleteMemoriesByUuids` 按 UUID 批量删：事务内删链接、区块、本体，事务外清向量索引和区块索引文件。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:2413`

### 9. 自动保存候选队列：聊天→记忆的削峰带

`MemoryAutoSaveCandidateRepository` 是一张队列表 `MemoryAutoSaveCandidate`（chatId、触发消息时间戳、状态、重试次数、最后错误、来源类型）。回复定稿后 `enqueue` 入队（默认来源 `reply_finalized_auto`，状态 pending），用户手动选消息时 `enqueueSelectedUserMessages` 批量入队（来源 `selected_user_message`，时间戳做 >0 过滤、去重、排序）。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryAutoSaveCandidateRepository.kt:18`

定时器（`MemoryAutoSaveScheduler`）拉 `getPendingAndFailedCandidates`（pending 或 failed，按创建时间升序），处理中打 `processing`，失败打 `failed`（重试次数 +1，错误信息截断 500 字符），成功则删除候选。`markPending` 可把失败项打回待处理重试。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryAutoSaveCandidateRepository.kt:55`

入队方有两处：`EnhancedAIService`（回复定稿）、`MessageCoordinationDelegate`（消息协调流程）；`MemoryAutoSaveScheduler` 只拉取 pending/failed 候选，不负责入队；聊天输入栏组件读 `countPendingAndFailedCandidates()` 展示待处理数量。
`app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2048`

### 10. 记忆空间画像文档：每空间一份 user.md

`MemorySpaceProfileDocumentRepository`（单例，双重检查锁，构造时拿 `applicationContext` 防泄漏）给每个记忆空间存一份 Markdown 画像：`filesDir/memory-space-profiles/<memorySpaceId>/user.md`，内容上限 12_000 字符（`MAX_CONTENT_CHARS`），`save` 超限直接抛错。
`app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:34`
`app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:20`

- 读写：`load` 在文件不存在时先在写锁内建空文件，再 UTF-8 读全文；所有写走 `writeAtomically`（Android `AtomicFile`：startWrite→写字节→finishWrite，失败 failWrite 并重抛）；`reset` = 写空串；`delete` 删 user.md 及整个空间目录。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:73`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:299`
- 自动更新守门：`saveAutomatic` 先读该空间配置，`profileAutoUpdateEnabled` 未开或 `profileAutoUpdateLocked` 已锁定就返回 false 不写，否则写入并返回 true。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:94`
- 一次性迁移：`initialize` 用 Mutex 只跑一次，`schema_version` < 2（`CURRENT_SCHEMA_VERSION`）时跑迁移并用 SharedPreferences `commit()` 同步写回版本号。迁移三分支：有旧结构化画像元数据→`migrateLegacyStructuredProfiles`（旧 `LegacyUserProfile` 转 `# About me` + `## Basic information` / `## Personality` / `## Preferred assistant style` 三节 Markdown，生日按 `yyyy-MM-dd`）；有记忆空间元数据→`migratePublishedGlobalDocuments`（根 `user.md` 的归属靠"归档名是其余空间名列表的子序列"唯一确定，候选多于 1 个只记警告、保留源文件不迁移）；否则也跑旧画像迁移。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:54`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt:114`

## 关键符号

| 符号 | 说明 |
|---|---|
| `MemoryRepository` | 记忆数据总入口：CRUD、混合检索、向量索引、文件夹、图谱、导入导出 |
| `Memory` | 记忆实体：标题/内容/标签/可信度/重要性/文件夹/向量 |
| `MemoryLink` | 记忆关联：source/target/type/weight/description |
| `MemoryTag` | 标签实体，支持父子层级 |
| `DocumentChunk` | 文档区块：内容 + 序号 + 独立向量 |
| `MemoryAutoSaveCandidateRepository` | 自动保存候选队列的增删改查 |
| `MemorySpaceProfileDocumentRepository` | 每记忆空间一份 Markdown 画像（`memory-space-profiles/<id>/user.md`，AtomicFile 原子写，12_000 字符上限，一次性 schema 迁移） |
| `MemoryAutoSaveCandidate` | 候选实体：pending/processing/failed 三态 |
| `CloudEmbeddingService` | 云端向量生成服务（`generateEmbedding`/`generateEmbeddingOrThrow`） |
| `CloudEmbeddingConfig` | 向量服务配置：enabled/endpoint/apiKey/model，`isReady()` 判定可用 |
| `VectorIndexManager` | HNSW 向量索引管理器（余弦距离） |
| `MemorySearchSettingsPreferences` | 检索权重与向量配置的持久化 |
| `MemorySearchDebugInfo` | 单次搜索的结构化调试信息（各路分数/阈值/候选） |
| `MemoryScoreMode` | 打分模式：BALANCED / KEYWORD_FIRST / SEMANTIC_FIRST |
| `ImportStrategy` | 导入策略：SKIP / UPDATE / CREATE_NEW |
| `MemoryExportData` | 导出容器：记忆列表 + 链接列表 + 版本 |
| `EmbeddingDimensionUsage` | 向量缺失数与维度分布统计 |
| `EmbeddingRebuildProgress` | 向量重建进度回调载体 |

## 调用链

1. **输入**：用户查询 `query` + 可选文件夹/时间范围/权重参数进入 `searchMemories`；先做文件夹与时间过滤、占位记忆剔除，再把查询切成关键词并做 Jieba 词条扩展（最多 32 个）。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1183`
2. **处理**：四路并行打分——标题关键词 RRF、标签 RRF、反向包含、语义向量（HNSW 取候选 + 余弦复算）——按打分模式缩放权重后求和；取前 10 高分记忆沿出/入边做图谱分数扩散。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1421`
3. **输出**：过滤掉总分低于 `relevanceThreshold` 的记忆，按分数降序返回；`searchMemoriesDebug` 额外返回每条候选的各路分数明细。
   `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1530`

写入链：`saveMemory`/`createMemory` 消毒属性 → 生成向量 → ObjectBox 落盘 → 按维度重建 HNSW 索引。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:834`

文档链：`createMemoryFromDocument` 切块建 `DocumentChunk` → 逐块生成向量 → 建文档级 HNSW 索引；`searchChunksInDocument` 在块内做关键词+语义检索。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:769`

自动保存链：`EnhancedAIService` 回复定稿 → `enqueue` 入队 pending → `MemoryAutoSaveScheduler` 拉取 pending/failed → 打 processing → 生成记忆 → 成功删除候选 / 失败打 failed 并计次。
`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryAutoSaveCandidateRepository.kt:18`

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt`（2814 行）：记忆总入口
- `app/src/main/java/com/ai/assistance/operit/data/repository/MemoryAutoSaveCandidateRepository.kt`（125 行）：自动保存候选队列
- `app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt`（112 行）：记忆/标签/关联/属性实体
- `app/src/main/java/com/ai/assistance/operit/data/model/MemoryAutoSaveCandidate.kt`（32 行）：候选实体与状态/来源常量
- `app/src/main/java/com/ai/assistance/operit/data/model/MemoryExportModel.kt`（107 行）：导入导出数据模型与策略
- `app/src/main/java/com/ai/assistance/operit/data/model/DocumentChunk.kt`（27 行）：文档区块实体
- `app/src/main/java/com/ai/assistance/operit/data/model/CloudEmbeddingConfig.kt`（24 行）：向量服务配置
- `app/src/main/java/com/ai/assistance/operit/data/model/MemorySearchDebugInfo.kt`（38 行）：搜索调试信息模型
- `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySpaceProfileDocumentRepository.kt`（312 行）：每记忆空间一份 Markdown 画像（原子写/上限/一次性迁移）

事实清单：facts.json（173 条）
代码走查：quality.json（15 条：高危 2 / 警告 2 / 建议 11）
