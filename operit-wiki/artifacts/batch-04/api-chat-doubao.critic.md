# Critic 复核报告：api-chat-doubao（豆包供应商）

- 复核人：独立 critic（与 writer 无关）
- 源码版本：Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 复核时间：2026-10-01

## 结论：退回修正（1 处轻微：复合断言后半段支撑不在引用窗口内）

## facts 核验（9/10 通过，1 条需修）

| # | ref | 结果 |
|---|-----|------|
| 0 | DoubaoAIProvider.kt:11 | 通过：KDoc 原文"针对豆包（Doubao）模型的特定API Provider…继承自OpenAIProvider…特别处理了`thinking`参数" |
| 1 | DoubaoAIProvider.kt:20 | 通过：`private val providerType: ApiProviderType = ApiProviderType.DOUBAO` 构造参数带缺省 |
| 2 | DoubaoAIProvider.kt:19 | 通过：`customHeaders` 缺省空 Map |
| 3 | DoubaoAIProvider.kt:22 | 通过：四个能力开关缺省 false 在 21–24 行，窗口内可见 |
| 4 | DoubaoAIProvider.kt:25 | 通过：thinking 两参数缺省空串 |
| 5 | DoubaoAIProvider.kt:33 | **退回**：见下 |
| 6 | DoubaoAIProvider.kt:45 | 通过：注释"按官方文档建议始终显式传入：enabled/disabled" |
| 7 | DoubaoAIProvider.kt:41 | 通过：`private val configuredApiEndpoint = apiEndpoint` |
| 8 | DoubaoAIProvider.kt:57 | 通过：`super.createRequestBodyInternal(...)` |
| 9 | DoubaoAIProvider.kt:60 | 通过：`ThinkingConfigurationApplier.apply(..., providerTypeId = providerType.name, ...)`（63 行在窗口内） |

**fact 5 问题**："构造时不传流式 usage 开关（缺省 false），与 XaiProvider 硬编码 true 不同"，ref=:33。
- "不传"：:33±5 窗口（28–38）展示了完整的父类构造参数列表，确实没有 `includeUsageInStream` 项——这部分支撑成立。
- "缺省 false"：该结论的依据是父类 `OpenAIProvider.kt:100` 的 `private val includeUsageInStream: Boolean = false`，落在引用窗口之外。断言为真（已实测验证），但引用窗口撑不起后半句，属复合事实。
- **修正建议**：拆成两条——①"构造时不传 includeUsageInStream（参数列表 28–38 无此项）"ref 保持 :33；②"父类 includeUsageInStream 缺省 false"ref 改为 `OpenAIProvider.kt:100`。

## quality 核验（1/1 通过）

- 唯一 1 条（suggestion）：`createRequestBody` 的 context 参数用全限定名 `android.content.Context`（48 行），与 XaiProvider 的 import 风格不一致。evidence 与源码逐字一致，描述准确，不影响行为的定性正确。

## 正文核验（基本通过，1 处同源小问题）

- §9 双受众结构完整：概述 / ## AI 速览 / 核心机制 / 关键符号 / 调用链三段式 / 来源；人话短句，thinking 首现给了解释。
- 正文"不强制流式 usage"一段（引用 :33）复述了 fact 5 的复合断言，建议同步按上述拆分修正。
- 其余引用行号抽查全部有效：:11/:45/:20/:63（`providerTypeId = providerType.name`）/:57/:60/:47（createRequestBody 定义）/:71（`return createJsonRequestBody(jsonObject.toString())`）。
- 无走查内容混入正文（§8 合规）。

## status.json（正确）

id=api-chat-doubao，issue=42，status=review-pending，source_repo=Operit，source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb，critic 留空。

## lint（0 硬失败 / 0 警告，据 writer 自报 .lint.md）

## 待办

按"修正建议"拆分 fact 5（facts.json + 正文对应段落），改完后我方可直接复验行号通过，无需重走全文复核。
