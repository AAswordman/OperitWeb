# Critic 复核报告：api-chat-nvidia（NVIDIA AI 供应商）

- 复核对象：`review/batch-04/api-chat-nvidia.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse HEAD` 一致）
- 复核方式：15 条 facts 逐条取 ref ±5 行窗口与源码比对；1 条 quality evidence 逐字 diff；正文结构与 status 人工检查
- **结论：退回修正（3 条 facts 引用错位 + 2 处"缺席"断言需删减，无事实性错误）**

## 总览

| 项 | 结果 |
|---|---|
| facts 15 条 | 12 通过 / **3 条引用错位**（[3][10][11]，断言全部为真） |
| quality 1 条 | **通过**，evidence 逐字一致、行号准确，severity/confidence 合理 |
| 正文 .md | §9 结构完整；**2 处与 facts 相同的弱引用需同步修正**（见下） |
| .status.json | 通过（id / issue 40 / review-pending / source_repo=operit / source_commit 正确） |
| lint | 0 硬失败 / 0 警告 |

## 必须修正

| # | 现 ref | 断言摘要 | 问题 | 建议 |
|---|---|---|---|---|
| 3 | `NvidiaAIProvider.kt:20` | "NvidiaAIProvider 继承自 OpenAIProvider" | 继承声明 `) : OpenAIProvider(` 在 **33 行**，窗口 15–25 盖不住 | ref 改为 **:33** |
| 10 | `ThinkingQualityMapping.kt:266` | "apply 存在带 context 参数的重载，**其内部直接委托给无 context 的重载**" | 复合事实：重载签名在 266–268 ✓，但委托调用在 **277–285 行**，窗口 261–271 盖不住 | 拆两条：(a)"存在带 context 参数的重载" ref :266（或 :267）；(b)"内部直接委托给无 context 重载" ref **:280**（窗口 275–285 完整覆盖 277–285 的委托调用） |
| 11 | `NvidiaAIProvider.kt:79` | "传入的 providerTypeId 硬编码为 `ApiProviderType.NVIDIA.name`，而非构造参数 providerType" | 该行在 **71 行**，窗口 74–84 盖不住 | ref 改为 **:71**（窗口 66–76 覆盖 68–76） |

## 必须删减的"缺席"断言（事实为真，但 ±5 窗口无法支撑缺席类断言）

- [7]（ref :49）"类中只重写了 `createRequestBody` 一个方法，**未重写 `buildInputAudioPayload` 与 `sendMessage`**"：经全文件 grep 核实确实只有 1 处 `override fun`（49 行），断言为真。但"未重写 X/Y"是缺席断言，任何 ±5 窗口都证不了。建议改为"类中重写了 `createRequestBody`"（ref :49），删掉后半句。
- [13]（ref :79）"最终用 `createJsonRequestBody(jsonObject.toString())` 构造成 RequestBody 返回，**不做请求体日志**"：经 grep 核实全文件无任何日志调用，断言为真。同理建议删掉"不做请求体日志"尾巴（或移到正文用文件级说明表述）。

## 正文需同步修正的 2 处

正文 .md 存在与 facts 相同的弱引用（正文引用行号其余全部正确）：

1. "请求体组装"节："`context` 重载内部直接委托给无 `context` 的重载，行为完全一致"引用 `ThinkingQualityMapping.kt:266`——同 [10] 问题，改为引用 **:280**（或拆成两句各带引用）。
2. "请求体组装"节："类中只重写了 `createRequestBody` 一个方法，没有动音频载荷与消息发送"引用 `:49`——同 [7] 问题，建议删减"没有动…"后半句。

其余正文引用抽查全部正确：`:26`（providerType 默认）、`:71`（硬编码 providerTypeId——注意正文这里用的就是 :71，是对的）、`:73`（其余参数）、`:58`、`AIServiceFactory.kt:680`（窗口 675–685 覆盖 679–680）、`OpenAIProvider.kt:3207`（父类 sendMessage）、`ModelConfigData.kt:36`（NVIDIA 注释）。

## 通过部分

- 其余 12 条 facts 逐条实测通过，无虚构。`ModelConfigData.kt:36`、`ThinkingQualityMapping.kt` 相关引用有效。
- quality 1 条 suggestion（providerTypeId 硬编码与构造参数口径可能不一致）：evidence `providerTypeId = ApiProviderType.NVIDIA.name,` 与 71 行逐字一致（含 12 空格缩进），line 字段准确；定性为 suggestion/medium 恰当（与 Qwen 的 `qwenProviderType.name` 做法对比成立）。
- 正文 §9 结构完整：概述（含 NIM/请求映射器术语解释）/ ## AI 速览 / 核心机制 / 关键符号表 / 调用链三段式 / 来源。符号英文原文，人话短句。
- status.json 全对。

## 给修错员的要求

1. 按上表修正 [3][10][11]（[10] 拆成两条），删减 [7][13] 的缺席尾巴；正文 2 处同步修正。
2. 每条用 sed 复验 ±5 窗口完全支撑。
3. 重跑 `scripts/lint.py` 保持 0/0。无需重走全文复核。

## 复检（2026-10-01T13:58 CST，修错后复验）

**结论：通过**。退回的 5 项 + 正文 2 处全部修正并独立验真。

- **[3]**：ref 已改为 :33，窗口 28–38 覆盖 `) : OpenAIProvider(`（33）——"继承自 OpenAIProvider"完全被支撑 ✓。
- **[10] 拆分**：(a)"存在带 context 参数的重载" ref :266，窗口 261–271 覆盖 `fun apply(`（266）与 `context: Context,`（267）✓；(b)"内部直接委托给无 context 的重载" ref :280，窗口 275–285 完整覆盖 277–285 的内部 `apply(...)` 委托调用（未传 context 参数）✓。
- **[11]**：ref 已改为 :71，窗口 66–76 覆盖 `providerTypeId = ApiProviderType.NVIDIA.name,`（71）——硬编码断言完全被支撑 ✓。
- **[7]**：删减后断言"类中重写了 `createRequestBody`"（ref :49，窗口 44–54 覆盖 49 行 `override fun`）准确，无缺席尾巴 ✓。
- **[13]**：删减后断言"最终用 `createJsonRequestBody(jsonObject.toString())` 构造成 RequestBody 返回"（ref :79，窗口 74–84 覆盖 79 行 return）准确，无缺席尾巴 ✓。
- **正文 2 处同步**：(1)"请求体组装"节已拆成两句——带 `context` 重载存在句引 :266、内部委托句引 :280 ✓；(2)"类中重写了 `createRequestBody`"引 :49，"没有动音频载荷与消息发送"尾巴已删 ✓。

**非阻塞注记**：正文关键符号表第 51 行仍写"全文件只重写 `createRequestBody`"——事实为真（grep 确认全文件仅 1 处 `override fun`），但"只/唯一"属缺席类表述。原 critic 未列入退回项，此处不阻塞；建议 parent 酌情改为"重写了 `createRequestBody`"。

未通过条目：无。本页已达收货标准。
