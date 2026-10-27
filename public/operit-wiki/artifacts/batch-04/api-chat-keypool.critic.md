# Critic 复核报告：api-chat-keypool（Key 池轮询）

- 复核时间：2026-10-01
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验证 `git rev-parse HEAD` 一致）
- 结论：**退回修正**（1 处 quality evidence 错位 + 1 处 facts ref 窗口 + status 2 处格式偏差；无事实错误）

## facts.json（42 条）

逐条用 `sed` 取 ref ±5 行窗口核对：41 条通过，1 条轻微问题。

- [0]–[16]（ApiKeyProvider.kt）：全部通过。接口声明、单 Key 兼容、mutex 临界区、可用性标记过滤、轮询取模、回退单 Key、下标持久化，断言与窗口逐字一致。
- [17]–[41]（ApiKeyPoolAvailabilityTester.kt）：40 条通过，1 条轻微问题：
  - **[17] ref `:28` 窗口不全**：断言列出 `ApiKeyPoolTestState` 7 个字段（totalToTest、tested、available、unavailable、running、paused、lastError），但 `:28` 的 ±5 窗口（23–33 行）只露出前 5 个字段名，`paused`（34 行）、`lastError`（35 行）在窗口外。断言本身为真（已实测 28–36 行）。**建议 ref 改为 `:31`**（窗口 26–36，7 字段全露）。

## quality.json（5 条）

逐字 diff 验证 evidence：4 条通过，1 条问题。

- Q0（line 26，日志打 Key 首尾 4 字符，warning/security/medium）：evidence 逐字一致，通过。
- Q1（line 88，持锁内持久化，warning/performance/medium）：evidence（87–88 行）逐字一致，通过。
- Q2（line 71，startOrResume 检查无同步，warning/correctness/medium）：evidence（70–71 行）逐字一致；`job = scope.launch` 在 104 行确无同步，通过。
- **Q3（line 184，"可用性测试恒用模型索引 0"，warning/correctness/medium）：evidence 与 finding 错位——退回**。evidence 块内容是 188 行的 `useMultipleApiKeys = false,`，而 finding 的核心证据是 184 行的 `val modelNameToTest = getModelByIndex(baseConfig.modelName, 0)`。finding 本身为真：已对照 `ModelConfigConnectionTester.kt:89`（`getValidModelIndex(config.modelName, requestedModelIndex)`）确认 keypool 测试器确系硬编码索引 0，问题真实存在。**修正：把 evidence 换成 184 行逐字文本**（`            val modelNameToTest = getModelByIndex(baseConfig.modelName, 0)`），line 保持 184。
- Q4（line 143，每测一 Key 全量持久化，suggestion/performance/medium）：evidence（143–147 行）逐字一致，通过。

## 正文 api-chat-keypool.md

- §9 双受众结构齐全：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制 / 关键符号（英文原文+职责+行级引用）/ 调用链（输入→处理→输出编号三段式×2 条链）/ 来源。
- 术语首现解释："轮询（round-robin）"✓；符号名均为英文原文✓。
- 正文引用抽查（`:130`、`:139`、`:148`、`:166`、`:178`）窗口均覆盖断言；通过。

## .status.json

- id `api-chat-keypool` ✓ / status `review-pending` ✓ / source_commit ✓
- **2 处轻微偏差**：`issue` 为字符串 `"#47"`（全批其余 35 页均为整数 `47`）；`source_repo` 为 `"Operit"`（全批 32 页为小写 `"operit"`，`check_staleness.py` 只认小写）。建议一并改成整数与小写。

## lint

0 硬失败 / 0 警告。

## 退回修正清单

1. quality Q3：evidence 替换为 184 行逐字文本。
2. facts [17]：ref `:28` → `:31`。
3. status：`"issue": "#47"` → `47`；`"source_repo": "Operit"` → `"operit"`。
