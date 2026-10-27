# api-voice critic 复核报告

- 条目：api-voice（语音合成 TTS 服务），Issue #59
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 复核方式：194 条 facts 逐条机检（文件存在/行号范围/断言要素 ±5 窗口）+ 约 45 条人工 sed 语义核验；7 条 quality evidence 逐字 diff；正文 §9 结构检查；status.json 字段检查
- **结论：退回修正**（见下表 90 处引用问题；事实本身经抽验全部为真，无虚构，但引用锚点系统性错位）

## 总览

| 项 | 结果 |
|---|---|
| facts | 194 条中 **104 条通过**，**90 条需修正**（引用错位/复合事实/错文件） |
| quality | **7/7 通过**（evidence 与源码逐字一致，severity 置信度合理） |
| 正文 api-voice.md | §9 结构完整（概述/AI速览/核心机制/关键符号/调用链三段式/来源），符号英文原文，术语首现有解释 |
| .status.json | 正确（id=api-voice，issue=59，status=review-pending，source_commit=dbf71916…33fb，source_repo=Operit） |
| lint | 0 硬失败 / 0 警告 |

## 核心问题模式

writer 系统性地引用了"节起始行"（类声明/companion 起始/函数签名行），而断言证据在下方 6–60 行处，
±5 窗口撑不起断言。另有 1 处引用错文件（[51]）、约 15 处复合事实（一引多断，需拆分）。
所有被抽验的断言语义均为真——这是纯引用锚点问题，不是事实造假。

## quality 逐条验证（全通过）

| # | severity | 结论 |
|---|---|---|
| 0 | high | **属实**：`DoubaoVoiceProvider.kt:73` `"Authorization" to "Bearer;{apiKey}"`——分号应为空格，服务端会拒收，high 合理 |
| 1 | warning/high | 属实：`SiliconFlowVoiceProvider.kt:240` 请求体手写拼接，仅 `replace("\"", "\\\"")` 转义双引号 |
| 2 | warning/high | 属实：`HttpVoiceProvider.kt:88` `audioCache = ConcurrentHashMap`，`clearCache()` 仅 `shutdown()`（:286）调用，无上限/淘汰/TTL |
| 3 | warning/medium | 属实：`HttpVoiceProvider.kt:596` `responseBody.bytes()` 全量读入，无大小上限 |
| 4 | warning/medium | 属实：`VoiceServiceFactory.kt:112` `private var instance` 无 `@Volatile`/`synchronized`，`getInstance`（:122-131）竞态可建双实例 |
| 5 | warning/medium | 属实：`SiliconFlowVoiceProvider.kt:269` `AppLogger.d(TAG, "TTS请求体: $requestBody")` 打印含用户原文的完整请求体 |
| 6 | warning/medium | 属实：`HttpVoiceProvider.kt:976` `generateCacheKey` 用 `text.hashCode()`，碰撞返回错误音频 |

## facts 修正清单（90 条）

格式：`[idx] 当前 ref → 动作`。修错时按"对照表"逐条改 ref 后用 sed 复验 ±5 窗口；
标"拆分"的须拆成多条 facts（各配独立 ref），facts 总数会增加。

### VoiceServiceFactory.kt
- [13] `:11` → **拆分**：枚举 9 个值跨 12–27 行，±5 放不下。拆成两条：前 5 值 ref `:16`（窗口 11–21），后 4 值 ref `:24`（窗口 19–29）
- [14] `:27` → `:40`（`runBlocking` 在 40–41，`serviceType` 分发在 44；窗口 35–45 全覆盖）
- [15] `:39` → **拆分**：`SIMPLE_TTS→SimpleVoiceProvider` ref `:45`；`HTTP_TTS→HttpVoiceProvider` ref `:52`
- [16] `:51` → **拆分**：`OPENAI_WS_TTS→OpenAIRealtimeVoiceProvider` ref `:57`；`OPENAI_TTS→OpenAIVoiceProvider` ref `:92`
- [17] `:59` → **拆分**：四个分支各一条，refs `:66`/`:74`/`:80`/`:86`
- [19] `:112` → `:125`（单例判定逻辑 122–131；窗口 120–130）

### HttpTtsResponsePipelineStep.kt
- [25] `:17` → `:21`（6 个 TYPE 常量在 18–23；窗口 16–26 全覆盖）

### HttpVoiceProvider.kt
- [29] `:42` → **拆分**："open 类" ref `:46`；"MiniMax/MiMo/豆包基类或委托"为跨文件断言，拆成三条各引自有文件（豆包继承 `DoubaoVoiceProvider.kt:8`，MiniMax 委托 `MiniMaxVoiceProvider.kt:39`，MiMo 委托 `MimoVoiceProvider.kt:47`）
- [38] `:228` → `:234`（`audioCache[cacheKey]` 在 234；原窗口 223–233 差 1 行）
- [39] `:966` → `:976`（键拼接在 976；原窗口只有 KDoc+签名）
- [40] `:343` → **拆分**：POST 占位符进 requestBody ref `:362`；GET 占位符进 URL ref `:380`
- [41] `:326` → `:340`（占位符 map 在 338–344；窗口 335–345）
- [42] `:386` → `:405`（Authorization 自动头逻辑 403–408；窗口 400–410）
- [43] `:392` → `:413`（headers 占位符替换 `replacePlainPlaceholders` 在 414；窗口 408–418）
- [44] `:400` → `:421`（`HttpLogSanitizer.urlForLog/headersForLog` 在 421–422）
- [45] `:408` → `:426`（管线分发 `resolvePipelineAudio` 在 428；空管线用原始字节在 424–426，窗口 421–431 全覆盖）
- [46] `:420` → `:431`（`tts_<uuid>.bin` 落盘在 431）
- [47] `:607` → `:625`（6 种步骤分发 621–633；窗口 620–630）
- [51] **错文件**：`parseJsonPath` 在 `HttpVoiceProvider.kt:921`，不在 `HttpTtsResponsePipelineStep.kt`。ref 改为 `HttpVoiceProvider.kt:921`（窗口 916–926 覆盖 `$` 前缀/`.`/`[index]` 解析）
- [52] `:695` → `:725`（`followHttpUrl`：取字符串当 URL+步骤 headers 在 720–733；原 :695 窗口是无关的 pick 错误码）
- [53] `:767` → **拆分**：GET/POST 方法校验 ref `:774`（769–778 在窗口内）；POST 要求 body 与 content_type ref `:792`
- [56] `:966` → `:976`（同 [39]，哈希碰撞断言证据在 976）

### DoubaoVoiceProvider.kt
- [64] `:26` → `:28`（管线三步在 26–33，`base64_decode` 在 33，窗口 23–33 全覆盖）
- [65] `:40` → **拆分**：initialize 重建配置 ref `:44`；speak 重建配置 ref `:51`（原窗口 35–45 看不到 speak 的 51 行）

### MiniMaxVoiceProvider.kt
- [69] `:8` → `:39`（`delegate = HttpVoiceProvider(context)` 在 39）
- [72] `:24` → `:31`（管线 `pick(data.audio)→http_get` 在 29–36；窗口 26–36）
- [73] `:38` → **拆分**：initialize 判空抛错 ref `:51`；speak 判空抛错 ref `:67`
- [74] `:83` → `:122`（`output_format`/`voice_setting` 在 122–125）
- [75] `:90` → `:129`（`audio_setting` 32000Hz/128kbps 在 129–131）
- [76] `:100` → `:75`（modelName 回退链在 74–77；原 :100 窗口是 `shutdown()`）

### MimoVoiceProvider.kt
- [77] `:8` → `:47`（`delegate = HttpVoiceProvider(context)` 在 47）
- [79] `:15` → **拆分或重锚**：9 个音色列表约 16–34 行，±5 放不下。建议拆两条（中音色 ref `:25`，英音色 ref `:31`）或只断言"内置 9 个音色"并 ref `:25`（修错员复验窗口）
- [80] `:28` → `:38`（管线在 36–44，`path="choices[0].message.audio.data"` 在 41；原 :28 窗口是音色列表）
- [81] `:41` → **拆分**：initialize 判空抛错 ref `:60`；speak 判空抛错 ref `:75`
- [83] `:120` → `:139`（`audio.format=wav` 在 139、`stream=false` 在 142；窗口 134–144）

### OpenAIVoiceProvider.kt
- [86] `:38` → `:46`（6 音色列表在 43–50；窗口 41–51）
- [87] `:90` → `:94`（endpoint 三项校验在 91/94/97；窗口 89–99 全覆盖）
- [88] `:99` → `:103`（apiKey/model/voiceId 三项判空在 100/103/106；窗口 98–108）
- [89] `:138` → `:145`（speed 钳制 `coerceIn(0.25, 4.0)` 在 145–146）
- [90] `:136` → `:143`（`response_format` 默认 mp3 在 143–144）
- [97] `:272` → **拆分**：释放播放器+删文件 ref `:277`（272–281 在窗口 272–282）；`complete` 挂起播放 ref `:285`

### OpenAIRealtimeVoiceProvider.kt
- [100] `:44` → `:53`（10 音色列表在 48–58；窗口 48–58 恰好全覆盖）
- [101] `:59` → `:65`（`readTimeout(0)` 在 65、`pingInterval(20)` 在 67；窗口 60–70）
- [103] `:187` → `:189`（`conversation.item.create` 发送在 189，`response.create` 在 194；窗口 184–194 全覆盖）
- [107] `:388` → `:417`（`wrapPcm16AsWav` 定义在 417，手写 44 字节头在 423–424；原 :388 窗口是 response.create 的 JSON 组装）
- [108] `:336` → `:347`（`buildRealtimeUrl` 在 347）
- [109] `:380` → `:409`（`buildVoiceValue` 在 409–411；`voice_` 前缀判在 410）
- [111] `:548` → `:561`（`webSocket?.cancel()` 在 561，`complete(ByteArray(0))` 在 563；窗口 556–566）

### SiliconFlowVoiceProvider.kt
- [115] `:115` → `:56`（8 中文音色列表在 52–60；原 :115 是请求循环，完全错位）
- [118] `:195` → `:185`（`if (!isInitialized)` 在 185–186；原窗口 190–200 看不到）
- [119] `:201` → `:191`（`interrupt && isSpeaking → stopPlaybackOnly()` 在 191–192）
- [120] `:205` → `:195`（generation 校验 `request.generation != stopGeneration.get()` 在 195–196）
- [123] `:221` → `:211`（model/voice 优先级 `extraParams > 配置 > 默认` 在 208–216；窗口 206–216）
- [126] `:262` → `:273`（`HttpURLConnection` POST + `Authorization: Bearer` 在 273–275）
- [127] `:269` → `:287`（`siliconflow_tts*.mp3` 落盘在 287；原 :269 窗口是请求体日志行）
- [128] `:278` → `:295`（generation 变化删临时文件在 295–296）
- [129] `:469` → `:474`（setVoice 校验在 474–476；原窗口 464–474 差 1–2 行）

### AccessibilityVoiceProvider.kt（SimpleVoiceProvider 在此文件）
- [131] `:23` → **拆分**："基于 Android TextToSpeech" 保留 ref `:23`（KDoc 在 22–26，窗口内）；"是 SIMPLE_TTS 的实现" 改引 `VoiceServiceFactory.kt:45`
- [133] `:177` → **拆分**：注册 `UtteranceProgressListener` ref `:167`；onStart/onDone/onError/onRangeStart 四个回调跨 169–260 行放不进一个窗口，拆成"注册跟踪"一条 + 回调枚举一条（ref `:169`，修错员复验）
- [134] `:247` → `:250`（`currentUtteranceRangeStart` 赋值在 253–256；窗口 245–255）
- [137] `:435` → `:431`（`pause()` 在 423，`buildPausedSegmentsLocked()` 调用点在 435；"未读完部分+后续队列"的构建逻辑在该函数定义 `:101`——修错员二选一复验，建议拆成两条）
- [139] `:606` → `:598`（gender 按名称含 female/male 推断在 595–600；窗口 593–603）
- [142] `:695` → **拆分**：精确语言标签→同语言 ref `:713`；`isLanguageAvailable` 兜底 ref `:720`

### QueuedTtsPlayback.kt
- [144] `:20` → `:42`（`speakQueue` UNLIMITED 在 42，`playbackQueue` capacity=1 在 43；原 :20 是 import 区）
- [145] `:43` → **拆分**：`stopGeneration` 字段 ref `:44`；generation 不一致丢弃 ref `:165`
- [149] `:133` → `:147`（`shutdown()` 在 147–160：清队列/释放 MediaPlayer/cancel 域/关 Channel；原 :133 是无关函数尾）
- [151] `:208` → `:226`（`CONTENT_TYPE_SPEECH`/`USAGE_MEDIA` 在 228–229；窗口 221–231）
- [152] `:224` → `:243`（`while (it.isPlaying || isPaused.get()) { delay(100) }` 在 244–245）
- [153] `:230` → `:250`（`finally` 释放 MediaPlayer 在 250–251）

### VoiceListFetcher.kt
- [156] `:19` → `:25`（3 个候选 URL 在 25–29；原 :19 窗口是 OkHttpClient builder）
- [158] `:44` → `:64`（逐个候选 GET + Bearer 头在 64–70；原 :44 是 `extractBaseUrl`）
- [160] `:132` → **拆分**：`dedupeVoicesById` 定义 ref `:126`；"保留更全的一条" 的 score 逻辑 ref `:157`

### VitsVoiceProvider.kt
- [161] `:44` → **拆分/重锚**：ONNX Runtime 证据 ref `:182`（`OrtEnvironment.getEnvironment()`）；"Piper" 在本文件无出处，出自 `VoiceServiceFactory.kt:26` 注释——要么改引该处，要么删掉 Piper 字样
- [164] `:135` → `:187`（双 Channel 在 187–188；原 :135 是 lexicon 分词函数内部）
- [165] `:238` → `:256`（initialize 流程：包根目录 258→包文件→运行时配置→ONNX session；窗口 251–261）
- [168] `:317` → **拆分或重锚**：`tokenize` 在 339，`runModel` 在 349，"非空才进播放队列"在 350–351。建议拆两条（tokenize→PCM ref `:339`；非空进队列 ref `:350`）
- [169] `:411` → `:402`（`floatArrayOf(noiseScale, lengthScale / effectiveRate.coerceAtLeast(0.01f), noiseW)` 在 402；原 :411 是 sid 输入段）
- [173] `:648` → `:672`（`extractZipPackage`：filesDir/`vits_tts_packages`/sha256 签名在 672–675；窗口 667–677）
- [175] `:666` → `:673`（签名 `路径|长度|修改时间` sha256 取前 16 在 673–675）
- [176] `:705` → `:727`（manifest 优先定位在 726–729）
- [178] `:731` → `:766`（sample_rate 多路查找在 766–767）
- [179] `:1144` → `:1153`（token map 来源四键在 1153–1154，symbols 数组在 1160–1161；建议 ref `:1156` 窗口 1151–1161 全覆盖）
- [180] `:821` → `:827`（`text_mode=token_ids` 分支在 827–829；原窗口 816–826 差 1–2 行）
- [181] `:834` → `:838`（`direct_symbols` 分支在 842；窗口 833–843）
- [182] `:840` → `:851`（bos/eos 拼接在 849–851，addBlank 交错插入在 853–854；建议 ref `:851` 窗口 846–856 全覆盖）
- [183] `:90` → **拆分**：空白跳过+ASCII 单词整体查词典 ref `:123`（117–134 在窗口 118–128）；最长匹配 ref `:138`
- [186] `:920` → `:907`（lengths/scales/sid 候选名匹配在 907–913）
- [188] `:980` → `:1008`（FLOAT/DOUBLE 分支在 1008–1012）
- [190] `:1026` → `:1057`（`extractPcm16` 五路分发 float/double/short/int/bytes 在 1056–1063；窗口 1052–1062）
- [191] `:1050` → `:1077`（`floatsToPcm16`：`coerceIn(-1f, 1f)`、非有限按 0、`Short.MAX_VALUE` 在 1077–1079）

## 给修错员的执行要求

1. 按上表逐条改 `ref`（只改行号/拆分 facts，不动断言文字除非拆分必需）。
2. 每改一条用 `sed -n '<n-5>,<n+5>p'` 复验窗口完全支撑断言；拆分后新 facts 重新编号无所谓，保持 JSON 数组合法。
3. 全部改完重跑 `python3 scripts/lint.py`（repo 根），必须 0 硬失败 / 0 警告。
4. 不要动 `api-voice.md`、`api-voice.quality.json`、`.status.json`、`review-queue.json`。
5. 完成后通知重新派 critic 复检。

## 附：抽验为真但引用 OK 的示例（供参考抽查方法）

- [91] `OpenAIVoiceProvider.kt:160` Authorization: Bearer ✓ 窗口内
- [104] `OpenAIRealtimeVoiceProvider.kt:215` 双事件名兼容 ✓（注释+代码在 217–218）
- quality #0 豆包 `Bearer;` 高危：已用 sed 逐字确认，属实非误报

## 复检（2026-10-01T13:58 CST，修错后复检）

- 复检范围：只复检修错项，不重走全文。源码钉住 `dbf71916`（已核对 HEAD）。
- **结论：通过**（附 1 处轻微 ref 建议，非阻塞）。

### 验证方法与结果

1. **程序化全量校验**：222 条 facts 的 ref 文件存在、行号不越界、断言中每个反引号符号落在 ±5 窗口内——**0 失败**。
2. **人工抽查改动项**：按退回清单抽查 35+ 条改动 fact（含全部 21 处拆分各抽 1 条以上），逐个用 sed 导出 ±5 窗口核对——断言均被窗口完全支撑：
   - 工厂枚举/分支拆分（[13]/[15]/[16]/[17]）、单例判定（[19]:125）、TYPE 常量（[25]:21）
   - [29] 拆 4 条："open 类" :46、豆包继承 DoubaoVoiceProvider.kt:8、MiniMax 委托 MiniMaxVoiceProvider.kt:39、MiMo 委托 MimoVoiceProvider.kt:47——跨文件断言各引自有文件 ✓
   - [51] 错文件修正：HttpVoiceProvider.kt:921 ✓（`$` 前缀处理在窗口内）
   - POST/GET 占位符（:362/:380）、方法校验（:774/:792）、豆包/Minimax/MiMo 的 initialize/speak 判空拆分、中/英音色拆分（:25/:31）、OpenAI stop 拆分（:277/:285）、语言匹配拆分（:713/:720）、QueuedTtsPlayback 拆分、VoiceListFetcher 拆分（:126/:157）、VITS 系列（ONNX :182、Piper 出处改引 Factory 注释 :26、tokenize :339、非空进队列 :350、分词 :123/:138）
   - [133] 拆分齐全：注册 :167 + onStart :169 + onDone :193 + onError :211 + onRangeStart :247 + onRangeStart 记录 :250
   - [137] 拆 2 条：:435（pause 调用 buildPausedSegmentsLocked）/:116（函数定义取未读完部分）
   - [145] 拆 2 条：stopGeneration 字段 :44 / playPreparedRequest 丢弃分支 :208（比原建议 :165 更贴合断言，合规优化）
3. **旧错 ref 残留扫描**：critic 退回清单中的 90+ 个旧 ref 全扫——6 处残留经核实均为误报（fact[136] 的 :195 恰是 generation 校验行，与退回的 [118] 是不同断言；fact[146] :269 本就是请求体日志行；fact[147] :23 系 critic 明确保留；fact[154] :247 的 onRangeStart 签名支撑当前断言；fact[169] :208 如上所述更优）。
4. **104 条未动条目**：抽查 10 条（fact[3]/[8]/[30]/[55]/[70]/[99]/[120]/[175]/[200]/[218]），窗口全部支撑断言，无漂移。
5. **lint**：修错员已重跑，0 硬失败 / 0 警告。

### 未通过条目

无。

### 1 处轻微建议（非阻塞，可顺手修）

- fact[158]（"pause 调用 buildPausedSegmentsLocked 捕获待恢复片段"）当前 ref 为 `:435`，其 ±5 窗口（430–440）能看到 `buildPausedSegmentsLocked()` 调用与 captured 捕获逻辑，但看不到 `pause()` 声明（在 423 行）。critic 原建议的 `:431` 窗口（426–436）同时覆盖 `pause request` 上下文与调用点，更符合引用铁律。建议修错员顺手改为 `:431`。
