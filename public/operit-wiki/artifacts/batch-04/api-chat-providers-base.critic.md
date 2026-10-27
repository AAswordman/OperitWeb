# Critic 复核报告：api-chat-providers-base（供应商接入基础设施）

- 复核对象：`review/batch-04/api-chat-providers-base.{facts,quality,md,lint,status}.json/md`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：151 条 facts 全量结构校验（文件存在、行号在范围内）+ 脚本化 ±5 窗口关键词检查 + 对 25 条 flagged 及全部高风险断言逐条人工核对源码原文；quality 5 条逐条 diff 验 evidence

## 结论：退回修正

**facts：151 条中 107 条通过，44 条引用错位需修正。**
**quality：5 条证据内容全部真实（逐字一致，首行缩进有剥离属轻微瑕疵），2 条行号锚点错位需修正（Q4、Q5），另 2 条锚点差 1–2 行建议顺手修正。**
**正文 md：通过。status.json：正确。**

### 核心问题

writer 的断言内容本身基本属实（抽查的高危断言、枚举映射、超时数值、URL 规则均与源码一致），
但约 29% 的 fact 行号锚点不在 ±5 支撑窗口内——像是凭印象估的行号，而非从实际读取位置记录。
按引用铁律（SCHEMA §2）必须退回，把错位 ref 重新锚定到正确行号（下方给出每个的正确锚点）。

### 需修正的 facts（44 条：索引 / 原 ref / 正确锚点）

AIService.kt：
- [9] `:78` stream 复合事实 → 拆成两条：stream 参数 `:65`、返回值恒为 Stream `:74`

AIServiceFactory.kt：
- [25] `:69` → `:78`（AppLogger.e("AIHttpTrace")）
- [26] `:100` → `:94`（callStart）
- [27] `:108` → `:98`（dnsStart）
- [28] `:112` → `:106`（connectStart）
- [29] `:122` → `:114`（secureConnectEnd）
- [30] `:142` → `:132`（connectFailed）
- [42] `:271` → `:261`（TokenTrackingAIService 行为 KDoc 在 261–262，271 的窗口内无行为断言支撑）
- [43] `:294` → `:287`（ToolPkgAiProviderRegistry 检查）
- [44] `:304` → `:297`（fromProviderTypeId）
- [45] `:311` → `:303`（useMultipleApiKeys）
- [46] `:235` → `:224`（parseCustomHeaders）
- [50] `:319` → `:312`（四个能力开关，实际在 310–314）
- [51] `:334` → `:320`（XAI 分支）
- [52] `:352` → `:335`（OPENAI 分支；352 的窗口内是 GENERIC 分支，会造成归因错位）
- [53] `:364` → `:352`（OPENAI_GENERIC/OPENAI_LOCAL）
- [54] `:381` → `:369`（OPENAI_RESPONSES 系）
- [55] `:394` → `:388`（OPENAI_CODEX：分支在 386，CodexAuthManager 在 388）
- [56] `:413` → `:403`（ANTHROPIC 系）
- [57] `:428` → `:419`（GOOGLE 系）
- [58] `:442` → 拆成两条：LMSTUDIO `:435`、OLLAMA `:452`
- [73] `:673` → `:679`（NVIDIA 分支）

EndpointCompleter.kt：
- [74] `:28` → `:21`（trim 与 `#` 判断在 20–22，28 的窗口 23–33 不含 endsWith("#") 检查）
- [78] `:64` → `:51`（"是私有的"子断言：private 关键字在 51；或删去"私有"二字。补全规则本身在窗口内无误）
- [83] `:119` → `:125`（else 分支）

ModelListFetcher.kt：
- [86] `:45` → `:37`（SENSITIVE_QUERY_PARAMETER_NAMES 列表中部；45 的窗口只看到列表尾部 2 个名字，撑不起"包含 10 个名字"的断言）
- [88] `:57` → `:49`（UnsafeModelSsl.apply 包裹在 49，57 的窗口 52–62 不含它；30 秒超时在 51–53 部分可见）
- [89] `:79` → `:68`（OpenAI 系 /v1/models 分支在 68–73）
- [114] `:295` → `:301`（client.newCall(request).execute()）
- [116] `:329` → 拆分或重锚 `:320`（成功解析返回在 318–321，失败 IOException 在 324–332；当前窗口 324–334 不含成功路径）
- [118] `:366` → `:384`（解析分发 when 在 381–388）
- [119] `:394` → `:404`（delayTime = 1000L * retryCount 在 404–406；catch 在 397）
- [120] `:408` → `:420`（UnknownHostException catch）
- [121] `:426` → `:435`（重试耗尽返回）
- [122] `:455` → `:449`（data 数组检查在 449–452；"按 id 排序"在 467，若保留该子句需拆条锚 `:467`）
- [123] `:490` → 拆分：data/models 分发 `:478`、id 回退/display_name `:492`
- [125] `:548` → `:536`（supportedGenerationMethods 过滤逻辑在 529–544）
- [127] `:561` → `:572`（id.contains("gemini") 过滤）
- [128] `:581` → `:592`（getMnnLocalModels）
- [129] `:587` → `:603`（目录不存在返回空列表）
- [130] `:602` → `:611`（llm.mnn 主文件检查在 611–613）
- [131] `:621` → `:640`（getLlamaLocalModels）
- [132] `:636` → `:657`（id/name 取文件名在 657–660）
- [133] `:652` → `:676`（formatFileSize）

### quality.json 核查

5 条证据内容全部真实，与源码逐字一致（仅首行缩进被剥离，属格式轻微瑕疵，建议重抄时保留原始缩进）。
4 条高危（UnsafeModelSsl 相关）证据确凿：
- Q1 `checkServerTrusted` 空实现（UnsafeModelSsl.kt:23–26，锚点 :25 在同一函数体内，可接受，建议改 `:23`）
- Q2 `hostnameVerifier { _, _ -> true }`（:36 精确）
- Q3 `SharedHttpClient` 被 `UnsafeModelSsl.apply` 包裹（AIServiceFactory.kt:198，锚点 :199 差 1 行，建议改 `:198`）
- Q4 `ModelListFetcher` 私有客户端被包裹（实际在 :49–50，锚点 :53 错位，**需修正**）
- Q5 MNN 模型目录在公共下载区（实际 modelsDir 在 :595–598，锚点 :581 错位，**需修正为 :595**）

severity 判定合理：4 高危（TLS 完全失效 + API Key 暴露面）无夸大；Q5 为 suggestion/medium 恰当。

### 正文 md 核查：通过

- §9 双受众结构完整：概述 / ## AI 速览（核心符号清单+主入口+数据流向一句话）/ 核心机制（7 节）/ 关键符号（表格，英文原文）/ 调用链（输入→处理→输出三段式编号）/ 来源（精确到文件，行数与实际一致）
- 人话可读，术语首现基本有解释；高危事项（UnsafeModelSsl）在概述与机制 §7 中明确警示，未塞进 quality 以外的地方夸大
- 调用链内联引用（:272/:280/:59/:205）经核对均在 ±5 窗口内

### status.json：正确

id / title / issue 48 / status review-pending / source_repo Operit / source_commit dbf71916… 均正确，critic 留空待填。

### 复检要求

writer 按上表修正 44 条 ref（拆分 5 处复合事实）+ quality Q4/Q5 行号后，critic 需对修正条目复检窗口支撑，确认后方可关闭。

## 复检（2026-10-01 13:55 CST）

**结论：通过。退回的 44 处引用 + quality 2 处行号 + evidence 缩进已全部修正，无遗漏。**

复检方式（源码 Operit @ `dbf71916`，`git rev-parse HEAD` 一致、工作树干净）：
1. **全量窗口程序化校验**：159 条 facts 全部解析 ref（文件存在、行号不越界），每条事实的反引号符号在 ±5 窗口内逐字命中——**0 失败**。
2. **critic 锚点对照**：将退回清单中的 52 个期望锚点与修复后 facts.json 的 ref 全集比对——**52/52 全部命中，0 缺失**。
3. **拆分条目人工抽查**（窗口逐行核实）：[9](:65/:74)、[58](:435/:452)、[78](:51/:64)、[116](:320/:330)、[119](:401/:412)、[122](:449/:458/:467)、[123](:478/:493)——断言均被各自窗口完全支撑。修错员按引用铁律加拆的 2 处（[119]、[122] 多拆一条）合理合规。
4. **quality 逐字 diff**：Q0(:23)、Q1(:36)、Q2(:199)、Q3(:49)、Q4(:595) 的 evidence 与源码**字节完全一致**（含原始缩进，已恢复）。
5. **4 条高危（UnsafeModelSsl）证据真实有效**：`checkServerTrusted` 空实现（UnsafeModelSsl.kt:23–26）、`hostnameVerifier { _, _ -> true }`（:36）、`SharedHttpClient.instance` 被包裹（AIServiceFactory.kt:199）、`ModelListFetcher` 私有客户端被包裹（ModelListFetcher.kt:49）。无虚构、无夸大。

**Q2 行号争议的最终结论**：修错员是对的。`UnsafeModelSsl.apply(` 在 `AIServiceFactory.kt` **第 199 行**；第 198 行是 `val instance: OkHttpClient by lazy {`。原 critic 建议的 `:198` 错了 1 行。quality.json 的 `line: 199` 正确，证据块从 199 行起与源码逐字一致，无需再改。

本页已达收货标准，可关闭复检。facts 159 条 / quality 5 条。
