---
title: 语音识别流水线
module: 语音
sources: 111
date: 2026-10-01
---

# 语音识别流水线

## 概述

- 语音识别实现收拢在 `app/src/main/java/com/ai/assistance/operit/api/speech/`（11 个文件），统一接口是 `SpeechService`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:8`
- `SpeechServiceType` 只有三种：`SHERPA_NCNN`、`OPENAI_STT`、`DEEPGRAM_STT`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:17`
- `SpeechServiceFactory` 是 object 单例，按当前 STT profile 创建实例。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:12`
- 本地引擎是 sherpa 流式识别（ncnn 版在用，mnn 版目前不可达），云端引擎是 OpenAI / Deepgram 的整段 wav 转写。
- 唤醒链路独立：常驻录音的唤醒监听命中个人唤醒词后，经 `SpeechPrerollStore` 把唤醒词音频无缝交给 STT。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:99`

## AI 速览

- **核心符号**：`SpeechService`（统一接口）、`SpeechServiceFactory`（创建/单例）、`SpeechPrerollStore`（预卷环形缓冲）、`PersonalWakeListener`（个人唤醒）、`OnnxSileroVad`（VAD）、`SherpaSpeechProvider`（本地 ncnn）、`OpenAISttProvider` / `DeepgramSttProvider`（云端）。
- **主入口**：`SpeechServiceFactory.getInstance(context)` / `createWakeSpeechService(context)`；识别入口 `startRecognition(languageCode, continuousMode, partialResults, audioSource)`。
- **数据流向一句话**：麦克风 PCM →（唤醒时经预卷环形缓冲）→ 本地 zipformer 流式识别或云端 wav 转写 → `recognitionResultFlow` 发出 `RecognitionResult`。
- **一句话行为差异**：本地引擎流式实时出结果；云端引擎录成 wav 后整段转写；唤醒链路强制用本地引擎，唤醒词音频不丢失。

## 核心机制

### 接口与状态机

- 统一接口定义 `RecognitionState` 六态：`UNINITIALIZED`、`IDLE`、`PREPARING`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:14`
- 另三个运行态 `RECOGNIZING`、`PROCESSING`、`ERROR`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:20`
- 结果 `RecognitionResult` 含 `text`、`isFinal`（默认 false）、`confidence`（默认 0f）。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:32`
- 错误 `RecognitionError` 含 `code`、`message`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:38`
- 状态、结果、错误分别经 `recognitionStateFlow`、`recognitionResultFlow`、`recognitionErrorFlow` 发布。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:53`
- `isInitialized` 以 `StateFlow` 发布引擎是否就绪。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:41`
- `volumeLevelFlow` 发布 0.0–1.0 的麦克风音量。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:59`
- `startRecognition` 默认语言 zh-CN、非连续模式、返回部分结果、录音源 `VOICE_COMMUNICATION`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:78`
- `recognize(audioData)` 识别预录浮点 PCM。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:110`

### 工厂与单例

- `createSpeechService(context)` 经 `runBlocking` 读当前 STT profile 后创建。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:32`
- 唤醒专用 `createWakeSpeechService` 把 `OPENAI_STT`、`DEEPGRAM_STT` 强制映射为 `SHERPA_NCNN`（唤醒只用本地）。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:42`
- `acquireLocalSpeechService` 加锁，已有不同类型本地服务在用时抛 `IllegalStateException`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:117`
- `refCount` 归零才真正释放本地服务。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:155`
- `SpeechServiceLease` 用 `AtomicBoolean` 保证释放只触发一次。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:95`
- 创建失败（`IllegalStateException`）时保留旧实例并打日志。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:199`
- `resetInstance` 清空单例与 profile 记录。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:222`

### 预卷音频环形缓冲

- `SpeechPrerollStore` 是 object 单例：16kHz、2500ms，`capacitySamples` 为 40000 采样的 `ring`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:14`
- `appendPcm` 用 `writePos` 循环覆盖写入。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:37`
- `filled` 计数按 `minOf` 封顶不溢出。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:42`
- `capturePending` 默认截取 `windowMs` 1600ms 的尾部快照。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:48`
- `consumePending` 未 armPending 直接返回 null，超 `maxAgeMs` 丢弃快照。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:84`
- `armPending` 只在已有快照时把 `pendingArmed` 置 true。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:99`
- `setPendingWakePhrase` 暂存唤醒词文本与 `regexEnabled` 开关。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:105`
- `consumePendingWakePhrase` 取出并清空，超 10 秒丢弃。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:114`

### 个人唤醒词

- 注册 `recordOneTemplate`：最长录 6000ms、最短语音 250ms、尾部静音 350ms 结束。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt:16`
- 注册录音用 `AudioRecord` 配 `MIC` 音源，16kHz 单声道 16bit。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt:27`
- 注册时 VAD 用 `Mode.NORMAL`，`speechDurationMs` 60ms、`silenceDurationMs` 300ms。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt:41`
- `seenSpeech` 为 false 或 `speechMs` 不足时直接返回 null。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt:81`
- 注册最终产出 `extractFeatures` 的特征向量。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt:88`
- 特征 `Config` 默认：`frameSize` 400、`hopSize` 160、`fftSize` 512。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:16`
- `melBins` 40、`numMfcc` 13、`maxFrames` 64、频带 `fMin` 20 到 `fMax` 4000。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:20`
- 流水线：`preEmphasis`（0.97）→ `applyHann` → `fftMagSquared` → mel 对数能量。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:44`
- 帧数超限经 `limitFrames` 做均值池化。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:62`
- `computeMfcc` 取 13 维 MFCC，一阶 `computeDelta` 与二阶差分拼成 39 维。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:64`
- 拼接后做 `cmvnInPlace` 倒谱均值方差归一化。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:80`
- 唤醒阈值 `similarityThreshold` 0.865，动态阈值下限 `minDynamicThresholdFloor` 0.84。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:32`
- `dtwBand` 为 4，时长比 `minDurationRatio` 0.75 到 `maxDurationRatio` 1.25，`minRms` 0.003。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:37`
- 常驻录音每帧调 `SpeechPrerollStore.appendPcm` 续写环形缓冲。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:99`
- 静音时段用 EMA 更新 `noiseRmsEma` 估计环境噪声。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:106`
- 语音段超过 `maxSegmentMs` 强制 `flushSegmentIfNeeded` 并重置分段。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:123`
- 尾部静音超过 `endSilenceMs` 触发 `flushSegmentIfNeeded`。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:133`
- 先过 `rmsGate`（`minRms` 与噪声加余量取大）过滤弱音。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:186`
- 模板维度非法直接丢弃并提示重新注册。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:211`
- 注册模板两两比对，`intraMin` 低于 `minIntraSimilarity` 打 warn 日志。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:236`
- 动态阈值 `dynThreshold` 取 `minDynamicThresholdFloor` 下限、`similarityThreshold`、`intraMin` 减 `dynamicThresholdMargin` 三者钳制。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:250`
- 每模板算 `dtwSimilarity`，相似度达标计一次 `hits`。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:264`
- 命中数达标且 `gapOk` 时调 `onTriggered` 回调最佳相似度。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:284`
- `dtwSimilarity` 是带宽约束 DTW，帧代价为余弦距离。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:344`
- `stop` 把 `running` 置 false 结束循环。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:161`

### Silero VAD（ONNX）

- `Mode` 有 `OFF`、`NORMAL`、`AGGRESSIVE`、`VERY_AGGRESSIVE` 四档。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:31`
- 默认模型路径 `modelAssetPath` 为 models/silero_vad.onnx。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:22`
- 模型从 assets 拷到 cache 建 ORT 会话，`setIntraOpNumThreads` 与 `setInterOpNumThreads` 均为 1。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:69`
- 音频输入名在 input、audio、x 中自动探测。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:79`
- 按需探测 `sr`、`state`、`h`、`c` 辅助输入。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:90`
- 16kHz 配 512 帧时 `inputWindowSize` 取模型形状，另有 64 采样上下文重叠。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:112`
- 判决阈值：`Mode.NORMAL` 0.5、`Mode.AGGRESSIVE` 0.8、`Mode.VERY_AGGRESSIVE` 0.95。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:315`
- `isSpeech` 用 `require` 要求帧长精确等于 `frameSize`。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:171`
- 连续语音帧超 `maxSpeechFramesCount` 才判有话（迟滞逻辑）。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:197`
- `reset` 清空 h、c、`state` 与计数器。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:152`

### 本地引擎 sherpa-ncnn

- 模型为 sherpa-ncnn-streaming-zipformer-bilingual-zh-en-2023-02-13，中英双语。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:132`
- 解码 `greedy_search`、`numActivePaths` 4，`numThreads` 4，`useGPU` false。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:172`
- `enableEndpoint` 为 true，端点规则 `rule1MinTrailingSilence` 2.4s、`rule2MinTrailingSilence` 1.2s、`rule3MinUtteranceLength` 20.0s。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:180`
- `initialize` 用 `initializeMutex` 防并发初始化。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:100`
- `startRecognition` 用 `recognitionMutex` 防并发启动。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:228`
- 启动时先 `consumePending` 取预卷音频注入 `acceptSamples`。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:252`
- 音量按 `log10` dB 公式映射归一。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:213`
- `VOLUME_SMOOTHING_FACTOR` 为 0.1 做音量平滑。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:92`
- 非 VAD 路径靠 `isEndpoint` 判端点出最终结果。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:355`
- VAD 路径按 `vadFrameSize` 512 帧切分。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:328`
- 每帧调 `vadInstance.isSpeech` 门控语音。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:386`
- 语音结束调 `inputFinished()` 后取 `finalText` 吐最终结果。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:406`
- `reset(false)` 重置识别器，`vadInstance.reset()` 重置 VAD。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:415`
- 停止时先置 `PROCESSING` 状态。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:458`
- 停止时调 `inputFinished()` 取最终文本。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:469`
- 停止完成后回 `IDLE` 并清零音量。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:476`
- `recognize` 不支持批处理，报 -10 错误。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:546`
- 支持语言为 zh、en。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:534`

### 本地引擎 sherpa-mnn

- 模型为 sherpa-mnn-streaming-zipformer-bilingual-zh-en-2023-02-20，int8 mnn，`numThreads` 2。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:133`
- 端点规则 `rule1` 2.4s、`rule2` 1.2s、`rule3` 20s。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:145`
- 工厂把 `SHERPA_NCNN` 映射到 `SherpaSpeechProvider`。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:134`
- 全 app/src 范围检索，SherpaMnnSpeechProvider 只出现在自身文件、无实例化点，目前是不可达代码（走查 Q6）。
- 自带 VAD 已禁用，`createVad` 直接置 `vad` 为 null 并留 TODO。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:166`
- initialize 时 VAD 创建失败不影响整体初始化。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:82`
- 每次 startRecognition 释放旧 `stream` 并 `createStream` 建新流。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:306`
- 预卷经 `acceptWaveform` 按 16000 采样率注入。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:314`
- 无 VAD 时降级直送识别器。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:455`
- 停止时等录音协程结束后在 IO 线程调 `inputFinished()` 取最终结果。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:525`
- cancelRecognition 不释放 `stream`，注释称防 recordingJob 并发使用。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:602`

### 云端引擎（OpenAI / Deepgram）

- 构造参数 `endpointUrl`、`apiKey`、`model`。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:37`
- 超时 `DEFAULT_TIMEOUT_SECONDS` 60 秒，录音上限 `MAX_FILE_BYTES` 25MB。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:46`
- initialize 要求 URL 含 /audio/transcriptions 且 scheme 为 http 或 https。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:109`
- 录音写 cache 下 openai_stt 随机 wav，先占 `WAV_HEADER_SIZE` 44 字节头。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:166`
- VAD 门控写入，`preRollSamples` 为 0.5 秒预卷缓冲。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:209`
- 说话后出现静音自动触发 `stopRecognition`。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:289`
- 录音超 25MB 抛 `IOException` 中断。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:296`
- `transcribeWavFile` 用 multipart 发 `file`、`model`、`language` 三个字段。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:564`
- 加 `response_format` json 与 `Bearer` 认证头。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:570`
- 解析返回 JSON 的 `text` 字段。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:590`
- `mapLanguage` 把 zh 开头映为 zh、en 开头映为 en。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:550`
- recognize 把浮点音频转 16bit PCM 写 wav 后转写。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:408`
- Deepgram 校验 `endpointUrl` 非空且 scheme 为 http 或 https。`app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt:105`
- 校验 `apiKey`、`model` 非空，不要求 transcription 路径。`app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt:110`
- `transcribeWavFile` 用 query 参数 model、`smart_format`、`punctuate`、language。`app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt:547`
- 请求用 `Token` 认证头。`app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt:558`
- 解析 results.channels[0].alternatives[0] 的 `transcript` 字段。`app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt:580`

## 关键符号

- `SpeechService`：统一接口，六态状态机 + 五路 StateFlow。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt:8`
- `SpeechServiceFactory`：object 工厂，profile 驱动创建、唤醒强制本地、引用计数单例。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt:12`
- `SpeechPrerollStore`：16kHz/2500ms 环形缓冲，唤醒交接的音频快照中转。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:10`
- `PersonalWakeEnrollment`：录制唤醒词模板（VAD 切段 + MFCC 特征）。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt:11`
- `PersonalWakeFeatureExtractor`：13 维 MFCC + 一阶/二阶差分 = 39 维，CMVN。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt:10`
- `PersonalWakeListener`：常驻监听，动态阈值 + 带限 DTW 判定唤醒。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:15`
- `OnnxSileroVad`：ONNX Silero VAD，四档灵敏度，迟滞判决。`app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt:15`
- `SherpaSpeechProvider`：sherpa-ncnn 本地流式引擎（在用）。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:36`
- `SherpaMnnSpeechProvider`：sherpa-mnn 本地引擎（目前不可达）。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt:32`
- `OpenAISttProvider`：OpenAI 兼容 STT，wav 整段转写。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:37`
- `DeepgramSttProvider`：Deepgram STT，query 参数 + Token 认证。`app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt:36`

## 调用链

1. **唤醒**：PersonalWakeListener.runLoop 常驻录音，每帧写入 `SpeechPrerollStore.appendPcm` 环形缓冲；语音段经 RMS 门限、MFCC 特征、带限 DTW 与动态阈值判定命中后回调。`app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt:99`
2. **交接**：命中后 `capturePending` 截 1600ms 尾部快照。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:48`
3. **武装**：快照需 armPending 武装后 `consumePending` 才能取走；唤醒词文本经 setPendingWakePhrase 暂存。`app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt:84`
4. **识别（本地）**：唤醒链路强制用 sherpa-ncnn，startRecognition 先 `consumePending` 把唤醒词音频注入 `acceptSamples` 再流式识别。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:252`
5. **识别（云端）**：录 wav（VAD 门控 + 0.5s `preRollSamples` 预卷），说话后静音自动停再整段转写。`app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt:209`
6. **结束**：置 PROCESSING → 调 inputFinished 取最终文本 → 回 IDLE。`app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt:469`

## 来源

- 源码版本：Operit @ `dbf71916`（v1.12.2）
- seed 目录：`app/src/main/java/com/ai/assistance/operit/api/speech/`（11 个文件，4147 行，已 100% 阅读）
- 原子事实：`review/batch-04/api-speech.facts.json`（111 条）
- 代码走查：`review/batch-04/api-speech.quality.json`（6 条）
- `app/src/main/java/com/ai/assistance/operit/api/speech/SpeechService.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/SpeechServiceFactory.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/SpeechPrerollStore.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeEnrollment.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeFeatureExtractor.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/PersonalWakeListener.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/OnnxSileroVad.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/SherpaSpeechProvider.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/SherpaMnnSpeechProvider.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/OpenAISttProvider.kt`
- `app/src/main/java/com/ai/assistance/operit/api/speech/DeepgramSttProvider.kt`
