# Critic 复核报告：api-chat-mimo（小米 Mimo 供应商）

- 复核人：独立 critic（与 writer 无关）
- 源码版本：Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 复核时间：2026-10-01

## 结论：退回修正（2 处：1 处引用行号错位 + 1 处括号说明超出引用窗口）

## facts 核验（5/7 通过，2 条需修）

| # | ref | 结果 |
|---|-----|------|
| 0 | MimoProvider.kt:8 | 通过：KDoc 原文 "Xiaomi MiMo provider…Reuses KimiProvider's reasoning_content-compatible behavior so thinking content can round-trip…" |
| 1 | MimoProvider.kt:25 | 通过：`) : KimiProvider(`，继承 KimiProvider |
| 2 | MimoProvider.kt:18 | 通过：`providerType: ApiProviderType = ApiProviderType.MIMO` 构造参数带缺省 |
| 3 | MimoProvider.kt:20 | 通过：四个能力开关缺省 false 在 19–22 行，窗口内可见 |
| 4 | MimoProvider.kt:23 | 通过：thinking 两参数缺省空串 |
| 5 | MimoProvider.kt:39 | **退回**：见下 |
| 6 | OpenAIProvider.kt:235 | **退回**（轻微）：见下 |

**fact 5 问题**："重写 applyAuthenticationHeaders：先调 super，再在 currentApiKey 非空时追加 api-key 请求头"，ref=:39。
- :39±5 窗口是 34–44 行：能看到方法签名（39）、`super.applyAuthenticationHeaders(builder, currentApiKey)`（43）、`if (currentApiKey.isNotEmpty()) {`（44）。
- 但"追加 api-key 请求头"的关键行 `builder.addHeader("api-key", currentApiKey)` 在 **45 行**，落在窗口之外（39+5=44）。断言为真（已实测源码 39–48 行），但引用错位。
- **修正建议**：ref 改为 `:44`（窗口 39–49，同时覆盖方法签名、super 调用、isNotEmpty 判断、addHeader 三行）。

**fact 6 问题**："父链默认鉴权逻辑是 key 非空时加 Authorization: Bearer 头（KimiProvider 未覆盖该方法）"，ref=`OpenAIProvider.kt:235`。
- Bearer 断言：235±5 窗口（230–240）内可见 `protected open fun applyAuthenticationHeaders`（235）、`if (currentApiKey.isNotEmpty())`（239）、`builder.addHeader("Authorization", "Bearer $currentApiKey")`（240）——成立。
- 括号内"KimiProvider 未覆盖该方法"：我用 grep 全仓库核实为真（只有 OpenAIProvider.kt:235 定义、:1838 调用，KimiProvider.kt 无此符号），但它是一个"缺席"断言，无法被 :235±5 窗口支撑。
- **修正建议**：删掉括号说明（Bearer 断言本身已足够），或把该信息移到正文"核心机制"段并注明是 grep 全仓库核实的结论。

## quality 核验（1/1 通过）

- 唯一 1 条（suggestion，confidence medium）：密钥同时经 `Authorization: Bearer` 和 `api-key` 两个头发送，若服务端只认 api-key 则 Bearer 是多余传输面。evidence 为 43–46 行源码逐字复制（已 diff 比对完全一致），severity/confidence 合理，描述有条件限定（"若…则"），无虚构。

## 正文核验（基本通过）

- §9 双受众结构完整：概述 / ## AI 速览 / 核心机制 / 关键符号 / 调用链三段式 / 来源；人话短句。
- 正文引用行号抽查全部有效：:8/:25/:39/:43（super 调用）/:45（addHeader）/:18/:20/:23/OpenAIProvider.kt:235。
- 无走查内容混入正文（§8 合规）。

## status.json（正确）

id=api-chat-mimo，issue=43，status=review-pending，source_repo=Operit，source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb，critic 留空。

## lint（0 硬失败 / 0 警告，据 writer 自报 .lint.md）

## 待办

1. fact 5 的 ref 由 :39 改为 :44。
2. fact 6 删掉括号内缺席断言（或移到正文并注明核实方式）。
改完后我方可直接复验行号通过，无需重走全文复核。
