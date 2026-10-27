# Critic 复核报告：api-chat-params（统一参数模型与自定义参数）

- 复核时间：2026-10-01
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验证 `git rev-parse HEAD` 一致）
- 结论：**退回修正**（4 处 facts ref 行号微调 + status 2 处格式偏差；无事实错误）

## facts.json（44 条）

44 条断言**全部为真**（逐条窗口核对）。4 条 ref 的 ±5 窗口没包住断言列举的全部条目，列为轻微问题：

| # | 当前 ref | 问题 | 建议 ref |
|---|---|---|---|
| [0] | ChatConfigReadiness.kt:11 | 断言枚举 7 种 issue，窗口 6–16 只露 5 个（API_KEY_MISSING/API_KEY_INVALID 在 17–18 行） | :13（窗口 8–18，7 个全露） |
| [2] | ChatConfigReadiness.kt:27 | 断言 6 种免 Key 渠道，窗口 22–32 只露 4 个（GEMINI_GENERIC/OTHER 在 33–34 行） | :30 |
| [23] | ModelConfigConnectionTester.kt:42 | 断言 report 字段清单，窗口 37–47 未露 testedModelName（48 行）与 items（49 行） | :45 |
| [25] | ModelConfigConnectionTester.kt:69 | 断言 4 轮探针话术，窗口 64–74 只露 system/user 两轮（assistant/tool_result 在 75–78 行） | :74（窗口 69–79，四轮全露） |

其余 40 条 ref 精确命中。重点核对过的易错点：

- [8] MNN/LLAMA_CPP 短路在模型检查之后、endpoint 检查之前（65–67 行），"不检查 endpoint 与 Key"表述准确。
- [11] 已登录 OPENAI_CODEX 跳过 Key 检查（74–76 行），与 [6] 的未登录分支顺序一致。
- [29] 探针三参数 `stream=false、enableRetry=false、recordTokenUsage=false`（111–113 行）逐字一致。
- [36] IMAGE 探针 `matchesImage` 命中 PASSED / 否则 UNVERIFIED（196–200 行），与 Q2 的 quality finding 口径一致。

## quality.json（3 条）

逐字 diff 验证 evidence，**3 条全部通过**：

- Q0（line 138，CHAT 探针不校验回复内容，warning/correctness/medium）：evidence（137–140 行）逐字一致；`collectResponse(...)` 返回值被丢弃后无条件 PASSED 实锤，通过。
- Q1（line 182，图片注册失败缓存文件泄漏，warning/correctness/high）：evidence（180–183 行）逐字一致；`addImage` 返回 "error" 时 `throw` 在 `try/finally`（202–203 行删除逻辑）之前，泄漏实锤；AUDIO（212–214 行）、VIDEO（243–245 行）确为同样写法，通过。
- Q2（line 52，UNVERIFIED 被计入 success，warning/correctness/medium）：evidence（51–55 行）逐字一致；`success = items.none { FAILED }` 与 `verified` 并存，语义歧义成立，通过。

## 正文 api-chat-params.md

- §9 双受众结构齐全：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制（就绪判定/连接测试两节）/ 关键符号（英文原文+行级引用）/ 调用链（输入→处理→输出编号三段式×2 条链）/ 来源。
- 术语首现解释："发请求前的检查与试探"✓；符号名英文原文✓。
- 正文引用抽查（`:35`→evaluate 在 37 行窗口内、`:95`→createService、`:111`→stream=false、`:118`→runCase 精确、`:269`、`:274`、`:286`）均有效；通过。

## .status.json

- id `api-chat-params` ✓ / status `review-pending` ✓ / source_commit ✓
- **2 处轻微偏差**：`issue` 为字符串 `"#50"`（全批其余为整数 `50`）；`source_repo` 为 `"Operit"`（应为小写 `"operit"`）。建议一并修正。

## lint

0 硬失败 / 0 警告。

## 退回修正清单

1. facts 4 处 ref 行号微调（见上表）。
2. status：`"issue": "#50"` → `50`；`"source_repo": "Operit"` → `"operit"`。
