---
title: 扩展仓库（Avatar/表情/工作流/Skill/插件黑名单/UI 层级）
module: 数据层
sources: AvatarRepository.kt, AvatarConfigPersistence.kt, WorkflowRepository.kt, CustomEmojiRepository.kt, SkillRepository.kt, PluginDenylistRepository.kt, UIHierarchyManager.kt
date: 2026-10-01
---

# 扩展仓库（Avatar/表情/工作流/Skill/插件黑名单/UI 层级）

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

本页覆盖数据层里 7 个"杂项"仓库：它们不负责聊天消息本身，而是给上层能力做持久化与桥接——虚拟形象（Avatar）配置、自定义表情文件、工作流定义与执行记录、Skill 包的导入与可见性、插件黑名单的云端下发与拦截、以及经由独立 App 的无障碍 UI 层级桥。

记忆与聊天历史不在本页：`MemoryRepository`、`MemoryAutoSaveCandidateRepository` 见"记忆仓库"页，`ChatHistoryManager` 见"聊天历史仓库"页。

共同点：7 个类全部以"文件 + 轻量元数据"做持久化（SharedPreferences / DataStore / JSON 文件 / AtomicFile），没有用数据库；全部提供单例入口；全部把重操作放到 IO 线程。

## AI 速览

- 核心符号：`AvatarRepository`（Avatar 配置总管）、`AvatarConfig`（单 Avatar 配置）、`AvatarPersistenceDelegate`（类型扫描契约）、`decodePersistedAvatarConfigs`（配置容错解码）、`WorkflowRepository`（工作流存取与触发）、`CustomEmojiRepository`（表情文件+元数据）、`SkillRepository`（Skill 导入门面）、`PluginDenylistRepository`（插件黑名单）、`UIHierarchyManager`（无障碍桥 object 单例）
- 主入口：UI 层经各类的 `getInstance` / `UIHierarchyManager` 直接调用；`PackageManager` 在扫描插件包时调 `findDeniedImport` 做黑名单拦截；`AccessibilityUITools` 经 `UIHierarchyManager` 拿 UI 层级并执行点击/滑动/截屏
- 数据流向一句话：用户侧的导入与配置变更 → 各仓库写文件/偏好 → 运行时（Avatar 渲染、表情选择、Skill 列表、插件扫描、无障碍操作）读回使用；黑名单是唯一反向流——云端指针拉取 → 本地缓存 → 插件安装时拦截

## 核心机制

### Avatar：配置存偏好，模型存文件，6 种类型各有一个扫描器

`AvatarRepository` 是虚拟形象的总管。它不管渲染，只管"有哪些形象、当前用哪个、怎么导入"。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:497`

单个形象的配置是 `AvatarConfig`，字段只有 5 个：`id`、`name`、`type`、`isBuiltIn`、`data`，类型相关的细节（模型路径、动作文件列表）全塞进 `data` 这个 Map。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:33`

`getBasePath` 优先取 `data` 中的 `folderPath`，取不到再取 `basePath`。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:41`

类型识别靠 `AvatarPersistenceDelegate` 这个接口：每个 `AvatarType` 配一个实现，`scanDirectory` 扫目录、按文件特征认出模型就产出配置。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:198`

仓库内置 6 个 delegate 实现，覆盖全部 6 种 `AvatarType`。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:528`

`DragonBonesPersistenceDelegate` 要求目录同时具备骨架 JSON、`{名}_tex.json` 与 `{名}_tex.png` 三件套才认可。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:214`

`WebPPersistenceDelegate` 要求目录中含有 `.webp` 文件才生成配置。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:273`

`Mp4PersistenceDelegate` 要求目录中含有 `.mp4` 文件才生成配置。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:310`

`MmdPersistenceDelegate` 取目录中首个 `.pmx` 或 `.pmd` 文件为模型，`.vmd` 文件按文件名排序收集为动作列表。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:347`

`GltfPersistenceDelegate` 优先选择 `.glb`，其次 `.gltf`。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:406`
并跳过 `.operit_` 前缀的内部文件。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:402`

`FbxPersistenceDelegate` 用 `FbxInspector.inspectModel` 检查模型，检查失败或缺外部资源时跳过该目录。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:431`

配置持久化在 SharedPreferences 文件 `avatar_preferences`，键为 `avatar_configs`、`avatar_settings`、`avatar_instance_settings`。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:504`

内置 Avatar 模型来自 `assets` 的 `pets` 目录。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:509`

内置模型在首次启动时同步拷贝到外部存储的 `avatars` 目录，`overwrite=false` 不覆盖已有文件。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:576`

用户 Avatar 目录为 `getExternalFilesDir(null)` 下的 `avatars` 子目录。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:549`

启动时的 `loadAvatars` 做三方合并：磁盘扫描决定"存在什么"，prefs 里保留的用户重命名等修改合并回来。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:586`

prefs 中有记录、磁盘目录已消失但原路径仍存在的配置会被保留，不丢弃。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:615`

最终配置列表按 `avatarSourceKey` 去重后写回 prefs。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:619`

配置 JSON 的解码是容错的：`decodePersistedAvatarConfigs` 要求顶层是数组，单条坏了就记下标丢弃，不炸掉整个列表。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarConfigPersistence.kt:21`

`switchAvatar` 切换当前 Avatar 并把新 id 写回设置。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:652`

`deleteAvatar` 拒绝删除内置 Avatar，直接返回 false；删除用户形象时同步删模型目录、更新配置列表。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:712`
删的是当前形象则回退到第一个可用配置。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:717`

`importAvatarFromUri` 按文件名后缀与 MIME 类型把导入分流为 ZIP 与单模型文件两条路径。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:827`

ZIP 导入支持 UTF-8、GBK、GB18030、CP437 四种文件名编码。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:512`
解码报 MALFORMED 时自动换下一种重试。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:1054`

ZIP 导入用 canonicalPath 校验阻止目录穿越，可疑条目跳过不解压。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:1026`

ZIP 导入扫描解压后的全部子目录，识别出的配置按类型、basePath、名称去重后拷入用户目录。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:1103`

单模型文件导入支持 `.glb`、`.gltf`、`.mp4`、`.fbx` 四种后缀。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:934`

单文件导入的 FBX 若依赖外部资源则拒绝导入并删除已建目录，要求改用 ZIP 打包。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:969`

`updateCurrentAvatar` 找不到目标 id 的配置时回退到配置列表的第一个。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:669`

Avatar 配置 id 生成规则：内置为 `built_in_<类型>_<目录名>`，用户为 `user_<类型>_<路径哈希十六进制>`。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:161`

### 工作流：一个 id 一个 JSON，执行记录另起目录

`WorkflowRepository` 把工作流存在外部存储 `Downloads` 目录下的 `Operit/workflow` 子目录，一个工作流一个 `<id>.json` 单文件。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:138`

`getWorkflowFile` 按工作流 id 拼出对应的 json 文件路径。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:164`

文件写入使用 `AtomicFile`，经 `startWrite`、`finishWrite`、`failWrite` 保证原子性。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:228`

`workflowStoreMutex` 是全局互斥锁，串行化所有工作流存储读写。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:66`

工作流执行记录存于 `_execution_logs/<workflowId>/<startedAt>_<runId>.json`，每个工作流最多留 30 份，超量按修改时间删旧。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:242`

`runId` 写入文件名时，非字母数字下划线连字符的字符被替换为下划线。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:253`

`getAllWorkflows` 跳过损坏的工作流文件，并经 `workflowStorageWarnings` 发出警告事件。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:277`

`listWorkflowFiles` 把没有主文件的 `.json.bak` 孤儿备份也纳入候选，保证备份可读。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:180`

`readWorkflowFile` 强制用文件名覆盖 JSON 内容里的 id 字段，防止内容与文件名错位。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:203`

`createWorkflow` 要求工作流 id 非空。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:365`
启用且含 schedule 触发器时自动创建调度。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:375`

`updateWorkflow` 在保存前把 `updatedAt` 刷新为当前时间。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:391`

`setWorkflowEnabled` 切换启用状态后同步增删 WorkManager 调度。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:471`

`deleteWorkflow` 先取消调度，再删除 json 主文件、`.bak` 备份与执行日志目录。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:508`

`triggerWorkflow` 在工作流不存在、已禁用、已有运行中实例三种情况下直接拒绝执行。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:603`

工作流执行经 `WorkflowExecutor.executeWorkflow` 完成，成功与失败分别更新统计并落盘执行记录。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:635`

取消与异常路径用 `NonCancellable` 上下文落盘执行记录，保证诊断证据不丢失。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:638`

`cancelWorkflow` 用 `CancellationException` 取消运行中的工作流 Job。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:582`

`runningWorkflowJobs` 跟踪各工作流的运行中 Job，`runningWorkflowIds` 对外暴露运行中 id 集合的 StateFlow。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:78`

Tasker 触发把 `triggerConfig` 的 `command` 与 Tasker 传参做大小写不敏感匹配。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:840`

Intent 触发匹配 `triggerConfig` 的 `action` 与收到的 Intent action，忽略大小写。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:873`

冷启动触发扫描 `triggerType` 为 `app_open` 的节点，并注入 `trigger_source` 为 `cold_start_app_open` 的触发参数。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:916`

语音触发用 `triggerConfig` 的 `pattern` 正则匹配识别文本，支持 `require_final`、`ignore_case`、`cooldown_ms` 配置。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:968`

语音触发的工作流列表缓存 TTL 为 2000 毫秒，默认冷却 3000 毫秒。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:65`

`notifyWorkflowsChanged` 清空语音触发缓存并广播工作流更新事件。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:82`

`scheduleWorkflow` 内部用 `runBlocking` 同步查询工作流后再调度。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:761`

`updateExecutionStatistics` 累计 `totalExecutions`、`successfulExecutions`、`failedExecutions` 三个计数。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:718`

### 自定义表情：文件按角色卡隔离，元数据走 DataStore

`CustomEmojiRepository` 管"角色卡表情包"。文件落 `filesDir/custom_emoji/<target_scope>/{category}/{uuid}.{ext}`，元数据经 `CustomEmojiPreferences` 进 DataStore、按 target 隔离。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:21`

target 的 scope 目录名规则：角色卡 `character_card_<id>`，角色组 `character_group_<id>`，不同角色卡的表情天然隔离。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:344`

内置表情从 `assets/emoji` 按分类拷贝到目标目录，文件名用 UUID 重命名，初始化幂等。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:296`

`SUPPORTED_EXTENSIONS` 限定表情格式为 jpg、jpeg、png、gif、webp 五种；`addCustomEmoji` 拒绝不在白名单的扩展名，文件名用 UUID 生成。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:43`

`deleteCustomEmoji` 同时删除表情文件与元数据。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:161`
id 不存在返回失败。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:154`

`deleteCategory` 删除分类目录及其下全部表情文件与元数据。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:178`

`getEmojiFile` 按 target、表情分类、文件名定位表情文件；`getEmojiUri` 再包装为 Uri。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:203`

查询接口以 Flow 形式返回结果：`getEmojisForCategory`、`getAllCategories`、`getAllEmojis`。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:211`

`cloneEmojiSet` 把源 target 的整套表情（含文件与元数据）复制到目标 target，另有角色卡/角色组便捷封装。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:233`

`deleteTarget` 删除指定 target 的全部表情元数据与文件目录。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:265`

`isValidCategoryName` 只允许小写字母、数字、下划线组成的分类名。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:292`

`purgeLegacyGlobalStorage` 清理旧全局存储中非当前 scope 的目录，进程内只执行一次。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:351`

`resetToDefault` 清空目标表情后从 assets 重拷内置表情。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:74`

### Skill：门面，实干的是 SkillManager，导入有三条路

`SkillRepository` 是 data 层门面，技能的读写删改实际委托 `core.tools.skill.SkillManager`。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:42`

`getAiVisibleSkillPackages` 在透传基础上按 `SkillVisibilityPreferences` 过滤出 AI 可见的技能包。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:62`

GitHub 导入解析 `github.com` 与 `raw.githubusercontent.com` 两种 URL，提取 owner、repo、ref、subDir。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:81`

GitHub 导入缺省 ref 时调 GitHub API 取默认分支，结果缓存在 `defaultBranchCache`。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:91`

GitHub 导入经 `codeload.github.com` 下载仓库 zip；下载按 `owner/repo@ref` 池化复用，池未命中回退到 cacheDir 临时文件。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:103`

`tree` 与 `blob` 链接可指定分支与子目录。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:340`
`blob` 指向 `SKILL.md` 时取其父目录为技能子目录。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:341`

直接输入导入生成带 YAML front matter 的 `SKILL.md`，含 name 与 description 字段。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:237`

直接输入导入把附件拷贝到技能目录的 `assets` 子目录，文件名消毒并对重名加数字后缀；失败时删除已创建的技能目录。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:207`

`SKILL_ID_PATTERN` 为 `^[A-Za-z0-9._-]+$`，`isValidSkillId` 额外拒绝 id 为单个点或双点。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:31`

`downloadFromUrl` 连接超时 15 秒、读取超时 30 秒。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:30`
UA 伪装桌面浏览器。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:388`
非 200 响应返回 false。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:394`

`getGithubDefaultBranch` 解析 GitHub 仓库 API 返回的 `default_branch` 字段。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:428`

### 插件黑名单：云端下发 SHA-256 名单，安装时按文件哈希拦截

`PluginDenylistRepository` 管插件安全黑名单，默认指针为 `https://operit.app/plugin-denylist/latest.json`。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:214`

`refreshFromRemote` 流程为拉指针、校验、拉载荷、校验、`AtomicFile` 写缓存，任一步失败返回 false；由 `OperitApp` 在启动时调用。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:59`

指针校验要求 schemaVersion 为 1、`latestVersion` 大于 0、`latestFile` 非空。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:135`

载荷校验要求 schemaVersion 为 1、version 大于 0 且与指针版本一致、`hashAlgorithm` 为 `sha256`、`match` 为 `raw_file_bytes`、`action` 为 `reject_import`；条目 sha256 必须 64 位小写十六进制且不重复。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:146`

`findDeniedImport` 计算待导入文件的 SHA-256，与缓存条目逐条比对，命中返回对应条目；无本地缓存时返回 null 即放行。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:76`

黑名单缓存路径为 filesDir 下的 `plugin_denylist/denylist.json`，读写经 `AtomicFile`，读取时兼容 `.bak` 备份文件。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:103`

`cacheSignature` 由缓存文件大小与最后修改时间组成，被 `PackageManager` 纳入插件扫描签名。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:88`

`PackageManager.pluginDenylistRejection` 在扫描插件包时调用 `findDeniedImport`，命中黑名单则拒绝导入。
`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:1248`

黑名单拉取给 URL 追加 `ts` 时间戳参数防缓存，请求头带 `Cache-Control: no-cache`；连接、读取、写入超时各 8 秒。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:163`

### UI 层级：经独立 App 的 AIDL 桥拿无障碍树

`UIHierarchyManager` 是 object 单例。因为无障碍权限要独立进程持有，Operit 把能力拆到另一个 App（包名 `com.ai.assistance.operit.provider`），本仓库只负责绑定与转发。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:40`

绑定用的 action 为 `com.ai.assistance.operit.provider.IAccessibilityProvider`，须与提供者声明一致；提供者 APK 文件名为 `accessibility.apk`。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:49`

`extractProviderApkFromAssets` 把 assets 中的提供者 APK 提取到 cacheDir，`launchProviderInstall` 在 Android N 及以上用 `FileProvider` 生成 URI 发起安装。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:87`

`bindToService` 用 `Mutex` 串行化。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:198`
经 `resolveService` 把隐式 Intent 显式化。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:209`
`suspendCancellableCoroutine` 等连接回调，3 秒超时后解绑收尾。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:223`

提供者 App 未安装时 `bindToService` 直接返回当前绑定状态，不尝试绑定；`ensureBound` 在每次调用前自动重绑一次；绑定状态经 `isBound` 对外暴露。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:183`

`getUIHierarchy` 经 AIDL 获取 UI 层级 XML 字符串，失败返回空字符串。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:308`

`extractWindowInfo` 只解析 UI 层级 XML 根 node 的 package 属性，activity 位置固定返回 null。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:328`

`performClick` 请求远程服务在指定坐标执行点击，`RemoteException` 时返回 false。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:363`

`performLongPress` 请求远程服务在指定坐标执行长按，`RemoteException` 时返回 false。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:376`

`performSwipe` 请求远程服务执行滑动，`RemoteException` 时返回 false。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:392`

`performGlobalAction` 请求远程服务执行指定 id 的全局操作，`RemoteException` 时返回 false。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:408`

`findFocusedNodeId` 请求远程服务查找有焦点的节点 id，`RemoteException` 时返回 null。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:424`

`setTextOnNode` 请求远程服务在指定节点设置文本，`RemoteException` 时返回 false。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:440`

`takeScreenshot` 请求远程服务按指定路径与格式截屏，`RemoteException` 时返回 false。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:459`

`isAccessibilityServiceEnabled` 经远程服务查询系统设置中无障碍服务是否启用；`getCurrentActivityName` 经远程服务获取当前 Activity 名称。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:475`

上层 `AccessibilityUITools` 是这套桥的主要调用方，`isUpdateNeeded` 则委托 `AccessibilityProviderInstaller` 判断提供者是否需要更新。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:158`

## 关键符号

- `AvatarRepository`：Avatar 配置总管，单例，`getInstance` 双重检查锁。
- `AvatarConfig`：单个 Avatar 的持久化配置（id / name / type / isBuiltIn / data）。
- `AvatarPersistenceDelegate`：类型扫描契约接口；6 个实现按文件特征识别模型目录。
- `AvatarConfigDecodeResult` / `decodePersistedAvatarConfigs`：prefs 配置 JSON 的容错解码，坏条目记下标丢弃。
- `AvatarSettings` / `AvatarInstanceSettings`：全局设置（当前 id、语音通话开关）与单形象实例设置（缩放位移）。
- `WorkflowRepository`：工作流 CRUD、调度同步、触发执行、执行记录。
- `workflowStoreMutex`：串行化工作流存储读写的全局锁。
- `runningWorkflowIds`：运行中工作流 id 的 StateFlow。
- `CustomEmojiRepository`：表情文件与元数据，按角色卡/角色组 scope 隔离。
- `SkillRepository`：Skill 门面；`importSkillFromGitHubRepoDetailed` / `importSkillFromDirectInput` / `importSkillFromZip` 三条导入路。
- `SkillManager`：Skill 真正的读写实现（core 层），本页仓库只做委托与可见性过滤。
- `PluginDenylistRepository`：黑名单云端拉取、本地缓存、按 SHA-256 拦截；`findDeniedImport`、`refreshFromRemote`、`cacheSignature`。
- `UIHierarchyManager`：无障碍桥 object 单例；`bindToService`、`getUIHierarchy`、`performClick` 等转发方法。

## 输入→处理→输出调用链

1. **Avatar 导入**：用户选 ZIP/模型文件 → `importAvatarFromUri` 按后缀分流 → ZIP 解压（canonicalPath 防穿越）→ 各 `AvatarPersistenceDelegate.scanDirectory` 识别 → 拷入用户目录 → `refreshAvatars` 重扫 → `_configs` StateFlow 更新，UI 列表刷新。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:827`

2. **Avatar 切换**：UI 调 `switchAvatar` → 新 id 写 `avatar_settings` → `updateCurrentAvatar` 经 `AvatarModelFactory.createModel` 构建运行时模型 → `_currentAvatar` 更新，渲染层跟随。
`app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt:652`

3. **工作流触发**：Tasker/Intent/冷启动/语音事件 → 对应 `triggerWorkflowsBy*Event` 匹配触发节点 → `triggerWorkflow` 三道校验 → 登记 `runningWorkflowJobs` → `WorkflowExecutor.executeWorkflow` 执行 → `NonCancellable` 落盘执行记录 → 更新统计 → 注销运行登记。
`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:552`

4. **表情添加**：用户选图 → `addCustomEmoji` 校验扩展名白名单 → UUID 文件名拷入 scope 目录 → `CustomEmojiPreferences` 写元数据 → Flow 推送，表情面板刷新。
`app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt:96`

5. **Skill GitHub 导入**：用户贴仓库 URL → `importSkillFromGitHubRepoDetailed` 解析目标 → 取默认分支 → `codeload` 拉 zip（池化/回退）→ `SkillManager.importSkillFromZipDetailed` 安装 → 返回安装目录。
`app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt:81`

6. **插件黑名单拦截**：`OperitApp` 启动调 `refreshFromRemote` → 指针+载荷双重校验 → `AtomicFile` 缓存 → `PackageManager` 扫描插件包时调 `findDeniedImport` 算 SHA-256 比对 → 命中拒绝导入。
`app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt:59`

7. **无障碍操作**：`AccessibilityUITools` 调 `getUIHierarchy` → `ensureBound` 自动绑定 → AIDL 取 XML → 解析节点 → `performClick` / `performSwipe` 等转发到提供者 App 执行。
`app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt:308`

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/repository/AvatarRepository.kt`（1206 行）
- `app/src/main/java/com/ai/assistance/operit/data/repository/AvatarConfigPersistence.kt`（74 行）
- `app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt`（997 行）
- `app/src/main/java/com/ai/assistance/operit/data/repository/CustomEmojiRepository.kt`（423 行）
- `app/src/main/java/com/ai/assistance/operit/data/skill/SkillRepository.kt`（438 行）
- `app/src/main/java/com/ai/assistance/operit/data/security/PluginDenylistRepository.kt`（216 行）
- `app/src/main/java/com/ai/assistance/operit/data/repository/UIHierarchyManager.kt`（502 行）
- 关联：`app/src/main/java/com/ai/assistance/operit/core/avatar/common/model/AvatarType.kt`、`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt`（黑名单调用点）、`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt`（黑名单刷新点）、`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt`（UI 桥调用方）
- 记忆与聊天历史见"记忆仓库"页（`MemoryRepository`、`MemoryAutoSaveCandidateRepository`）与"聊天历史仓库"页（`ChatHistoryManager`）。
