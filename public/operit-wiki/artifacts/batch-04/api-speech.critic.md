# Critic 复检报告：`api-speech`（语音识别流水线，Issue #58）

- 复检时间：2026-10-01 14:10 CST
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse` 实测一致）
- 交付物：`api-speech.md` / `.facts.json`（111 条）/ `.quality.json`（6 条）/ `.lint.md` / `.status.json`
- 复检方法：程序化全量校验 + 人工 sed 窗口抽查 30+ 条 + quality evidence 逐字 diff + 全 app/src 实质验真

## 总体结论：退回修正（4 项硬问题 + 3 项轻微）

writer 的事实基本功扎实：111 条 facts 逐条程序化校验（文件存在 / 行号不越界 / 每个反引号符号落 ±5 窗口）**0 失败**；曾出过问题的 `inputFinished`（:406/:469）与 `IDLE`（:476）锚点本次全部合规；quality 6 条实质全部验真（见下）。但仍有 3 条跨窗口复合事实 + 1 处 evidence 非逐字违反引用铁律，必须修正。

## 一、退回项（必须修正）

### 1. fact[51] —— 跨窗口复合事实
- 现状：「动态阈值 `dynThreshold` 取下限、0.865、`intraMin` 减 0.02 三者钳制」→ `PersonalWakeListener.kt:250`
- 实测：:250 的窗口（245–255）含公式 `dynThreshold = max(config.minDynamicThresholdFloor, min(config.similarityThreshold, (intraMin - config.dynamicThresholdMargin).coerceIn(0f, 1f)))`，但字面数字 `0.865` / `0.02` 定义在 **30–31 行**，窗口内不可见。
- 修正（建议改述，不必拆分，数字已有 [41] 覆盖）：「动态阈值 `dynThreshold` 取 `minDynamicThresholdFloor` 下限、`similarityThreshold`、`intraMin` 减 `dynamicThresholdMargin` 三者钳制」→ `:250` 不变。
- 正文同位置镜像句（「个人唤醒词」节）一并改。

### 2. fact[46] —— 跨窗口复合事实
- 现状：「语音段超过 `maxSegmentMs` 1600ms 强制 `flushSegmentIfNeeded`」→ `PersonalWakeListener.kt:123`
- 实测：:123 窗口（118–128）含 `if (speechMs >= config.maxSegmentMs)`，但 `1600` 定义在 **27 行**，窗口内不可见。
- 修正：改述为「语音段超过 `maxSegmentMs` 强制 `flushSegmentIfNeeded` 并重置分段」→ `:123`；另新增一条「唤醒配置 `maxSegmentMs` 1600ms、`endSilenceMs` 350ms」→ `:28`（窗口 23–33 同时覆盖 27/29 行），保留数值信息。
- 正文镜像句一并改。

### 3. fact[47] —— 跨窗口复合事实
- 现状：「尾部静音超过 `endSilenceMs` 350ms 触发 `flushSegmentIfNeeded`」→ `PersonalWakeListener.kt:133`
- 实测：:133 窗口（128–138）含 `if (silenceMs >= config.endSilenceMs)`，但 `350` 定义在 **29 行**，窗口内不可见。
- 修正：改述为「尾部静音超过 `endSilenceMs` 触发 `flushSegmentIfNeeded`」→ `:133`（数值由第 2 项新增条目覆盖）。
- 正文镜像句一并改。

### 4. quality Q5 evidence 非逐字
- 现状：evidence 为 `SpeechServiceType.SHERPA_NCNN -> SherpaSpeechProvider(appContext)`，`line: 134`
- 实测：源码 134 行原文为 `                            SpeechServiceType.SHERPA_NCNN -> SherpaSpeechProvider(appContext)`（28 空格缩进）。evidence 剥掉了前导缩进，**不是逐字**。
- 修正：evidence 改为含 28 空格缩进的原文（`line` 保持 134）。
- 实质结论本身验真：全 `app/src` 检索 `SherpaMnnSpeechProvider(` 仅自身文件内出现，工厂 `SHERPA_NCNN` 分支确只创建 `SherpaSpeechProvider` —— 663 行 MNN 引擎不可达成立（high 置信合理）。

## 二、轻微项（建议顺手修）

### 5. fact[105] —— 计数不精确
- 现状：「`transcribeWavFile` 用 multipart 发 `file`、`model`、`language` 三个字段」→ `OpenAISttProvider.kt:564`
- 实测：窗口（559–569）显示实际发送 4 个字段：`file`（562）、`model`（563）、`language`（566）、`response_format`（568）。
- 修正：删掉「三个」计数，改为「用 multipart 发送 `file`、`model`、`language` 字段」。

### 6. quality Q2 detail 表述可完善
- 现状：detail 称 `l2NormalizeInPlace`「全文件无调用点」——就 `PersonalWakeFeatureExtractor.kt` 而言属实（仅 379 行定义，文件内 0 调用），死代码结论成立。
- 但：`PersonalWakeListener.kt` 有同名私有函数（385 行）且在 339 行被真实调用。两实现近乎重复（仅 `sqrt(max(EPS,…))` vs `kotlin.math.sqrt(max(1e-10f,…))` 差异）。
- 建议：detail 补一句「注意 `PersonalWakeListener` 有同名存活副本（:385，被 :339 调用），此处死的是 extractor 内的重复版本」，避免读者混淆。

### 7. status.json `source_repo` 大小写
- 现状：`"source_repo":"Operit"`；batch-04 铁律要求统一小写 `"operit"`（`check_staleness.py` 只接受小写）。
- 修正：改为 `"operit"`。其余字段（issue 58 整数 / review-pending / commit 钉住）均合规。

## 三、已通过的核验（抽查记录）

**facts 人工窗口抽查（全部通过）：**
- [1]/[2] RecognitionState 六态枚举（:14/:20）；[3] RecognitionResult 默认值（:32）；[8] startRecognition 默认参数（:78）
- [22] 40000 采样环形缓冲（:18，`(16000*2500)/1000` 实算一致）；[29]/[30]/[31] 注册录音三组参数（:16/:27/:41）
- [34]/[35] Config 默认值（:16/:20）；[38] 39 维特征（:64，`numMfcc*3`）
- [41] 阈值数字（:32，窗口 27–37 覆盖 0.865/0.84/0.02）；[42]/[43] dtwBand/时长比/minRms（:37/:39）
- [61] VAD 512+64（:112）；[62] 三档阈值 0.5/0.8/0.95（:315）；[64] maxSpeechFramesCount（:197）
- [66]/[67]/[68] ncnn 模型名/解码/端点参数（:132/:172/:180）；[70] consumePending 注入（:252）
- [74]/[102]/[103] `inputFinished()`/:406/:469 与 `IDLE`/:476 —— writer 预修的 3 处全部合规
- [76] getSupportedLanguages（:534）；[77]/[78] mnn 模型/端点（:133/:145）；[84] cancel 不释放 stream（:602）
- [86] 60s/25MB（:46）；[87] URL 校验（:109）；[88] 44 字节 wav 头（:166）；[89] preRoll 0.5s（:209）
- [92] JSON `text` 字段（:590）；[93] mapLanguage（:550）；[95] Deepgram transcript 路径（:580）
- [98] VOLUME_SMOOTHING_FACTOR 0.1（:92）；[105]/[106] multipart/Bearer（:564/:570）；[107]/[108]/[110] Deepgram 校验/Token 头（:105/:110/:558）

**quality 逐字 diff（Q0–Q4 逐字一致，Q5 见退回项 4）：**
- Q0（warning/中置信）：MNN 文件全文件 0 处 `Mutex`，ncnn 版 `recognitionMutex.withLock` 在 :231/:447/:486 —— 并发竞态成立。
- Q1（warning/中置信）：`runBlocking` 共 7 处命中（6 个调用点 + 1 import）——「多处」成立。
- Q2（suggestion/高置信）：extractor 内 0 调用，死代码成立（见轻微项 6）。
- Q3（suggestion/高置信）：166–168 行建 `FileOutputStream`，外层 catch（316–321）只置 ERROR 不关流不删文件 —— 泄漏路径成立。
- Q4（suggestion/高置信）：`createVad` 空实现 + TODO，`vad = null` —— 自带 VAD 禁用成立。

**正文：**
- 115 个去重 `file:line` 引用，文件存在 + 行号不越界 **0 失败**。
- 双受众结构完整：概述 / `## AI 速览` / 核心机制（7 小节）/ 关键符号 / 调用链 / 来源。
- 唯一问题：正文镜像了退回项 1–3 的三句（见上），随 facts 一并改。

**lint：** 单页隔离跑 `scripts/lint.py`（--src ~/workspace/Operit --dir 单页目录）实测 **0 硬失败 / 0 警告**，`.lint.md` 所载为真。

## 四、给修错员的修正清单

1. fact[51] 改述去数字（ref 不变）；2. fact[46] 改述去 1600（ref 不变）；3. fact[47] 改述去 350（ref 不变）；4. 新增 1 条唤醒配置数值 fact → `PersonalWakeListener.kt:28`；5. fact[105] 删「三个」；6. Q5 evidence 补 28 空格缩进；7. Q2 detail 补同名副本注记；8. status.json `source_repo` → `"operit"`；9. 正文三处镜像句同步改；10. 重跑单页 lint 确认 0/0。

## 复检2（2026-10-01T14:09 CST，针对复检退回 4 硬项的快速复检）——**通过**

### 验证方法

修错后文件 facts 111→112 条、quality 6 条，lint 0 硬失败 / 0 警告（修错员自报；本复检未重跑全文，仅针对 4 硬项逐条 sed 验真）。本次只复检 4 硬项，不重走全文。

### 1. fact[51] 改述去数字 → 通过

注：facts 插了一条新条目后，改述项的实际索引为 **fact[52]**（修错员报告里仍按旧编号 [51] 写，内容一致）。

- 现 ref：`PersonalWakeListener.kt:250`；窗口 245–255 sed 实测：
  - 250 行 `val dynThreshold =`，251 行 `config.minDynamicThresholdFloor`，253 行 `config.similarityThreshold`，254 行 `(intraMin - config.dynamicThresholdMargin).coerceIn(0f, 1f)`。
- 断言「动态阈值 `dynThreshold` 取 `minDynamicThresholdFloor` 下限、`similarityThreshold`、`intraMin` 减 `dynamicThresholdMargin` 三者钳制」：
  - 5 个反引号符号全部落 ±5 窗口内；数字 `0.865`/`0.02` 已删除（全文件 grep fact 无残留）；`max(floor, min(sim, intraMin - margin))` 的"钳制"语义准确。✓

### 2. fact[46] 改述去 `1600ms` → 通过

- ref：`PersonalWakeListener.kt:123`；窗口 118–128 sed 实测：
  - 123 行 `if (speechMs >= config.maxSegmentMs)`，124 行 `flushSegmentIfNeeded(config, segment, speechMs, noiseRmsEma)`，125 行 `resetSegment(segment)`。
- 断言「语音段超过 `maxSegmentMs` 强制 `flushSegmentIfNeeded` 并重置分段」：3 个符号全部落窗；"重置分段"有 `resetSegment` 逐字支撑。✓

### 3. fact[47] 改述去 `350ms` → 通过

- ref：`PersonalWakeListener.kt:133`；窗口 128–138 sed 实测：
  - 133 行 `if (silenceMs >= config.endSilenceMs)`，134 行 `flushSegmentIfNeeded(config, segment, speechMs, noiseRmsEma)`。
- 断言「尾部静音超过 `endSilenceMs` 触发 `flushSegmentIfNeeded`」：符号全部落窗。✓

### 4. quality Q5 evidence 逐字节一致 → 通过

- evidence 为单行，`line: 134`，文件 `SpeechServiceFactory.kt`。
- 程序化 diff：evidence 与源码第 134 行**仅差末尾换行符**（evidence 93 字节 vs 源码 94 字节含 `\n`），前导 **28 个空格**双方一致。
- 首 50 字符逐字比对：`'                            SpeechServiceType.SHER'` 与源码完全一致。✓

### 结论

**4 硬项全部闭环，无未通过条目。** 本页事实与引用已达收货标准，可进入发布队列。
