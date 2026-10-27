# Critic 复核报告：api-chat-opencode（OpenCode 供应商）

- 复核人：独立 critic（与 writer 无关）
- 复核时间：2026-10-01
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验证 `git rev-parse`）
- 复核范围：`review/batch-04/api-chat-opencode.{facts,quality,md,status}.json/md`

## 结论：退回修正（5 条 facts 引用窗口越界）

## 1. facts.json（57 条）

**通过 52 条，问题 5 条**。全部 57 条引用格式有效、行号在 1..434 范围内。5 条问题均为"断言超出 ±5 行支撑窗口"（SCHEMA §2 引用铁律）：

### [1] ref line 92
- 断言："OpenCodeProvider 构造函数私有，实例只能经 companion object 的 create 方法构建"
- 窗口 87–97 只覆盖 `companion object {`（87）与 `fun create(`（88），**看不到 `private constructor` 声明（在 23 行）**。
- 修法：拆成两条——"构造函数私有"锚定 23 行；"只能经 create 构建"保留当前锚点。

### [37] ref line 207
- 断言："OpenCodeChatProvider 继承 OpenAIProvider，providerType 为 OPENAI_GENERIC"
- 窗口 202–212 只到构造函数参数中段，**看不到 `) : OpenAIProvider(`（约 218 行）与 `providerType = ApiProviderType.OPENAI_GENERIC`（约 224 行）**。
- 修法：拆成两条——类声明锚定 207；"继承 OpenAIProvider 且 providerType 为 OPENAI_GENERIC"锚定到 providerType 所在行。

### [44] ref line 297
- 断言："OpenCodeResponsesProvider 继承 OpenAIProvider，providerType 为 OPENAI_GENERIC，且 useResponsesApi = true"
- 窗口 292–302 **看不到 providerType（约 311 行）与 `useResponsesApi = true`（319 行）**。
- 修法：拆成两条——类声明锚定 297；providerType + useResponsesApi 锚定到 311/319 行附近。

### [47] ref line 347
- 断言："OpenCodeClaudeProvider 继承 ClaudeProvider，providerType 为 ANTHROPIC_GENERIC，thinkingConfigurations 固定为 "[]""
- 窗口 342–352 **看不到 `thinkingConfigurations = "[]"`（362 行）**；继承与 providerType 部分在窗口内（351–360 含 `: ClaudeProvider(` 与 providerType）。
- 修法："thinkingConfigurations 固定为 []"单独成条，锚定 362 行。

### [51] ref line 398
- 断言："OpenCodeGeminiProvider 继承 GeminiProvider，providerType 为 GEMINI_GENERIC，thinkingConfigurations 固定为 "[]""
- 窗口 393–403 **看不到 providerType（约 417 行）与 thinkingConfigurations（约 424 行）**。
- 修法：拆成两条——类声明锚定 398；providerType + thinkingConfigurations 锚定到对应行。

### 次要措辞问题（不阻塞，建议顺手改）
- [2]："把 providerModel 身份透传给 delegate"——方向表述略反，实际是 `override val providerModel = delegate.providerModel`（从 delegate 读取并对外暴露）。代码引用逐字正确，机制描述（"让共享的响应处理识别 Responses/Gemini 流"）与源码注释一致，建议改为"把 delegate 的 providerModel 身份透传出来"。

## 2. quality.json（5 条）

**5/5 通过**：
- 每条 `evidence` 均与源码逐字一致（已做子串 diff 验证）。
- #1 "catalogProviderId 死代码"：已用 `rg catalogProviderId` 全仓验证，除自身定义（189 行）外确无调用方。severity suggestion / confidence high 合理。
- #2 OBJECT 解析失败跳过：代码确为 `runCatching` + `AppLogger.w` 后跳过，warning/high 合理（用户参数静默缺失）。
- #3 `protocolFor` 抛 IllegalArgumentException：`create()`（99–101 行）确无 try/catch，warning/medium 合理。
- #4 硬编码前缀表：数出 17 个前缀（big-pickle/deepseek-/glm-/hy3/hy4-/kimi-/ling-/longcat-/mimo-/nemotron-/omen-/qwen3-coder/ring-/north-/laguna-/trinity-/x-preview-），与"约 17 个"一致，suggestion/medium 合理。
- #5 Gemini URL 未编码拼接：`requestUrl = base + "/models/" + opencodeModelName + ":" + method + suffix`（424 行）确无编码，且 `protocolFor` 用 `substringAfterLast('/')` 说明模型名可含 `/`，warning/medium 合理。

## 3. 正文 api-chat-opencode.md

**通过**：符合 SCHEMA §9 双受众结构——概述 / `## AI 速览`（核心符号清单+职责一句话）/ 核心机制（9 个编号小节）/ 关键符号表 / 调用链（输入→处理→输出三段式编号，引用精确到行）/ 来源（类行号区间 23–137/139–204/206–294/296–344/346–395/397–434 与实际一致）。符号名保留英文原文，术语首现有解释，人话短句。frontmatter 齐全。

## 4. status.json

**通过**：`{id: "api-chat-opencode", title: "OpenCode 供应商", issue: 34, status: "review-pending", source_repo: "Operit", source_commit: "dbf71916fae9750cfdc9f9a774f5a0fee56633fb", critic: ""}` 全部正确。

## 5. lint

**通过**：独立重跑 `scripts/lint.py --src ~/workspace/Operit --dir <单页隔离目录>`，硬失败 0 / 警告 0。

## 待修清单（writer 修复后需复检）

1. facts [1] 拆分/重锚（private constructor → 23 行）
2. facts [37] 拆分/重锚（providerType → 约 224 行）
3. facts [44] 拆分/重锚（providerType/useResponsesApi → 约 311/319 行）
4. facts [47] 拆分/重锚（thinkingConfigurations → 362 行）
5. facts [51] 拆分/重锚（providerType/thinkingConfigurations → 约 417/424 行）
6. （可选）facts [2] 措辞微调
