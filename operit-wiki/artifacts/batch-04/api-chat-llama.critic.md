# Critic 复核报告：api-chat-llama（Llama 端侧供应商·已停止维护）

- 复核人：独立 critic（与 writer 无关）
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 日期：2026-10-01

## 结论：退回修正（引用行号错位，无事实性错误）

46 条 facts 的断言全部真实，无虚构、无复合事实、无符号笔误；但 **3 条引用行号与断言错位**——断言为真，但部分支撑代码落在所引行号 ±5 窗口之外。按对照表修正后即可通过，无需重走全文复核。

## 引用错位对照表（现引用 → 建议引用）

| # | 现引用 | 建议引用 | 问题说明 |
|---|--------|----------|----------|
| fact 23 | LlamaProvider.kt:230 | **:234** | 断言含"top_p 默认 1.0f、top_k 默认 0"。现窗口 225–235 只覆盖 top_p 的 `?: 1.0f`（:233）；top_k 的 `?: 0` 在 :237，窗外 2 行。:234 的窗口 229–239 同时覆盖两者 |
| fact 38 | LlamaProvider.kt:343 | **:345** 或 **:347** | 断言"先调 onNonFatalError 再抛 IOException"。现窗口 338–348 只覆盖 onNonFatalError 调用（:347）；`throw IOException` 在 :349，窗外 1 行 |
| fact 40 | LlamaProvider.kt:365 | **:372** | 断言覆盖 SYSTEM→system、USER/SUMMARY/TOOL_RESULT→user、ASSISTANT/TOOL_CALL→assistant 三组映射。现窗口 360–370 只覆盖第一组；后两组在 :371–375，全部窗外。:372 的窗口 367–377 覆盖全部三组 |

## quality.json：5/5 通过

每条 evidence 均与源码逐字一致且落在标注行 ±5 窗口内；severity/confidence 合理：
- warning 3（逐 token runBlocking 阻塞、max_tokens 用 name 而他处用 id 匹配不一致、完整 prompt 打 debug 日志）
- suggestion 2（calculateInputTokens 写死 preserveThinkInHistory=false、异常吞掉返回 0L）

## 正文：通过

- §9 双受众结构完整：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制 / 关键符号 / 调用链三段式 / 来源。
- 开头有"已停止维护"醒目标注，标题同步标注，符合大纲决策。
- 术语首现均有解释（GGUF、JNI 封装等），符号名保留英文原文，来源引用精确到行。
- 无评审过程用语残留，无走查内容进正文。

## status.json：正确

id=api-chat-llama，issue=35，status=review-pending，source_repo=Operit，source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb。

## lint / 已读：0/0；seed 单文件已登记 complete

## 待办

writer 按上表修正 3 处引用行号，逐条复验新窗口完全支撑断言，更新 lint 后即视为通过。
