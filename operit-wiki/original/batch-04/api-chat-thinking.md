---
title: thinking 配置机制（ThinkingQualityMapping）
module: app
sources: 1
date: 2026-10-01
---

# thinking 配置机制（ThinkingQualityMapping）

## 概述

- 不同渠道的"思考"（reasoning/thinking）参数写法各不相同，Operit 不再为每个渠道硬编码翻译表，而是引入一套**用户可配的 JSON 规则**：规则按渠道、模型名、endpoint 匹配，命中后把"开关/档位"翻译成往请求体里写哪些 JSON 字段。
- 一句话：`ThinkingQualityMappingRegistry.resolve` 按"JSON 数组顺序=优先级"挑出第一条全命中的启用规则，转成 `ThinkingQualityMapping`；`ThinkingConfigurationApplier.apply` 再按开关状态与所选档位，把规则里的 JSON path 动作写进请求体。
- 控件分三种：LEVELS（多档位，如 low/medium/high）、TOGGLE_ONLY（只有开/关）、UNSUPPORTED（该渠道不支持 thinking）。
- 与 [[api-chat|云端 Chat API 接入（总览）]] 的关系：本页是"thinking 参数怎么写进请求体"的规则引擎；Key 的轮询见 [[api-chat-keypool|Key 池轮询]]，配置就绪判定与连接测试见 [[api-chat-params|统一参数模型与自定义参数]]。

## AI 速览

- **核心符号**：`ThinkingQualityControl`（LEVELS/TOGGLE_ONLY/UNSUPPORTED）、`ThinkingQualityMapping`（命中规则转出的可用映射）、`ThinkingQualityMappingRegistry`（规则解析与匹配）、`ThinkingConfigurationRule`（单条 JSON 规则）、`ThinkingModelMatcher`（8 种模型名匹配）、`ThinkingConfigurationApplier`（把映射写进请求体）、`ThinkingQualityJsonAction`（path/value/overwrite 写动作）、`ThinkingQualityWireValue`（Text/Number/Omitted 线值）。
- **主入口**：`ThinkingQualityMappingRegistry.resolve(providerTypeId, modelName, apiEndpoint, thinkingConfigurations)`（选规则）、`ThinkingConfigurationApplier.apply(requestJson, ...)`（写请求体）。
- **数据流向一句话**：JSON 配置 → `parseRules` 过滤启用规则 → 首条 provider+model+endpoint 全命中者 `toMapping()` → `apply` 按开关二选一执行 enabled/disabledActions，LEVELS 再叠加所选档位的 actions → 请求体 JSONObject 被原地修改。

## 核心机制

### 控件三态与映射模型

- `ThinkingQualityControl` 只有三值：LEVELS、TOGGLE_ONLY、UNSUPPORTED。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:12`
- `ThinkingQualityWireValue` 描述选项在线上的形态：Text 文本、Number 数字、Omitted 不发送。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:14`
- `ThinkingQualityJsonAction` 是最小写单元：path（点分路径）、value、overwrite（默认 false）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:27`
- `ThinkingQualityMapping` 是规则命中后的可用形态：control、parameterLabel、options，reasoningRequired 默认 false，disabledValue 默认 null，另带开关两态的 enabledActions/disabledActions。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:33`
- `toggleOnly` 构造纯开关映射；`unsupported()` 构造空映射。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:43`
- `optionFor(id)` 按 id 找档位；`textValueFor`/`numberValueFor` 取档位的文本/数字线值。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:49`

### 规则匹配（ThinkingQualityMappingRegistry）

- `resolve` 有 2/3/4 参三个重载，最终都走到四参版本。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:55`
- 优先级规则：JSON 数组顺序即用户可见优先级，首个"provider+model+endpoint 全命中"的启用规则胜出转映射；无命中返回 `unsupported()`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:65`
- `resolveForModel` 是 suspend 版 resolve。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:79`
- `validateConfigurations` 把配置解析一遍，用于保存前校验写法。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:88`
- `formatConfigurations` 按 2 缩进美化 JSON。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:92`
- `parseRules` 只保留 enabled 为 true 的规则。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:101`
- `rulesArray` 兼容三种配置形态：JSON 数组、含 rules 数组的对象、其他。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:112`
- 空配置经 `normalizedJsonText` 视作 `[]`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:124`

### 单条规则（ThinkingConfigurationRule）

- `matches` 三关：provider 去空白转大写后比对（providerIds 为空或忽略大小写命中其一即过），且模型匹配，且 endpoint 匹配。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:142`
- `endpointMatches`：无后缀约束直接 true；endpoint 为空返回 false。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:149`
- endpoint 归一化：去空白、去 `?` 查询串、去 `#` 片段、去尾斜杠、转小写；任一后缀 `endsWith` 命中。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:161`
- `fromJson` 的字段别名：parameterLabel 取 `parameterLabel`/`label`；enabledActions 取 `enable`/`enabledActions`/`on`；disabledActions 取 `disable`/`disabledActions`/`off`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:181`
- disabledValue 缺省时，从 disabledActions 里 path 等于 parameterLabel 的首个 String 值回退。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:185`
- providerIds 合并 `providers` 与 `providerTypeIds` 两处；control 缺省 `unsupported`，拼写错误的值也落到 UNSUPPORTED。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:191`
- reasoningRequired 取 `required` 或 `reasoningRequired`；endpointSuffixes 聚合 `match.endpointSuffix` 与顶层 `endpointSuffix`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:198`

### 模型匹配器（ThinkingModelMatcher）

- 8 种条件：整模型的 prefix/contains/suffix/regex，首段相等，尾段 prefix/contains/regex。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:212`
- 无任何条件直接匹配全部模型；模型名转小写后按 `/` 切段取首尾。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:222`
- prefix/contains/suffix 比小写后的串；regex 忽略大小写。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:230`
- 每种条件合并 `match` 对象与规则根对象两处。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:251`

### 写请求体（ThinkingConfigurationApplier）

- 带 Context 的 `apply` 重载直接转调无 Context 版本（注释要求：所选档位只读模型配置，不读全局偏好）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:266`
- `apply` 返回解析出的映射；control 为 UNSUPPORTED 时直接返回，不写任何参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:303`
- 生效开关 = `enableThinking || reasoningRequired`；按开关状态二选一执行 enabledActions 或 disabledActions。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:305`
- LEVELS 且开启时，用 `optionFor(optionId)` 取档位，找不到抛 `IllegalArgumentException`，选中档位的 actions 逐个写入。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:309`
- `modelParameters` 先 apply 再把请求 JSON 转为参数列表，供参数 UI 展示。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:317`
- 返回 `Pair<ThinkingQualityMapping, List<ModelParameter<*>>>`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:326`
- `applyAction`：path 为空跳过；不覆盖且路径已存在跳过；否则 `putJsonPath`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:339`

### JSON 路径读写与参数生成

- `putJsonPath` 按点分路径逐段下钻，中间缺段自动建 `JSONObject`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:442`
- 叶子值经 `cloneJsonValue` 深拷贝后写入。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:456`
- `cloneJsonValue` 深拷贝 JSONObject/JSONArray；null 写成 `JSONObject.NULL`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:458`
- `toModelParameters` 把请求 JSON 转为参数列表；Gemini 协议的 `thinkingConfig` 归 GENERATION 类，其余归 OTHER。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:470`
- 值类型映射：对象→OBJECT、布尔→BOOLEAN、整数→INT、小数→FLOAT、字符串→STRING。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:478`
- 选项 id 缺省取 value 字符串，id 为空跳过该选项。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:347`
- 选项的 wireValue：Number 转 `toInt`，String 包 Text，其他为 Omitted。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:358`
- 五种 thinking 参数构造器 id 均为 `thinking-$apiName`，`isEnabled=true`、`isCustom=false`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:498`

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| `ThinkingQualityControl` | LEVELS/TOGGLE_ONLY/UNSUPPORTED 三态 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:12` |
| `ThinkingQualityMapping` | 命中规则转出的可用映射 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:33` |
| `ThinkingQualityMappingRegistry` | 规则解析与匹配（单例） | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:54` |
| `resolve` | 按 provider/model/endpoint 选规则 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:65` |
| `ThinkingConfigurationRule` | 单条 JSON 规则 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:128` |
| `ThinkingModelMatcher` | 8 种模型名匹配条件 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:212` |
| `ThinkingConfigurationApplier` | 把映射写进请求体 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:265` |
| `apply` | 写请求体入口，返回所用映射 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:288` |
| `ThinkingQualityJsonAction` | path/value/overwrite 写动作 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:27` |
| `ThinkingQualityWireValue` | Text/Number/Omitted 线值 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:14` |
| `putJsonPath` | 点分路径写 JSON | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:442` |
| `toModelParameters` | 请求 JSON 转参数列表 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:466` |

## 调用链

1. **输入**：模型配置里的 thinking JSON 配置串 + 本次请求的 providerTypeId、modelName、apiEndpoint、开关与所选档位 id。
2. **处理**：`ThinkingQualityMappingRegistry.resolve` 解析规则取首个全命中者（无命中→unsupported）→ `ThinkingConfigurationApplier.apply` 按 `enableThinking || reasoningRequired` 二选一执行开关动作 → LEVELS 且开启时叠加所选档位的 actions（找不到档位抛错）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:288`
3. **输出**：请求体 JSONObject 被原地写入渠道原生 thinking 字段；`modelParameters` 可把同一份结果转成 `ModelParameter` 列表供 UI 用。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:317`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt`（581 行，已全读）
