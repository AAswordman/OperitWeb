# Critic 复核报告：api-chat-thinking（thinking 配置机制）

- 复核时间：2026-10-01
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验证 `git rev-parse HEAD` 一致）
- 结论：**退回修正**（12 处 facts ref 行号微调 + status 2 处格式偏差；**无事实错误**——上一任 writer 虚构符号的问题已彻底解决）

## 符号真实性专项核查（本页重点）

writer 曾自曝上一任完全写错符号。本轮对本页涉及的全部符号在钉住版本中逐个实测，**全部真实存在**，无一虚构：

| 符号 | 源码位置 | 实测 |
|---|---|---|
| `ThinkingQualityControl` | ThinkingQualityMapping.kt:12 | enum LEVELS/TOGGLE_ONLY/UNSUPPORTED ✓ |
| `ThinkingQualityWireValue` | :14 | sealed interface，Text/Number/Omitted ✓ |
| `ThinkingQualityOption` | :20 | data class，id/displayLabel/wireValue/actions ✓ |
| `ThinkingQualityJsonAction` | :27 | path/value/overwrite ✓ |
| `ThinkingQualityMapping` | :33 | 含 companion.toggleOnly/unsupported ✓ |
| `ThinkingQualityMappingRegistry` | :54 | object，resolve×3 重载/resolveForModel/validateConfigurations/formatConfigurations ✓ |
| `ThinkingConfigurationRule` | :128 | private data class ✓ |
| `ThinkingModelMatcher` | :212 | private data class，8 种匹配条件 ✓ |
| `ThinkingConfigurationApplier` | :265 | object，apply×2 重载/modelParameters/applyAction ✓ |
| `hasJsonPath`/`putJsonPath`/`cloneJsonValue`/`toModelParameters` | :430/:442/:458/:466 | 私有扩展函数全部存在 ✓ |
| `thinkingString/Int/Float/Boolean/ObjectParameter` | :498–:570 | 五个构造器全部存在，id 均为 `thinking-$apiName` ✓ |

另实测 `applyThinkingParams`/`ThinkingQuality` 五档等上一任虚构符号在钉住版本中零命中，确认已清除。

## facts.json（64 条）

64 条断言**全部为真**（逐条窗口核对，无一事实错误）。12 条 ref 的 ±5 窗口没包住断言的关键行（断言真、行号指向正确区域但偏了几行），按铁律列为轻微问题，建议如下微调：

| # | 当前 ref | 问题 | 建议 ref |
|---|---|---|---|
| [9] | :55 | 断言"2/3/4 参三个重载"，窗口 50–60 只露出 2 参与 3 参开头，4 参在 65 行 | :60（窗口 55–65，三重载全露） |
| [33] | :212 | 断言"8 种匹配条件"，窗口 207–217 只露 5 个字段名（lastSegment* 在 218–220） | :216 |
| [38] | :266 | 断言"Context 重载直接转调"，窗口 261–271 只有签名，转调在 277–285 | :279 |
| [39] | :288 | 断言"返回 ThinkingQualityMapping"，窗口 283–293 未露返回类型（296 行）与 `return mapping`（314 行） | :312 |
| [45] | :317 | 断言"先 apply 再转 ModelParameter"，窗口 312–322 未露函数体（325–336） | :328 |
| [50] | :362 | 断言"overwrite 取选项的 overwrite"，该行在 368 行，窗口止于 367 | :365 |
| [53] | :389 | 断言"其他为空"，`else -> emptyList()` 在 398 行 | :394 |
| [55] | :412 | 断言"字符串包单个"，该分支在 420 行 | :417 |
| [58] | :442 | 断言"中间段按需建 JSONObject；叶子 cloneJsonValue"，关键行在 447–455 | :449 |
| [60] | :466 | 断言"thinkingConfig 归 GENERATION"，分类逻辑在 472–477 | :473 |
| [61] | :477 | 断言"整数→INT、小数→FLOAT"，分支在 482–487 | :481 |
| [63] | :498 | 断言"id/isEnabled/isCustom"，构造体在 503–513 | :505 |

其余 52 条 ref 精确命中。

## quality.json（4 条）

逐字 diff 验证 evidence，**4 条全部通过**：

- Q0（line 197，control 拼写错误静默降级 UNSUPPORTED，suggestion/robustness/high）：evidence（194–197 行）逐字一致；`else -> UNSUPPORTED` 实锤，通过。
- Q1（line 233，模型正则每次匹配重编，suggestion/performance/high）：evidence（230–234 行）逐字一致；`Regex(it, IGNORE_CASE)` 在 `matches()` 内确系每次调用新建，通过。
- Q2（line 450，putJsonPath 中间路径被占用静默丢弃，suggestion/correctness/high）：evidence（447–452 行）逐字一致；`current.has(segment) && !overwrite -> return` 实锤（与 applyAction 的整路径预检是不同分支，finding 有效），通过。
- Q3（line 359，Number 小数被 toInt 截断，suggestion/correctness/medium）：evidence（357–360 行）逐字一致，通过。

## 正文 api-chat-thinking.md

- §9 双受众结构齐全：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制（6 小节）/ 关键符号（英文原文+行级引用）/ 调用链（输入→处理→输出编号三段式）/ 来源。
- 术语首现解释："思考"（reasoning/thinking）、LEVELS（如 low/medium/high）✓；符号名英文原文✓。
- 正文两处表述已用调用方实测验证为真：`validateConfigurations` 确在 `ModelConfigScreen.kt:1118` 的 `persistConfiguration` 中做保存前校验；`rulesArray` 的"含 rules 数组的对象"分支确为 `optJSONArray("rules")`。通过。

## .status.json

- id `api-chat-thinking` ✓ / status `review-pending` ✓ / source_commit ✓
- **2 处轻微偏差**：`issue` 为字符串 `"#49"`（全批其余为整数 `49`）；`source_repo` 为 `"Operit"`（应为小写 `"operit"`）。建议一并修正。

## lint

0 硬失败 / 0 警告。

## 退回修正清单

1. facts 12 处 ref 行号微调（见上表）。
2. status：`"issue": "#49"` → `49`；`"source_repo": "Operit"` → `"operit"`。
