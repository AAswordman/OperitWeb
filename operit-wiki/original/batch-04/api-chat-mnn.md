---
title: MNN 端侧供应商（已停止维护）
module: app
sources: app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt
date: 2026-10-01
---

## 概述

> ⚠️ 状态：已停止维护。本页记录该供应商在 Operit v1.12.2 的最后实现，仅供查阅存档，不建议在新配置中使用。

`MNNProvider` 是 Operit 的端侧（on-device，大模型跑在手机本地、不走网络）供应商实现，直接用 MNN 官方 LLM 引擎在设备上做推理。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:35`

它实现 `AIService` 接口。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:45`

为什么有它：云端供应商需要联网、要配 API Key；MNN 供应商让手机在离线状态下也能跑对话，代价是用户自己下载模型、手机性能决定推理速度。

它实现 `AIService` 接口，所以上层调用它和调用云端供应商的方式一致：发消息拿流式输出、测连通、释放资源。

## AI 速览

- `MNNProvider` — MNN 端侧推理的 `AIService` 实现，单文件 1021 行
- `getModelDir` — 模型目录定位：公共下载目录 Download/Operit/models/mnn/模型名
- `initModel` — 懒初始化：校验目录与配置 → 选硬件后端 → 建 `MNNLlmSession`
- `sendMessage` — 主入口：多模态预处理 → 历史裁剪 → `generateStream` 流式推理
- `preprocessMultimodalText` — 图片/音频/视频转成本地临时文件，再拼成 MNN 认识的标签
- `trimHistoryToTokenBudget` — 超预算时二分裁掉旧历史，首条 system 保留
- `applyModelParameters` — 采样参数映射（top_p→topP 等）经 `setConfig` 生效
- `testConnection` — 连通性检查：目录、四关键文件、实际初始化模型
- `getModelsList` — 从固定目录扫描已下载的本地模型
- `release` — 释放 native 推理资源
- 主入口函数：`sendMessage`
- 数据流向一句话：用户消息 → 多模态预处理成本地文件标签 → 历史按 token 预算裁剪 → `MNNLlmSession.generateStream` 逐 token 回调 → 直接 emit 或转 XML 后 emit。

## 核心机制

### 模型放在哪，怎么初始化

`getModelDir` 把模型目录固定为公共下载目录下的 Download/Operit/models/mnn/模型名。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:55`

`initModel` 只在第一次真正需要时初始化（懒加载），跑在 IO 线程：先检查模型目录存在，再检查目录里有没有 llm_config.json，缺一个就直接返回错误。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:132`

硬件后端由构造参数 `forwardType` 决定：0 走 cpu，3 走 opencl，4 走 auto，6 走 opengl，7 走 vulkan；传了不认识的值就记一条警告然后用 cpu。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:158`

内存模式跟着后端走：vulkan/opencl/opengl 用普通内存模式（注释写了是为避开 Clone error），cpu 用省内存的低内存模式。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:175`

推理时的 KV 缓存等临时文件放在应用缓存目录下的 `cacheDir`/mnn_cache，目录不存在就建。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:183`

`MNNLlmSession.create` 以低精度创建会话，用速度换精度。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:194`

### Token 怎么算

优先用 session 自带的 `countTokens` 按真实分词算；session 还没建好或算失败了，就按 4 个字符约 1 token 估一个保底数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:219`

模型最大 token 数从 llm_config.json 的 max_all_tokens 读，读不到或文件缺失就按 2048。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:236`

模型能力（是否支持视觉/音频）从 llm_config.json 读，读完缓存在 `cachedModelIsVisual`/`cachedModelIsAudio` 字段里。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:270`

### 多模态：先转成本地文件

MNN 只认识文本和本地文件路径，所以图片、音频、视频要先预处理。`preprocessMultimodalText` 按模型能力和构造开关决定哪些 modality 放行，不支持的直接删掉。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:350`

图片从图片池取 base64 写成临时文件，经 `MediaLinkParser` 替换成 img 标签加路径。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:388`

音频先经 `transcodeToWav16kMono` 用 `FFmpegUtil` 转成 16k 单声道 wav，再包成 audio 标签；转码失败就用原路径。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:322`

视频则抽一帧（缩到 640 宽）加转音频，两段拼在一起。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:418`

base64 写临时文件由 `writeBase64ToTempFile` 负责，失败时删掉半成品并返回空。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:306`

请求结束在 `finally` 里删掉本次产生的所有多模态临时文件。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:745`

### 历史裁剪：超预算就二分砍旧消息

`trimHistoryToTokenBudget` 先算整段历史的 token 数，不超就原样返回；超了就用二分查找砍掉前面的旧轮次，首条 system 消息永远保留。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:435`

max_tokens 参数缺省 512、上限 8192。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:659`

留给 prompt 的预算 = 模型最大 token 数 − 新生成 token 数，最少 128。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:660`

### 工具调用走内部通道

`shouldUseInternalToolCall` 要求 `enableToolCall` 为 true 且确实有可用工具。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:526`

走内部工具调用时，历史经 `StructuredToolCallBridge.buildMnnChatHistory` 构建，否则用普通压平。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:650`

`applyRequestJinjaContext` 负责把 jinja 上下文写入 session。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:530`

上下文里含 thinking 开关和 tools 数组，经 `setConfig` 写入，失败抛异常。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:555`

推理输出先缓冲，结束后再经 `StructuredToolCallBridge.convertToolCallPayloadToXml` 转成 XML 格式 emit 给上层。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:721`

### 采样参数映射

`applyModelParameters` 只处理启用的参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:816`

映射规则：`temperature` 直传，`top_p`→`topP`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:825`

`top_k`→`topK`，`min_p`→`minP`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:835`

三种 penalty（presence/frequency/repetition）统一成 MNN 的 `penalty`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:843`

max_tokens 从参数中单独提取为 `requestedMaxNewTokens`（缺省 -1）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:655`

该值作为生成上限传入 `session.generateStream`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:686`

同时写入 `configMap['max_new_tokens']`，进入参数配置表。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:848`

高级采样参数 `tfsZ`、`typical` 直接透传。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:856`

高级采样参数 `n_gram`、`ngram_factor` 直接透传。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:866`

参数集非空则拼成 JSON 调 `setConfig`，失败只记警告不抛异常。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:941`

### 连通性检查与模型列表

`testConnection` 做连通性检查，跑在 IO 线程。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:752`

它汇总模型目录文件大小，并逐个检查 llm.mnn、llm.mnn.weight、llm_config.json、tokenizer.txt 四个关键文件是否存在。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:774`

检查最后会实际调 `initModel` 初始化一遍模型。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:787`

`getModelsList` 不走网络，直接调 `ModelListFetcher.getMnnLocalModels` 扫描固定目录里已下载的模型。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:1002`

`release` 释放 `llmSession` 的 native 内存并置空。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:1011`

`cancelStreaming` 置取消标志，并调 `llmSession?.cancel()` 立即中断底层推理。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:97`

## 关键符号

| 符号 | 职责 |
|---|---|
| `MNNProvider` | MNN 端侧推理的 `AIService` 实现 |
| `getModelDir` | 拼出模型目录路径（下载目录/Operit/models/mnn/模型名） |
| `initModel` | 懒初始化：校验 → 选后端 → 创建 `MNNLlmSession` |
| `MNNLlmSession` | MNN 官方 LLM 会话（native 推理入口，外部模块） |
| `sendMessage` | 发消息主入口，返回流式字符串流 |
| `generateStream` | session 的流式推理方法，逐 token 回调 |
| `preprocessMultimodalText` | 多模态内容转本地文件标签 |
| `trimHistoryToTokenBudget` | token 预算内二分裁剪历史 |
| `flattenTypedHistory` | PromptTurn 转 role/content 二元组 |
| `applyRequestJinjaContext` | 经 setConfig 写入 jinja 上下文 |
| `applyModelParameters` | 采样参数映射并 setConfig 生效 |
| `testConnection` | 连通性检查 |
| `getModelsList` | 扫描本地已下载模型 |
| `cancelStreaming` | 置取消标志并中断底层推理 |
| `release` | 释放 native 资源 |

## 调用链

1. **输入**：上层调 `sendMessage`，传入 PromptTurn 历史、模型参数、工具列表等。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:599`
2. **处理**：`initModel` 懒初始化模型。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:620`
3. **处理**：`applyModelParameters` 应用采样参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:816`
4. **处理**：每轮消息经多模态预处理转成本地文件标签，历史压平后超预算则 `trimHistoryToTokenBudget` 二分裁剪。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:435`
5. **处理**：`applyRequestJinjaContext` 写入 jinja 上下文。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:530`
6. **输出**：`session.generateStream` 逐 token 回调，非工具调用模式直接 emit，工具调用模式缓冲后转 XML 再 emit。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:687`
7. **输出**：`LocalGenerationEnd.end` 统一收尾（用量上报/取消/失败抛错），finally 删掉本次的多模态临时文件。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:711`

## 来源

- 类定义：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:35`
- 模型目录：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:55`
- 初始化：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:132`
- 后端映射：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:158`
- Token 计数：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:219`
- 多模态预处理：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:350`
- 历史裁剪：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:435`
- 主入口：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:599`
- 流式推理：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:687`
- 连通性检查：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:752`
- 参数映射：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:816`
- 模型列表：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:1002`
- 资源释放：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MNNProvider.kt:1011`
