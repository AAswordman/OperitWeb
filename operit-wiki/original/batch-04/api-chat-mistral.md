---
title: Mistral 供应商
module: app
sources: 4
date: 2026-10-01
---

# Mistral 供应商

## 概述

- 本页覆盖 `MistralProvider`（95 行）：Mistral AI 模型的专用供应商实现。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:9`
- 一句话：它是 OpenAI 兼容协议的子类，唯一特殊逻辑是**把模型用 XML 写的工具调用翻译成 OpenAI 格式的 tool_calls**——因为 Mistral 系模型习惯输出 `<tool name="..."><param>...</param></tool>` 这样的标记，而不是标准 JSON。
- 「XML 工具调用」指模型在回复正文里用 XML 标签表示的工具调用；「tool_calls」是 OpenAI 协议里结构化的工具调用数组。

## AI 速览

- **核心符号**：`MistralProvider`（Mistral 供应商）、`parseXmlToolCalls`（XML 工具调用解析重写）、`generateMistralToolCallId`（工具调用 id 生成）、`unescapeXml`（XML 反转义）、`ChatMarkupRegex.toolCallPattern` / `toolParamPattern`（匹配正则）。
- **主入口**：`AIServiceFactory` 按 `ApiProviderType.MISTRAL` 分支构造 `MistralProvider`；运行时关键入口是重写的 `parseXmlToolCalls`。
- **数据流向一句话**：模型输出的文本 → `parseXmlToolCalls` 抠出 XML 工具调用块并转成 OpenAI 格式 `tool_calls`（附 9 位哈希 id）→ 剩余纯文本与工具调用数组一起交给标准 OpenAI 流程处理。

## 核心机制

### 装配

- 构造函数 `providerType` 参数默认 `ApiProviderType.MISTRAL`，并转发给父类 `OpenAIProvider`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:18`
- AIServiceFactory 遇到 `ApiProviderType.MISTRAL` 就构造 `MistralProvider`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:578`

### XML 工具调用解析

- 重写 `parseXmlToolCalls`：用 `ChatMarkupRegex.toolCallPattern.findAll(content)` 找出文本中所有 XML 工具调用块。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:37`
- 一个都找不到时直接返回 `Pair(content, null)`：原文不动，工具调用为空。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:41`
- 每个匹配取 `groupValues[2]` 为工具名、`groupValues[3]` 为工具体（参数区原文）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:49`
- 参数用 `toolParamPattern` 在工具体内匹配 `<param name="...">...</param>`，参数值经 `unescapeXml` 反转义后装入 `JSONObject`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:53`
- 每个工具调用的 id 由 `generateMistralToolCallId(toolName, params, callIndex)` 生成。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:59`
- 生成的工具调用 JSON 形如 `id` / `type="function"` / `function{name=工具名, arguments=params.toString()}`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:62`
- 处理完一个匹配，就用 `textContent.replace(match.value, "")` 把该 XML 片段从文本中删掉。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:71`
- 最终返回 `Pair(textContent.trim(), toolCalls)`：去掉工具调用块后的纯文本，加上工具调用数组。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:74`

### 工具调用 id 生成

- `generateMistralToolCallId` 把 `"$toolName:${params.toString()}:$index"` 拼成 raw 字符串后取 `hashCode`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:78`
- `hash == Int.MIN_VALUE` 时取 0，否则取绝对值——防止 `abs(Int.MIN_VALUE)` 溢出仍为负数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:80`
- 绝对值转 36 进制字符串，再过滤成小写字母数字。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:81`
- 结果为空时兜底为 `"0"`，左补 `0` 到 9 位；超过 9 位则取最后 9 位。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:84`

### XML 反转义

- `unescapeXml` 按顺序把 `&lt;`、`&gt;`、`&quot;`、`&apos;` 还原，最后才处理 `&amp;`——`&amp;` 放最后是为了避免把前面还原出的 `&` 又转义回去。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:89`

### 匹配正则与父类钩子

- `ChatMarkupRegex.toolCallPattern` 匹配 `<标签名 name="...">...</标签名>` 结构，忽略大小写且点号可匹配换行。`app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:28`
- `toolParamPattern` 匹配 `<param\s+name="([^"]+)">([\s\S]*?)</param>`，分组 1 是参数名、分组 2 是参数值。`app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:91`
- 父类 `OpenAIProvider.parseXmlToolCalls` 声明为 `open fun`，就是为了让各供应商重写自己的 XML 工具调用解析。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1729`

## 关键符号

| 符号 | 含义 |
| --- | --- |
| `MistralProvider` | Mistral 专用供应商，`OpenAIProvider` 子类，核心差异在 XML 工具调用解析 |
| `parseXmlToolCalls` | 重写：XML 工具调用块 → OpenAI 格式 `tool_calls` + 纯文本 |
| `generateMistralToolCallId` | 私有：工具名+参数+序号 → 9 位 36 进制 id |
| `unescapeXml` | 私有：XML 实体反转义，`&amp;` 最后处理 |
| `ChatMarkupRegex.toolCallPattern` | 匹配 `<tool name="...">...</tool>` 类调用块的正则 |

## 调用链

1. **装配**：`AIServiceFactory` 按 `ApiProviderType.MISTRAL` 分支构造 `MistralProvider`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:578`
2. **解析**：模型输出文本进入 `parseXmlToolCalls` → `toolCallPattern` 找出 XML 工具调用块 → 参数逐个匹配并反转义 → 生成 OpenAI 格式 `tool_calls`（每个带 9 位 id）→ 块从文本中删掉。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:37`
3. **产出**：返回去掉工具调用块的纯文本与工具调用数组，交给标准 OpenAI 流程继续处理。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt:74`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MistralProvider.kt`（95 行，100% 已读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`（装配分支）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt`（父类 `open fun` 钩子）
- `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt`（匹配正则）
