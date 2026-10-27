---
title: 语音合成（TTS）服务
module: app
sources: [15]
date: 2026-10-01
---

# 语音合成（TTS）服务

## 概述

TTS（Text-to-Speech，文字转语音）是把文本变成可播放音频的服务。Operit 的语音朗读全部走这层：聊天回复、通知播报、长文朗读都调用同一个入口。

这层提供 9 种语音引擎：Android 系统自带 TTS、通用 HTTP TTS、豆包、MiniMax、MiMo、硅基流动、OpenAI HTTP、OpenAI Realtime WebSocket，以及本地运行的 VITS（基于 ONNX Runtime 的离线语音合成）。上层业务只认 `VoiceService` 接口，不感知具体引擎。

## AI 速览

**核心符号清单**

- 接口：`VoiceService`（统一契约）、`Voice`（音色数据类）
- 工厂：`VoiceServiceFactory`、`VoiceServiceType`（9 个枚举值）
- 通用 HTTP 基类：`HttpVoiceProvider`、`HttpTtsResponsePipelineStep`（6 种管线步骤）、`TtsException`
- 各引擎 Provider：`DoubaoVoiceProvider`、`MiniMaxVoiceProvider`、`MimoVoiceProvider`、`SiliconFlowVoiceProvider`、`OpenAIVoiceProvider`、`OpenAIRealtimeVoiceProvider`、`VitsVoiceProvider`、`SimpleVoiceProvider`（文件名 `AccessibilityVoiceProvider.kt`）
- 播放与工具：`QueuedTtsPlayback`（双队列播放器）、`VoiceListFetcher`（远端音色列表拉取）

**主入口**：`VoiceServiceFactory.getInstance(context)` 按当前 TTS profile 返回单例 `VoiceService`；`createVoiceService` 按 `VoiceServiceType` 分发构造。

**数据流向一句话**：文本 → 工厂按配置选 Provider → Provider 把文本变成音频字节（网络请求或本地推理） → 音频落盘为临时文件 → `QueuedTtsPlayback`/`MediaPlayer` 串行播放。

## 核心机制

### 1. 统一接口与工厂选型

`VoiceService` 定义所有引擎的契约：`initialize()` 初始化、`speak(text, interrupt, rate, pitch, extraParams)` 朗读、`stop/pause/resume` 播放控制、`shutdown` 释放资源、`getAvailableVoices/setVoice` 音色管理，以及 `isInitialized`、`isSpeaking`、`speakingStateFlow` 三个状态暴露点。`speak` 的 `interrupt` 默认 `true`，表示新请求打断正在播放的内容。

`VoiceServiceFactory` 是 object 单例。`createVoiceService` 用 `runBlocking` 同步读取当前 TTS profile，再用 when 映射 9 种 `VoiceServiceType` 到具体 Provider：SIMPLE_TTS→系统 TTS，HTTP_TTS→通用 HTTP，DOUBAO_TTS/MINIMAX_TTS/MIMO_TTS→各自 Provider，SILICONFLOW_TTS、OPENAI_TTS、OPENAI_WS_TTS（Realtime）、VITS_TTS 各有专属实现。`getInstance` 缓存单例，profile id 变化时 shutdown 旧实例重建。

### 2. 通用 HTTP TTS 与响应管线

`HttpVoiceProvider` 是 open 基类，把"调任意 HTTP TTS 接口"抽象成配置驱动：`TtsHttpConfig` 里有 URL 模板、HTTP 方法、请求体模板、请求头、API Key、响应管线等。豆包、MiniMax、MiMo 都复用它（继承或内部委托）。

初始化时做四项校验：URL 模板非空；模板必须含 `{text}` 占位符（POST 看请求体模板，GET 看 URL）；URL 以 `http://`/`https://` 开头；响应管线每一步类型合法。`setConfiguration` 更新配置后强制 `_isInitialized=false`，下次 `speak` 重新初始化。

响应管线（`HttpTtsResponsePipelineStep` 列表）解决"各家接口返回格式不同"的问题，共 6 种步骤：`parse_json`（解析 JSON）、`pick`（按路径提取子节点，如 `data.audio`、`choices[0].message.audio.data`）、`parse_json_string`（把字符串再解析成 JSON）、`http_get`（把字符串当 URL 二次拉取）、`http_request_from_object`（按对象描述发 GET/POST）、`base64_decode`（Base64 解码成音频字节）。管线为空时直接用原始响应字节；最终结果不是二进制就抛错。

请求流程：`speak` 先把请求交给 `QueuedTtsPlayback`；工作协程先查 `audioCache`（内存映射，键由文本哈希+语速+音调+音色+参数拼接），命中且文件存在直接复用；未命中则发 HTTP 请求，POST 把 `{text}/{rate}/{pitch}/{apiKey}/{model}/{locale}/{uuid}/{voice}` 等占位符填进请求体模板，GET 填进 URL，`extraParams` 的每个键也都可作占位符。apiKey 非空且请求头没配 Authorization 时自动加 `Bearer` 头；请求日志经 `HttpLogSanitizer` 脱敏。音频先落盘为 cacheDir 下 `tts_<uuid>.bin` 再播放。

### 3. 各云端 Provider 的差异

- **豆包**（`DoubaoVoiceProvider`）：endpoint 固定 `https://openspeech.bytedance.com/api/v1/tts`，cluster 默认 `volcano_tts`，默认音色 `BV700_V2_streaming`，内置列表只有这一个音色。管线为 parse_json→pick(`data`)→base64_decode。请求体按豆包 v1 格式组织 app/user/audio/request 四段；`initialize`/`speak` 每次重建配置，`extraParams` 的 `voice`/`cluster` 可覆盖默认。
- **MiniMax**（`MiniMaxVoiceProvider`）：endpoint `https://api.minimaxi.com/v1/t2a_v2`，模型默认 `speech-2.8-hd`，默认音色 `male-qn-qingse`。接口返回的是音频 URL 而非字节，管线为 parse_json→pick(`data.audio`)→http_get 二次拉取。apiKey 为空时直接抛 `TtsException`。
- **MiMo**（`MimoVoiceProvider`）：endpoint `https://api.xiaomimimo.com/v1/chat/completions`，模型 `mimo-v2.5-tts`，内置 9 个音色。请求是 OpenAI chat completions 格式（含 audio.format=wav），apiKey 走 `api-key` 请求头。管线从 `choices[0].message.audio.data` 提取后 base64 解码。
- **硅基流动**（`SiliconFlowVoiceProvider`）：不走基类，自己用 `HttpURLConnection` 实现。地址固定 `https://api.siliconflow.cn/v1/audio/speech`，输出 mp3/32000Hz。内置 8 个中文音色（alex/benjamin/charles/david/anna/bella/claire/diana），默认 charles。voice 传值规则：`speech:` 开头的是用户自定义音色直接用，否则拼成 `model:voice`。输入先用正则剥掉 HTML 标签，空文本跳过。
- **OpenAI HTTP**（`OpenAIVoiceProvider`）：直调 `/audio/speech`，6 个内置音色（alloy/echo/fable/onyx/nova/shimmer）。初始化校验 endpoint 含 `/audio/speech`；语速钳制 0.25~4.0；音频按响应头扩展名落盘（白名单 mp3/opus/aac/flac/wav/pcm），文件名为 `openai_tts_<uuid>.<ext>`；播放完自动删文件。
- **OpenAI Realtime**（`OpenAIRealtimeVoiceProvider`）：走 WebSocket 长连接（读超时 0，ping 20 秒）。建连后先发 `conversation.item.create` 再发 `response.create`；音频以 base64 delta 事件流式到达，拼进字节缓冲，结束后手写 44 字节 WAV 头封装成 wav 文件播放。输出固定 PCM/24000Hz/单声道，语速钳制 0.25~1.5。

### 4. 本地引擎：系统 TTS 与 VITS

`SimpleVoiceProvider`（文件名为 `AccessibilityVoiceProvider.kt`，类名与文件名不一致）封装 Android 系统 `TextToSpeech`。用 `ArrayDeque` 维护待朗读队列，`UtteranceProgressListener` 跟踪每段的开始/结束/错误，并用 `onRangeStart` 记录当前段已读到的字符偏移——这是 pause/resume 能断点续播的基础：暂停时截取"当前段剩余部分+后续队列"，恢复时第一段 FLUSH（清空后播）其余 ADD（追加）。

`VitsVoiceProvider` 是纯本地离线 TTS，基于 ONNX Runtime 跑 VITS/Piper 模型。模型以"包"形式提供：目录或 zip，zip 解压时做 canonical 路径校验防 ZipSlip（压缩包路径穿越攻击），解压缓存目录名取"路径|长度|修改时间" sha256 的前 16 位。初始化四步：定位包文件（manifest > 显式路径 > 自动推断，0 个或多个候选都抛错）→ 解析 sample_rate 等运行时配置 → 按输入名候选（`input`/`input_ids`/`ids`/`text`/`x` 等）绑定模型输入 → 创建 session。文本先分词转 token id（支持词典最长匹配与符号表两种 frontend），推理输出 float 数组转 16 位 PCM（钳制 ±1），用 `AudioTrack` 流式播放。

### 5. 排队播放与打断

`QueuedTtsPlayback` 是 internal 双队列播放器：`speakQueue`（无界 Channel）收请求，`playbackQueue`（容量 1）保证一次只播一段。`stopGeneration`（AtomicLong）是打断的代际计数器——`interrupt=true` 的新请求会清空两队列并让旧 generation 的请求全部作废。每个请求带 `CompletableDeferred`，调用方 await 等播放结束，异常时抛给调用方。`shutdown` 释放 MediaPlayer、取消协程域、关闭 Channel。

### 6. 远端音色列表

`VoiceListFetcher` 是 object 工具：按 endpoint 拼出 3 个候选路径（`/v1/audio/voices`、`/v1/voices`、`/voices`，先用正则截掉版本号），逐个带 Bearer 头 GET，第一个返回非空列表的胜出；解析兼容 `data` 或 `voices` 数组；按 id 去重，冲突时保留字段更全的一条。

## 关键符号

| 符号 | 角色 |
|---|---|
| `VoiceService` | 所有语音引擎的统一接口 |
| `VoiceServiceFactory.getInstance` | 按当前 profile 返回单例的主入口 |
| `VoiceServiceType` | 9 种引擎类型的枚举 |
| `HttpVoiceProvider` | 通用 HTTP TTS 基类（配置驱动） |
| `HttpTtsResponsePipelineStep` | 6 种响应管线步骤的定义 |
| `TtsException` | TTS 自定义异常，携带 HTTP 状态码与错误体 |
| `QueuedTtsPlayback` | 双队列串行播放器，管排队与打断 |
| `DoubaoVoiceProvider` / `MiniMaxVoiceProvider` / `MimoVoiceProvider` | 复用基类的三家云端 Provider |
| `SiliconFlowVoiceProvider` | 硅基流动独立实现（HttpURLConnection） |
| `OpenAIVoiceProvider` | OpenAI `/audio/speech` 直调 |
| `OpenAIRealtimeVoiceProvider` | OpenAI Realtime WebSocket 流式 |
| `SimpleVoiceProvider` | Android 系统 TTS 封装（文件 `AccessibilityVoiceProvider.kt`） |
| `VitsVoiceProvider` | 本地 ONNX VITS 离线合成 |
| `VoiceListFetcher` | 远端音色列表拉取与去重 |

## 调用链

以"用户点朗读，豆包引擎出声"为例：

**输入**

1. 业务层调用 `VoiceServiceFactory.getInstance(context)`，工厂读取当前 TTS profile，发现类型是 `DOUBAO_TTS`，构造 `DoubaoVoiceProvider` 并缓存单例。
2. 业务层调用 `provider.speak("你好", interrupt=true)`，请求进入 `QueuedTtsPlayback.speakQueue`，旧 generation 的请求被作废。

**处理**

3. 工作协程从队列取请求，先查 `audioCache`，未命中则调 `fetchAudioFromServer`：把 `{text}` 等占位符填进豆包请求体模板，POST 到 `https://openspeech.bytedance.com/api/v1/tts`。
4. 响应走管线 parse_json→pick(`data`)→base64_decode，得到音频字节，落盘为 `tts_<uuid>.bin`，记入缓存。

**输出**

5. `playbackQueue` 取出音频文件，`MediaPlayer` 播放（CONTENT_TYPE_SPEECH），播完在 finally 里释放播放器；调用方的 `CompletableDeferred` 完成，`speak` 返回。

## 来源

- 仓库：Operit，commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（v1.12.2）
- 源码目录：`app/src/main/java/com/ai/assistance/operit/api/voice/`（15 个文件）
  - `VoiceService.kt`、`VoiceServiceFactory.kt`、`TtsException.kt`
  - `HttpVoiceProvider.kt`、`HttpTtsResponsePipelineStep.kt`
  - `DoubaoVoiceProvider.kt`、`MiniMaxVoiceProvider.kt`、`MimoVoiceProvider.kt`
  - `OpenAIVoiceProvider.kt`、`OpenAIRealtimeVoiceProvider.kt`、`SiliconFlowVoiceProvider.kt`
  - `AccessibilityVoiceProvider.kt`（类 `SimpleVoiceProvider`）、`VitsVoiceProvider.kt`
  - `QueuedTtsPlayback.kt`、`VoiceListFetcher.kt`
- 原子事实：`api-voice.facts.json`（194 条）；代码走查：`api-voice.quality.json`（7 条）
