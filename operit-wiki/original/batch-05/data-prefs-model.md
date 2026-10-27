---
title: 模型与 API 配置（偏好设置）
module: 数据层
sources: ModelConfigManager.kt, ModelConfigData.kt, ApiPreferences.kt, CodexAuthPreferences.kt, ExternalHttpApiPreferences.kt, FreeUsagePreferences.kt, EnvPreferences.kt, VersionedPreferencesDataStore.kt, FunctionalConfigManager.kt, ApiKeyInfo.kt, ApiKeyFormatValidator.kt, StandardModelParameters.kt
date: 2026-10-01
---

# 模型与 API 配置（偏好设置）

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 把“连哪家模型、用哪个 Key、参数怎么调”存在哪里、怎么读写。

核心是 `ModelConfigManager`：用户在设置页创建的每一套模型配置（供应商类型、Key、端点、模型名、温度等参数），都会被序列化成 JSON，存进一个名叫 `model_configs` 的专有 DataStore。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:38`

三个要点先摆出来：

1. **配置多套并存**：配置 ID 列表记在 `config_list`，每套配置独立一条 JSON，键为 `config_{id}`。各功能（聊天、总结等）经 `FunctionalConfigManager` 绑定到某套配置，而不是写死用哪一套。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:66`
2. **Key 有两种管法**：单 Key（`apiKey` 字段）与 Key 池（`apiKeyPool` 加轮换）。Key 池支持按可用性标记挑选 Key。
   `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:107`
3. **敏感存储水位不一**：模型 API Key 是明文 JSON 落盘；Codex 的 OAuth 凭据走了 `EncryptedSharedPreferences` 加密存储；对外 HTTP 服务的 bearer token 也是明文。细节见“核心机制 4”。

本页只覆盖模型与 API 配置相关文件：`ApiPreferences` 中的模型默认常量与 `api_settings` 存储、`ModelConfigManager` 全套、`CodexAuthPreferences`、`ExternalHttpApiPreferences`、`FreeUsagePreferences`、`EnvPreferences`、版本化 DataStore 底座、`FunctionalConfigManager`。角色卡、主题、语音、记忆搜索等偏好由兄弟条目负责。

## AI 速览

- 核心符号：`ModelConfigManager`（配置总管）、`ModelConfigData`（配置数据体）、`ApiProviderType`（38 种供应商枚举）、`ApiKeyInfo`（Key 池条目）、`FunctionalConfigManager`（功能→配置映射）、`CodexAuthPreferences`（Codex 加密凭据）、`ExternalHttpApiPreferences`（对外 HTTP 服务配置）、`FreeUsagePreferences`（免费额度退避）、`EnvPreferences`（工具包环境变量）
- 主入口：读用 `getModelConfig(configId)` / `getModelConfigFlow(configId)`；写用 `saveModelConfig` 与各类 `update*` 方法，底层统一走 `updateConfigInternal` 事务
- 数据流向一句话：设置页 UI → `ModelConfigManager.update*` → `model_configs` DataStore（`config_{id}` 键存 JSON）→ 业务层经 `getModelConfigFlow` 订阅变更 → `AIServiceFactory` 按 `ApiProviderType` 构造供应商客户端发请求。

## 核心机制

### 1. 存储底座：版本化 DataStore

`model_configs` 经 `versionedPreferencesDataStore` 创建，偏好 schema 当前版本为 4。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:39`

版本升级时按版本号逐版本循环执行 `migrate`，直到追平 `currentVersion`；四次迁移的内容分别是：v0 在配置列表为空时创建全新默认配置，v1 为思考规则为空的配置按供应商补齐内置规则，v2 替换 OpenAI Chat 旧版 reasoning 规则，v3 为 DeepSeek 追加 responses 思考规则。
`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:84`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:97`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:293`

schema 版本号存放在 `__operit_preferences_schema_version` 键中；读到高于运行时的版本直接抛 `PreferencesSchemaVersionTooNewException`，拒绝降级读取。
`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:13`
`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:72`

JSON 解析器开启 `ignoreUnknownKeys` 与 `isLenient`，未知字段直接忽略，保证老版本数据能读。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:92`

### 2. 配置的增删改查

- **查列表**：`configListFlow` 以 Flow 暴露全部配置 ID；`configSummariesFlow` 暴露摘要列表，主界面模型选择器持续收集它，配置页改完无需重进即刷新。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:427`
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:436`
- **读单条**：`getModelConfigFlow(configId)` 返回 Flow 版，`getModelConfig(configId)` 返回挂起函数版。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:565`
- **新建**：`createConfig` 用 `UUID.randomUUID` 生成 ID，新配置默认供应商为 `OPENAI_GENERIC`（OpenAI 兼容自定义端点），并把新 ID 追加进 `config_list`。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:594`
- **删除**：`deleteConfig` 禁止删除 ID 为 `default` 的默认配置；删除前调用 `remapDeletedConfigReferences`，把引用该配置的功能全部指回默认配置；最后 `preferences.remove` 删掉 `config_{id}` 记录并返回受影响的功能列表。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:622`
- **更新**：所有写操作统一走 `updateConfigInternal`——在一次 `edit` 事务里读出现有配置、应用变换函数、写回 JSON，原子性由 DataStore 事务保证。
  `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:528`

### 3. API Key：单 Key 与 Key 池

`ModelConfigData` 里 Key 相关字段有四件套：`useMultipleApiKeys` 总开关（默认关）、`apiKeyPool`（`ApiKeyInfo` 列表，默认空）、`currentKeyIndex`（默认 0）、`keyRotationMode`（默认 `ROUND_ROBIN`，支持 `ROUND_ROBIN` / `RANDOM`）。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:107`
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:110`

`ApiKeyInfo` 每条记录 Key 的 id、key、名称、启用开关、可用性状态、累计用量、最后使用时间与连续错误次数。
`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyInfo.kt:27`

可用性只有 `UNTESTED` / `AVAILABLE` / `UNAVAILABLE` 三态。
`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyInfo.kt:11`

`updateSingleApiKey` 写入单个 Key 的同时强制关闭多 Key 模式。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:582`

`updateConfigKeyIndex` 推进当前 Key 索引，`updateApiKeyPoolSettings` 整体替换多 Key 开关与 Key 池。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:578`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:794`

Key 格式校验在 `ApiKeyFormatValidator`：`normalize` 先 trim；`isValid` 只要求非空且字符全部落在可打印 ASCII（`0x21..0x7E`），不做供应商格式校验。
`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:11`
`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:6`

`hasUsableKey` 的判定逻辑：单 Key 模式只看 `config.apiKey`；Key 池模式下若有 Key 被测过可用性，只认标为 `AVAILABLE` 的，否则认全部启用的 Key。
`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:21`
`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:25`

### 4. 敏感配置存储（重点）

**模型 API Key 明文落盘**：`ModelConfigData` 整体经 `json.encodeToString` 序列化后直接写入 DataStore，没有任何加密。同一目录下 Codex OAuth 凭据用了加密存储，两者安全水位不一致。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:524`

**Codex OAuth 凭据加密存储**：`CodexAuthPreferences` 使用 `EncryptedSharedPreferences`，存储库名为 `codex_oauth_credentials`；MasterKey 用 `AES256_GCM`，键加密 `AES256_SIV`、值加密 `AES256_GCM`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:107`
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:150`

`CodexAuthState` 包含 `accessToken`、`refreshToken`、`expiresAtMillis`、`accountId`，另有可选的 `residency` 与 `email`；`save` 要求三个必填项非空且过期时间大于 0。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:15`
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:34`

读取加密存储遇到 `SecurityException`（如备份恢复后 Keystore 丢失）时，`readState` 会删除整个存储并重建，保证设置页能打开，代价是用户被登出。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:68`

**对外 HTTP 服务 token 明文**：`ensureBearerToken` 在 token 为空时自动生成（UUID 去横线）并明文存入 `external_http_api_preferences`；端口用 `setPort` 写入，要求 1~65535。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:55`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:47`

**导入导出同样经手明文 Key**：`exportAllConfigs` 把全部配置（含 Key 明文）导出为 JSON 字符串；`importConfigs` 仅校验 id/name 非空即落盘，已存在的 ID 直接覆盖。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:1117`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:1139`

### 5. 思考档位（reasoning effort）配置

`thinkingConfigurations` 存思考规则 JSON，`thinkingOptionId` 存当前选中的档位 ID。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:137`

内置规则由 `ModelThinkingConfigDefaults.forProvider` 按供应商过滤：从内置 `DEFAULT_JSON` 里挑 `providers` 或 `providerTypeIds` 命中当前供应商的规则，剥离这两个字段后返回。例如 `openai-chat-reasoning-effort` 适用于 `OPENAI` / `OPENAI_GENERIC`，用 `modelRegex` 匹配推理模型，提供 low / medium / high 等档位。
`app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:400`
`app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt:9`

供应商不变时编辑配置保留现有规则与用户已选档位（DeepSeek 且端点为 `/responses` 时额外追加 responses 规则）；切换供应商时重置为新供应商的内置规则与首个档位。对应 `nextThinkingRulesForProvider` 与 `nextThinkingOptionIdForProvider`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:394`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:409`

### 6. 模型参数：标准参数与自定义参数

`StandardModelParameters.DEFINITIONS` 定义 7 个标准参数：`max_tokens`（默认 4096）、`temperature`（默认 1.0，范围 0~2）、`top_p`（默认 1.0，范围 0~1）、`top_k`（默认 0 即禁用，范围 0~100）、`presence_penalty` / `frequency_penalty`（默认 0.0，范围 -2~2）、`repetition_penalty`（默认 1.0，范围 0~2）。
`app/src/main/java/com/ai/assistance/operit/data/model/StandardModelParameters.kt:46`

每个标准参数在 `ModelConfigData` 里对应“值 + `*Enabled` 开关”两份字段，开关默认全关——参数只在开关打开时才真正发往 API。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:116`

`updateParameters` 按参数 id 把 7 个标准参数的值与开关写回配置，自定义参数单独序列化进 `customParameters`；`getModelParametersForConfig` 反向组装出完整参数列表供 UI 渲染，自定义参数解析失败只记日志不抛异常。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:818`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:978`

### 7. 供应商专属开关

各家特有能力以布尔开关形式挂在 `ModelConfigData` 上，默认全关：`updateGoogleSearch`（Gemini 的 Google Search Grounding）、`updateDeepSeekWebSearch`（DeepSeek Responses 服务端搜索）、`updateCodexWebSearch`（Codex 登录态服务端搜索）、`updateClaude1hPromptCache`（Claude 1 小时提示缓存）、`updateToolCall`（用模型原生 Tool Call 而非 XML 调工具，默认开）。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:898`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:917`

此外还有多媒体直通开关（图片/音频/视频直接处理，默认关）、自定义请求头 `customHeaders`（默认 `{}`）、请求限流（每分钟请求数与最大并发数，默认 0 即不限，写入时 `coerceAtLeast(0)`）。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:178`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:781`

上下文与总结：默认上下文 64.0、最大 200.0、总结 token 阈值 0.70、总结默认开启（按 token 与按 16 条消息双触发），经 `updateContextSettings` / `updateSummarySettings` 调整。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:61`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:923`

### 8. 本地引擎参数（停止维护）

`ApiProviderType.MNN`（MNN 本地推理引擎）与 `ApiProviderType.LLAMA_CPP`（llama.cpp 本地推理引擎）均为**停止维护**的端侧方案，配置里仍保留其参数字段：MNN 的 `mnnForwardType`（默认 0）与 `mnnThreadCount`（默认 4）；llama.cpp 的线程数（默认 4）、`llamaContextSize`（默认 2048）、`llamaGpuLayers`（默认 0）等。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:40`
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:163`
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:167`

`updateApiSettingsFull` 在更新主配置的同时一并写入这些本地引擎参数，并对 llama 线程数/上下文做 `coerceAtLeast(1)`、GPU 层数做 `coerceAtLeast(0)`。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:716`

### 9. 功能→配置映射

`FunctionalConfigManager` 把 `FunctionType` 映射到 `FunctionConfigMapping`（配置 ID + 模型索引），存放在 `functional_configs` DataStore。
`app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt:32`

`modelName` 支持逗号分隔写多个模型，`modelIndex` 决定用第几个（从 0 开始）；`getModelByIndex` 越界时回退到第一个。
`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:219`

查不到映射时回退到 `default` 配置；`setConfigForFunction` 可同时指定配置 ID 与模型索引；`resetAllFunctionConfigs` 一键全部指回默认。
`app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt:165`
`app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt:194`

### 10. 对外 HTTP API 与免费额度、环境变量

`ExternalHttpApiPreferences` 管 App 自带对外 HTTP 服务的开关、端口（默认 `8094`）与 bearer token；`ExternalChatHttpAutoStarter` 启动时读取该配置，未启用或端口非法则跳过自启。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:109`
`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpAutoStarter.kt:29`

`FreeUsagePreferences` 管免费 API 额度：`recordUsage` 采用指数退避，第 n 次使用后等待 2^(n-1) 天；`canUseFreeTier` 在今天不早于下次可用日期时放行。
`app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:135`
`app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:125`

它另有一份校验文件写在公共下载目录 `Downloads/Operit/usage_verification.dat`，内容是 `totalUsage|nextDate` 的明文拼接，启动时比对不一致就取外部与本地计数的最大值恢复。
`app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:93`
`app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:120`

`EnvPreferences` 为工具包提供环境变量：`getEnv` 先查应用偏好（`env_preferences`），查不到回退 `System.getenv`；支持整表替换与删除。
`app/src/main/java/com/ai/assistance/operit/data/preferences/EnvPreferences.kt:24`

`ApiPreferences` 本体是 `api_settings` 共享 DataStore 的读写器（双重检查单例），并提供新建默认配置用的两个常量：`DEFAULT_API_ENDPOINT`（`https://api.deepseek.com/v1/chat/completions`）与 `DEFAULT_MODEL_NAME`（`deepseek-v4-flash`）。
`app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:47`
`app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt:186`

## 关键符号

| 符号 | 角色 | 定义位置 |
|---|---|---|
| `ModelConfigManager` | 模型配置总管：增删改查、Key 池、参数、思考档位、导入导出 | `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:52` |
| `ModelConfigData` | 单套配置的数据体：Key、端点、模型、参数、开关全字段 | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:95` |
| `ApiProviderType` | 38 种供应商枚举，含 MNN / llama.cpp（停止维护） | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:7` |
| `ApiKeyInfo` | Key 池条目：Key、可用性、用量、错误计数 | `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyInfo.kt:33` |
| `ApiKeyFormatValidator` | Key 格式校验（可打印 ASCII）与可用 Key 判定 | `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:5` |
| `StandardModelParameters` | 7 个标准参数的定义仓库 | `app/src/main/java/com/ai/assistance/operit/data/model/StandardModelParameters.kt:40` |
| `ModelConfigSummary` | 列表展示用简化配置（含模型索引字段） | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:206` |
| `FunctionalConfigManager` | 功能→配置映射（配置 ID + 模型索引） | `app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt:66` |
| `CodexAuthPreferences` | Codex OAuth 凭据的加密存储 | `app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:28` |
| `CodexAuthManager` | Codex 登录态管理：token 刷新、登出、用快照 | `app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:17` |
| `ExternalHttpApiPreferences` | 对外 HTTP 服务的开关、端口、bearer token | `app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt:28` |
| `FreeUsagePreferences` | 免费额度指数退避与外部校验文件 | `app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt:14` |
| `EnvPreferences` | 工具包环境变量（偏好优先，`System.getenv` 兜底） | `app/src/main/java/com/ai/assistance/operit/data/preferences/EnvPreferences.kt:12` |
| `versionedPreferencesDataStore` | 版本化 DataStore 构造器，迁移底座 | `app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:30` |

## 输入→处理→输出调用链

**主链：模型配置读写**

1. **输入**：用户在模型配置页填写 Key、端点、模型名、调参、选思考档位；或业务代码发起聊天请求需要当前配置。
2. **处理**：UI 调用 `ModelConfigManager` 的 `update*` 方法（如 `updateModelConfig`、`updateParameters`、`updateThinkingOptionId`），统一经 `updateConfigInternal` 在一次 `edit` 事务里读-改-写 `model_configs`；`ApiConfigDelegate` 经 `flatMapLatest(getModelConfigFlow)` 订阅配置变更，配置一切换下游自动刷新。
   `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt:528`
   `app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:217`
3. **输出**：`ModelConfigData`（Key、端点、模型、参数、思考档位、供应商开关）进入请求流水线，`AIServiceFactory` 按 `ApiProviderType` 构造对应供应商客户端；各功能经 `FunctionalConfigManager` 查到自己绑定的配置 ID 与模型索引。

**Codex 鉴权链**

1. **输入**：用户完成 ChatGPT OAuth 登录，拿到 access/refresh token。
2. **处理**：`CodexAuthManager.saveLoginTokens` 解析 JWT 声明（accountId、过期时间）→ `CodexAuthPreferences.save` 加密落盘；`getValidAccessToken` 在距过期不足 5 分钟时才在 `Mutex` 下刷新，否则直接复用。
   `app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:32`
   `app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:57`
3. **输出**：有效的 access token 供 Codex 供应商客户端调用；`fetchUsage` 成功后把用量快照存入 `CodexUsagePreferences`。
   `app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:115`

**对外 HTTP 服务链**

1. **输入**：用户在设置中打开对外 HTTP API 开关、设端口。
2. **处理**：`ExternalHttpApiPreferences` 持久化开关/端口/token；`ExternalChatHttpAutoStarter` 在启动时读取，未启用或端口非法则跳过。
3. **输出**：本机 HTTP 服务在配置端口上启动，外部调用凭 bearer token 鉴权。

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/preferences/ModelConfigManager.kt` —— 模型配置总管（读写、Key 池、参数、思考档位、导入导出、迁移）
- `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt` —— `ModelConfigData`、`ApiProviderType`、`ModelConfigDefaults`、`ModelConfigSummary`
- `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyInfo.kt` —— Key 池条目与可用性三态
- `app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt` —— Key 格式校验
- `app/src/main/java/com/ai/assistance/operit/data/model/StandardModelParameters.kt` —— 7 个标准参数定义
- `app/src/main/java/com/ai/assistance/operit/data/preferences/ApiPreferences.kt` —— `api_settings` 存储与模型默认常量
- `app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt` —— Codex OAuth 加密凭据存储
- `app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt` —— Codex 登录态管理（调用方）
- `app/src/main/java/com/ai/assistance/operit/data/preferences/ExternalHttpApiPreferences.kt` —— 对外 HTTP 服务配置
- `app/src/main/java/com/ai/assistance/operit/data/preferences/FreeUsagePreferences.kt` —— 免费额度退避
- `app/src/main/java/com/ai/assistance/operit/data/preferences/EnvPreferences.kt` —— 工具包环境变量
- `app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt` —— 版本化 DataStore 迁移底座
- `app/src/main/java/com/ai/assistance/operit/data/preferences/FunctionalConfigManager.kt` —— 功能→配置映射
- `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt` —— 内置思考规则
- `app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt` —— 配置订阅与落盘（调用方）
- `app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpAutoStarter.kt` —— 对外 HTTP 服务自启（调用方）
