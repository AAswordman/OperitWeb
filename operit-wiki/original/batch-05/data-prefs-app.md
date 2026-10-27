---
title: 应用基础/主题/语音/记忆搜索配置
module: 数据层
sources: UserPreferencesManager.kt, DisplayPreferencesManager.kt, ThemePreferenceSnapshot.kt, ThemeScopeMigrationPolicy.kt, ThemeTargetOperationCoordinator.kt, SpeechServicesPreferences.kt, SpeechServiceProfilesPreferences.kt, WakeWordPreferences.kt, MemorySearchSettingsPreferences.kt, VersionedPreferencesDataStore.kt, AgreementPreferences.kt, CustomEmojiPreferences.kt, FunctionalConfigManager.kt, GitHubAuthPreferences.kt, GitHubAuthBus.kt, ExternalHttpApiPreferences.kt, FreeUsagePreferences.kt, RemoteAnnouncementPreferences.kt, MarketAgreementPreferences.kt, SkillVisibilityPreferences.kt, ToolCollapseMode.kt, EnvPreferences.kt, AndroidPermissionPreferences.kt
date: 2026-10-01
---

# 应用基础/主题/语音/记忆搜索配置

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 把"用户能调的东西"都存在哪里、怎么存。包括三块内容：

1. **应用基础**：语言、主题、记忆空间（用户配置档）、各类显示开关，由 `UserPreferencesManager` 统一管，全部走 Android DataStore。
2. **语音**：TTS/STT 用哪家引擎、唤醒词怎么配。现在是"画像制"——多套配置并存，用户可以命名、切换、删改；老代码读的旧单配置只是 active 画像的一个投影。
3. **记忆搜索**：搜索打分权重、记忆自动保存间隔、云端 embedding 配置，按用户配置档（profileId）隔离存放。

注意边界：模型配置（`ApiPreferences`/`ModelConfigManager`）和角色卡（`CharacterCardManager` 等）不在本页，那是兄弟条目的地盘。`FunctionalConfigManager`（功能→模型映射）本质上也属于模型配置条目，本页只记录它的存储形态供引用。

## AI 速览

- 核心符号：`UserPreferencesManager`（应用基础总管）、`DisplayPreferencesManager`（显示/行为偏好）、`ThemePreferenceSnapshot`/`ThemePreferenceValues`（主题快照模型）、`ThemeScopeMigrationPolicy`（主题迁移策略）、`ThemeTargetOperationCoordinator`（主题操作串行化）、`SpeechServiceProfilesPreferences`（TTS/STT 画像）、`SpeechServicesPreferences`（legacy 旧单配置）、`WakeWordPreferences`（唤醒词配置）、`MemorySearchSettingsPreferences`（记忆搜索配置）、`VersionedPreferencesDataStore`（DataStore schema 迁移基建）
- 主入口：`UserPreferencesManager.getInstance(context)` / `initUserPreferencesManager(context)`；语音走 `SpeechServiceFactory.createSpeechService` / `VoiceServiceFactory.createVoiceService` 按当前画像分发
- 数据流向一句话：设置页调用 suspend 写入 → DataStore（`user_preferences` / `speech_service_profiles` / `wake_word_preferences` 等）持久化 → 各 `Flow` 发射新值 → UI 或引擎工厂响应式消费。

## 核心机制

### 1. UserPreferencesManager：应用基础配置的总闸

这是应用里最大的偏好管理类，管 DataStore 名为 `user_preferences` 的仓库。
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:30`

它采用双重检查锁单例（`@Volatile` + `synchronized`），顶层还有一个 `preferencesManager` 全局访问器——实例没初始化就用它会直接抛 `IllegalStateException`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:67`
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:38`

它管的东西分几大类：

- **应用语言**：键 `app_language`，默认 `LanguageCodes.AUTO`（跟随系统）。读有 `Flow` 版 `appLanguage`，写有 suspend 版 `saveAppLanguage`，另有一个用 `runBlocking` 包的同步读取 `getCurrentLanguage`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:82`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:351`
- **记忆空间**：这是"用户配置档"的新形态。活跃空间 id 存在 `active_memory_space_id`，空间列表存在 `memory_space_list`（JSON 编码的 id 数组），每个空间的元数据存在 `memory_space_<id>` 键里（JSON 编码的 `MemorySpace`）。默认空间 id 是 `"default"`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:78`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:79`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:253`
- **海量主题键**：`THEME_MODE`、`CUSTOM_PRIMARY_COLOR`、气泡颜色/字体/背景图/模糊/透明度等上百个键（见下文主题机制）。
- **UI 行为开关**：思考过程是否展示、token 统计、时间戳、头像形状等 `KEY_SHOW_*` 系列。
- **布局微调**：聊天区内边距、Markdown 行高/字距/段距、长粘贴文本转文件阈值（默认 3000 字符）等。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:341`
- **软件身份**：`software_identity`，默认 `operit_ai`，另有一个 `lingshu_ai` 备选常量。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:271`

记忆空间的生命周期有几个硬规则：

- `ensureDefaultMemorySpace` 保证默认空间一定存在。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:432`
- `createMemorySpace` 新建空间时 id 用 `memory_<时间戳>`，并把空间文档仓库（`MemorySpaceProfileDocumentRepository`）也加载起来。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:441`
- `setActiveMemorySpace` 对未知 id 直接 `require` 抛错，不接受野 id。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:460`
- `deleteMemorySpace` 禁止删默认空间；删空间时把绑定到该空间的角色卡重置为跟随全局，并连带删除空间文档与 ObjectBox 数据库。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:472`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:488`

还有一套"旧配置档 → 记忆空间"的迁移：`readLegacyUserProfiles` 读旧 `profile_list` 键，`migrateLegacyProfilesToMemorySpaces` 写成新键并删除旧键。迁移时旧的 6 个分类锁定（生日/性别/个性等）会被折算成新空间的 `profileAutoUpdateLocked`（文档级锁定）。
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:497`
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:544`
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:572`

### 2. 主题系统：按"目标"分作用域，而不是全局一套

Operit 的主题不是全局一份，而是按"目标"（角色卡 / 角色组）分作用域存的，全部挤在同一个 `user_preferences` DataStore 里，用键前缀隔离：

- 角色卡：`character_card_theme_<id>_`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:797`
- 角色组：`character_group_theme_<id>_`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:800`

主题数据本身建模成不可变快照。`ThemePreferenceValues` 是四个原始值 Map（strings/booleans/ints/floats）的容器，提供 `with*` 不可变更新器和 `required*` 必填读取器；`defaultVisual()` 给出一整套默认视觉配置：浅色主题、跟随系统主题开、cursor 聊天样式、agent 输入样式、字体缩放 1.0、背景图透明度 0.3、气泡图片渲染用平铺九宫格等。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:3`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:49`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:57`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:123`

`ThemePreferenceSnapshot(source, sourceId, values)` 是只读视图，约 90 个派生属性把 UI 要的字段逐一暴露。快照由 `readThemePreferenceValues` 生成：先以 `defaultVisual()` 为基底，再叠加带前缀的实际存储值；还有个兼容逻辑，把横向 repeat 值复制给缺失的纵向 repeat 键。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:154`
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:939`

历史上存在无前缀的"旧全局"主题键。迁移策略是一个纯函数 `ThemeScopeMigrationPolicy.shouldCopyLegacyThemeToDefaultCharacter`：已迁移过 / 默认角色卡已有主题 / 已存在任意分作用域主题 → 不迁；否则当默认角色卡本次被创建、或当前激活的就是默认卡时，把旧全局键复制到默认卡前缀下。注意一个实锤细节（见代码走查）：执行函数无论迁没迁都会把完成标记写 true，迁移只有一次机会，时机不对的话旧主题就成孤儿数据了。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemeScopeMigrationPolicy.kt:4`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemeScopeMigrationPolicy.kt:12`
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:1150`

并发控制靠 `ThemeTargetOperationCoordinator`：一个 Mutex + `runTransition`，把"切换 active prompt"和"主题读写"串行化，避免主题写到错误目标。`ActivePromptManager` 的主题相关操作（设置 active prompt、提交主题草稿、重置草稿等）全部走它。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemeTargetOperationCoordinator.kt:6`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ThemeTargetOperationCoordinator.kt:9`

观察主题用 `observeThemePreferenceSnapshot(characterCardId, characterGroupId)`，返回带 `distinctUntilChanged` 的 `Flow<ThemePreferenceSnapshot>`；两个 id 都空就抛错。
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:1205`
`app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:1225`

### 3. 显示偏好：DisplayPreferencesManager

这是一个独立的 DataStore（名 `display_preferences`），管"显示与行为"类偏好：FPS 计数器、回复通知（开关/声音/震动）、回车发送、导航动画、启动进新聊天、全局用户头像/昵称、后台保活、实验性虚拟屏、截图参数（格式 JPG、质量 75、缩放 75%）、网页访问等待秒数、工具包 hook 超时（写入钳制 1..60 秒）、虚拟屏码率（默认 3000）、工具折叠模式等。
`app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:18`
`app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:172`
`app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:262`

注意：这里面的截图参数、网页等待、hook 超时等，实际是供给工具/自动化能力的执行参数（`PhoneAgent` 截图、`StandardWebVisitTool` 等待等），只是"挂靠"在显示配置名下，不要把它们理解成纯 UI 项。

写入用 `saveDisplaySettings`，19 个参数全可空，只写非空项（`?.let` 包裹）；另有一批 `runBlocking` 同步 getter 供非 Compose 调用方用，主线程调用有 ANR 风险（见代码走查）。
`app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:210`
`app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:231`
`app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:270`

### 4. 语音：画像制（profiles），legacy 旧存储只是投影

这是本页最值得讲的一块。现在的语音配置是"画像制"：TTS 和 STT 各有一套画像列表。

`TtsProfile` 有 10 个字段：id、name、serviceType、httpConfig、vitsConfig、cleanerRegexs、speechRate、pitch、createdAt、updatedAt；`SttProfile` 有 6 个字段，没有语速/音调/清理正则。画像存 DataStore `speech_service_profiles`（schema 版本 1），当前画像 id 存在 `current_tts_profile_id` / `current_stt_profile_id`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:41`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:55`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:24`

画像支持：创建（id 用随机 UUID，创建后立即设为 active）、更新（语速音调必须大于 0，`createdAt` 保留只刷 `updatedAt`）、选择、删除（禁止删当前 active 的画像）。首次启动时 schema 迁移把 legacy 单配置转成 `legacy-tts-profile` / `legacy-stt-profile` 画像。
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:204`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:225`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:313`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:84`

关键设计：**画像是真相源**，老文件 `SpeechServicesPreferences`（DataStore 名 `speech_services_preferences`）只是"活跃画像投影"。每次 create/update/select 之后都会调 `projectTtsProfile` / `projectSttProfile` 把 active 画像写回旧存储，保证旧 provider 的请求契约不变。
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:346`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:28`

默认引擎：TTS 默认 `SIMPLE_TTS`（Android 系统 TTS），STT 默认 `SHERPA_NCNN`（本地识别）。旧值 `SHERPA_MNN` 已被映射为 `SHERPA_NCNN`——MNN 是停止维护的方案，这里做了兼容。
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:77`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:78`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:113`

`TtsHttpConfig` 是通用 HTTP TTS 的配置结构：urlTemplate、apiKey、headers、httpMethod（默认 GET）、requestBody（支持 `{text}` 占位符）、contentType、localeTag、voiceId、modelName、responsePipeline。默认 STT HTTP 预设指向 OpenAI 转写接口，模型 `whisper-1`，apiKey 默认为空（无硬编码密钥）。
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:37`
`app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:100`

### 5. 唤醒词配置：WakeWordPreferences

DataStore 名 `wake_word_preferences`（schema 版本 1）。可配的参数：

- 常听总开关（默认 false）、唤醒词文本（默认取字符串资源）、唤醒词是否按正则匹配（默认 false）
- 识别模式：`STT`（流式识别）或 `PERSONAL_TEMPLATE`（个人声纹模板），默认 `stt`
- 个人唤醒模板：`List<PersonalWakeTemplate>`，每条只有 `features: List<Float>` 声纹特征向量——**没有阈值/灵敏度/模型路径可配**，判定阈值硬编码在识别器里（`PersonalWakeListener` 的 0.865f 等），用户调不了
- 语音通话无操作超时（默认 5 秒）、唤醒问候（默认开）、唤醒建新群（默认关）
- 语音自动附加：默认开，默认 4 项——屏幕 OCR、通知、位置、时间；schema 迁移只补缺失项不删已有项，解析失败回退到默认 4 项
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:21`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:36`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:42`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:64`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:141`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:244`

### 6. 记忆搜索配置：MemorySearchSettingsPreferences

按 `profileId` 隔离：搜索配置存 `memory_search_settings_<profileId>`，云端 embedding 配置独立存 `cloud_embedding_settings_<profileId>`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:10`

管四件事：

1. **搜索打分权重**：scoreMode（默认 BALANCED）、keywordWeight（默认 10.0）、tagWeight（0.0）、vectorWeight（0.0）、edgeWeight（0.4）。读写都会调 `normalized()` 做归一化。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:21`
   `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:27`
2. **记忆自动保存间隔**：默认 5 分钟，读写都钳制在 1..30 分钟；保存新间隔时会同步把"下次运行时间"写成现在 + 间隔。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:46`
   `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:55`
3. **记忆抽取自定义规则**：默认空字符串。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:63`
4. **云端 embedding 配置**：默认关闭，endpoint/apiKey/model 默认都为空。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:89`

### 7. 偏好存储基建：VersionedPreferencesDataStore

给 DataStore 加 schema 版本迁移的通用基建：版本号存在 `__operit_preferences_schema_version` 键里，缺失视为版本 0；迁移按版本号逐个递增执行；存的版本号比代码声明的新就抛 `PreferencesSchemaVersionTooNewException`；没注册的迁移版本抛 `MissingPreferencesSchemaMigrationException`。语音画像、唤醒词、功能配置等多个存储都在用它。
`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:12`
`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:84`
`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:71`

### 8. 其他应用基础小配置

- **AgreementPreferences**：用户协议接受状态。判定条件是存的版本号等于 `CURRENT_AGREEMENT_VERSION`（当前 `"2026-07-15"`）；协议实质变更就 bump 版本号，用户要重新接受。对外暴露 `StateFlow<Boolean>`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/AgreementPreferences.kt:22`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/AgreementPreferences.kt:35`
- **MarketAgreementPreferences**：插件市场协议，同模式，当前版本 `"2026-08-08.1"`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/MarketAgreementPreferences.kt:26`
- **RemoteAnnouncementPreferences**：远程公告已读版本，只存一个 int；新公告版本号大于已读版本才展示。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/RemoteAnnouncementPreferences.kt:14`
- **ExternalHttpApiPreferences**：本机对外 HTTP API（供外部程序调本 App）的开关（默认关）、端口（默认 8094，校验 1..65535）、bearer token（为空时生成去横线随机 UUID）。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:31`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:109`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:130`
- **FreeUsagePreferences**：免费额度管理。指数退避：第 n 次使用后等 2^(n-1) 天；用 Downloads 下的 `Operit/usage_verification.dat` 防"清数据"作弊。但"验证哈希"实际是明文拼接，可被伪造（见代码走查）。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:138`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:91`
- **GitHubAuthPreferences / GitHubAuthBus**：GitHub OAuth 登录态、access/refresh token、用户信息、进行中的 OAuth 事务。申请 scope 为 `notifications,public_repo,user:email,read:user`；会话有效要求 authVersion>=3 且 scope 齐全；登出清空整个 DataStore。auth code 只走内存总线 `GitHubAuthBus`（StateFlow），不持久化。注意：token 明文存储是高危项（见代码走查）。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt:42`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt:227`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthBus.kt:6`
- **CustomEmojiPreferences**：自定义表情元数据（DataStore 存 JSON），按角色卡/角色组分目标存；表情文件本身在 `filesDir/custom_emoji/<target>/`。内置 9 类表情；JSON 坏了记日志返回空列表不抛错。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CustomEmojiPreferences.kt:58`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CustomEmojiPreferences.kt:47`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/CustomEmojiPreferences.kt:26`
- **SkillVisibilityPreferences**：控制 skill 是否对 AI 可见。存储 key 由 skill 名做 SHA-256 取前 16 位 hex 派生；旧 key 格式兼容并自动迁移；没设置过的 skill 默认可见。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/SkillVisibilityPreferences.kt:20`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/SkillVisibilityPreferences.kt:57`
- **EnvPreferences**：给 tool 包用的类环境变量中心。取值顺序：SharedPreferences 非空值优先，否则回落 `System.getenv`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/EnvPreferences.kt:24`
- **ToolCollapseMode**：工具调用在 UI 上的折叠展示模式枚举：`read_only` / `all` / `full`；未知字符串回落 `all`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ToolCollapseMode.kt:4`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ToolCollapseMode.kt:9`
- **FunctionalConfigManager**：功能类型 → 模型配置 ID 的映射（DataStore `functional_configs`，schema 版本 1），引用已删配置时回落到 `("default", 0)`。**这份内容归属模型配置条目**，本页仅记录其存储形态。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt:17`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt:42`
- **AndroidPermissionPreferences**：Android 权限级别偏好。DataStore 名 `android_permission_preferences`，存三样：首选权限级别（`preferred_permission_level`，未设置读出 null）、root 命令执行模式（`root_execution_mode`，未设置回落 AUTO）、自定义 su 命令（`custom_su_command`，空则归一化为 `su`）。执行模式枚举 `RootCommandExecutionMode`（AUTO / FORCE_LIBSU / FORCE_EXEC，未知字符串回落 AUTO）。全局单例经 `initAndroidPermissionPreferences` 双重检查锁初始化（可重复调用）。同步 getter 全用 runBlocking 包 `Flow.first()`（文档注明这是阻塞调用，应在非 UI 线程使用）；`resetPermissionLevel` 删权限级别键，`resetRootExecutionSettings` 删执行模式 + 自定义 su 两个键。注意：DataStore 官方不支持多进程访问，而初始化入口文档写明"可被多个进程组件重复调用"（见代码走查）。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/AndroidPermissionPreferences.kt:17`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/AndroidPermissionPreferences.kt:40`

## 关键符号

| 符号 | 位置 | 作用 |
|---|---|---|
| `UserPreferencesManager` | `app/src/main/java/com/ai/assistance/operit/data/preferences/UserPreferencesManager.kt:62` | 应用基础配置总管（单例） |
| `DisplayPreferencesManager` | `app/src/main/java/com/ai/assistance/operit/data/preferences/DisplayPreferencesManager.kt:26` | 显示/行为偏好（独立 DataStore） |
| `ThemePreferenceValues` | `app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:3` | 主题不可变值容器（四类 Map） |
| `ThemePreferenceSnapshot` | `app/src/main/java/com/ai/assistance/operit/data/preferences/ThemePreferenceSnapshot.kt:154` | 主题只读快照视图 |
| `ThemeScopeMigrationPolicy` | `app/src/main/java/com/ai/assistance/operit/data/preferences/ThemeScopeMigrationPolicy.kt:3` | 旧全局主题迁移判定（纯函数） |
| `ThemeTargetOperationCoordinator` | `app/src/main/java/com/ai/assistance/operit/data/preferences/ThemeTargetOperationCoordinator.kt:6` | 主题操作 Mutex 串行化 |
| `SpeechServiceProfilesPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServiceProfilesPreferences.kt:38` | TTS/STT 画像管理（真相源） |
| `SpeechServicesPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/SpeechServicesPreferences.kt:30` | legacy 旧单配置（活跃画像投影） |
| `WakeWordPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/WakeWordPreferences.kt:28` | 唤醒词/语音交互配置 |
| `MemorySearchSettingsPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/MemorySearchSettingsPreferences.kt:8` | 记忆搜索/自动保存/云 embedding 配置 |
| `VersionedPreferencesDataStore` | `app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt` | DataStore schema 迁移基建 |
| `GitHubAuthPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt:39` | GitHub OAuth 凭证管理 |
| `ExternalHttpApiPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:27` | 本机对外 HTTP API 配置 |
| `FreeUsagePreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:16` | 免费额度与退避管理 |
| `ToolCollapseMode` | `app/src/main/java/com/ai/assistance/operit/data/preferences/ToolCollapseMode.kt:3` | 工具调用折叠模式枚举 |
| `AndroidPermissionPreferences` | `app/src/main/java/com/ai/assistance/operit/data/preferences/AndroidPermissionPreferences.kt:54` | 权限级别/root 执行模式/自定义 su 命令偏好（独立 DataStore） |

## 输入→处理→输出调用链

### 链路 A：分目标主题设置

1. **输入**：用户在主题设置页调整 → `ThemeEditorSession` 累积 `ThemePreferenceValues` → 确认后调 `ActivePromptManager.commitThemeDraft(target, values)`（或 `mutateActiveThemeForPrompt` / `resetThemeDraft`）。
2. **处理**：`ThemeTargetOperationCoordinator.runTransition` 拿 Mutex → `UserPreferencesManager.replaceThemeForPrompt`：按目标算出 `character_card_theme_<id>_` 前缀 → 同一个 `DataStore.edit` 事务内写视觉值（空值删键）+ 写元数据（AI 头像 URI、自定义聊天标题）。
3. **输出**：DataStore 流变化 → `activeThemePreferenceSnapshotFlow`（跟随 active prompt 切换）发射新 `ThemePreferenceSnapshot` → Compose 树经 `LocalThemePreferenceSnapshot` 下发 → 各组件按快照派生属性重组。

### 链路 B：语音服务选择（STT）

1. **输入**：设置页创建/选择 STT 画像 → `SpeechServiceProfilesPreferences.createSttProfile` / `selectSttProfile` 写画像列表与 `current_stt_profile_id` → `projectSttProfile()` 把 active 画像写回 legacy 旧存储。
2. **处理**：`SpeechServiceFactory.createSpeechService(context)` 读当前 STT 画像，按 `serviceType` 分发：`SHERPA_NCNN` 走本地 Sherpa-ncnn 识别，`OPENAI_STT` / `DEEPGRAM_STT` 走云端（传 endpointUrl/apiKey/model）。唤醒专用路径 `createWakeSpeechService` 把云端类型强制降级为 `SHERPA_NCNN`，唤醒检测永远走本地。
3. **输出**：调用方拿到 `SpeechService` 实例做语音识别；TTS 侧同理经 `VoiceServiceFactory` 按画像构造 provider。

### 链路 C：唤醒词检测

1. **输入**：`WakeWordPreferences` 持久化常听开关、唤醒词文本、正则开关、识别模式、个人声纹模板、问候/建群/auto-attach 配置。
2. **处理**：`AIForegroundService` 订阅各 flow；`STT` 模式用当前 STT 服务流式识别并 `matchWakePhrase` 判定（含正则开关）；`PERSONAL_TEMPLATE` 模式走 `PersonalWakeListener` 做声纹相似度比对（阈值硬编码，用户不可调）。
3. **输出**：命中唤醒 → 唤醒问候；若开启唤醒建群，`FloatingChatService` 按配置建群；浮窗按 auto-attach 项的 keywords 自动附加屏幕 OCR/通知/位置/时间上下文。

### 链路 D：记忆自动保存

1. **输入**：`MemorySearchSettingsPreferences` 存自动保存间隔（默认 5 分钟）与下次运行时间。
2. **处理**：`MemoryAutoSaveScheduler` 读间隔、写下次运行时间；`MemoryQueryToolExecutor` 读搜索权重做打分；`MemoryRepository` 读云 embedding 配置。
3. **输出**：定时触发记忆抽取与保存；搜索按权重（关键词/标签/向量/边）打分排序。

## 来源

本页事实全部来自 Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）源码 `app/src/main/java/com/ai/assistance/operit/data/preferences/` 目录下 22 个文件的全文阅读，及以下调用方/被调用方的抽读：`ActivePromptManager.kt`、`api/speech/SpeechServiceFactory.kt`、`api/voice/VoiceServiceFactory.kt`、`api/chat/AIForegroundService.kt`（唤醒词订阅段）、`services/FloatingChatService.kt`（唤醒建群段）、`core/tools/agent/PhoneAgent.kt`（截图参数段）、`core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt`、`api/chat/library/MemoryAutoSaveScheduler.kt`、`data/repository/MemoryRepository.kt`、`ui/theme/ThemePreferenceLocals.kt`。原子事实清单见 `data-prefs-app.facts.json`（共 245 条），代码走查见 `data-prefs-app.quality.json`（共 21 条，高危 2 / 警告 10 / 建议 9）。
