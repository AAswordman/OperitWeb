# Critic 复核报告：data-prefs-model（模型与 API 配置（偏好设置））

- 复核对象：`review/batch-05/data-prefs-model.{md,facts,quality,lint,status}.json/md`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：181 条 facts 全量行号存在性校验（文件存在、行号在范围内、无重复锚点）+ 关键词窗口支撑脚本 + 14 条 flagged 人工逐条核源码原文；quality 14 条 evidence 逐条验逐字原文；2 条高危追到调用方；正文结构/数字断言/禁用词全查；lint.py 独立隔离重跑

## 结论：打回修正

**facts：181 条中 177 条通过，4 条引用锚点错位必须修正。**
**quality：14 条证据内容全部真实，定级合理；1 条 evidence 格式轻微瑕疵（建议顺手修），1 条高危描述可补一句更精确。**
**正文 md：通过（结构齐全、无矛盾断言、数字断言已验真）。status.json：正确。lint：独立重跑 0 硬失败 / 0 警告。**

### 硬问题（必须修）：4 处 facts 引用窗口违规

1. **[67]** `ModelConfigManager.kt:1089` → 正确锚点 **:1105 或 :1106**
   断言"自定义参数解析失败时只记日志 AppLogger.e，不抛异常"为真（`catch (e: Exception)` 在 1105，`AppLogger.e("ModelConfigManager", "Failed to parse or convert custom parameters", e)` 在 1106，catch 吞掉无重抛），但 ref :1089 的 ±5 窗口（1084–1094）内完全没有 AppLogger.e。锚点偏离 17 行。
2. **[133]** `ModelConfigManager.kt:1166` → 正确锚点 **:1174**
   断言"importConfigs 导入失败时记日志并抛出带 model_config_import_failed 文案的异常"为真（`catch` 在 1174，`AppLogger.e(..., "导入配置失败", e)` + `throw Exception(context.getString(R.string.model_config_import_failed, ...))` 在 1175–1176），但 ref :1166 的窗口（1161–1171）不含 catch。锚点偏离 8 行。
3. **[148]** `CodexAuthPreferences.kt:131` → 正确锚点 **:119 或 :120**
   断言"CodexAuthPreferences.getInstance 是双重检查单例"为真（`instance ?: synchronized(this) { instance ?: CodexAuthPreferences(...)... }` 在 119–122），但 ref :131 落在 `createPreferences` 尾部的 `}` 上，与 getInstance 相距 10+ 行。
4. **[168]** `FreeUsagePreferences.kt:44` → 正确锚点 **:62 或 :68**
   断言"不一致时取外部与本地使用次数的最大值恢复"为真（`maxOf(extTotalUsage, currentTotalUsage)` 在 68，哈希比对分支在 62），但 ref :44 是 `getNextAvailableDate` 尾部，偏离 24 行。

### 轻微问题 / 建议（不阻塞，但建议顺手修）

1. **[83]** `:97`：迁移 v0 的核心行为（`configList.isNotEmpty() return`、空时 `createFreshDefaultConfig`）在 103–109，建议锚点移至 :103。
2. **[84]** `:147`：迁移 v1 按供应商补内置规则（`thinkingRulesForProvider`）与首个档位（`firstThinkingOptionIdForModel`）在 157–166，建议锚点移至 :157。
3. **[85]** `:182`：迁移 v2 的核心逻辑（`migrateOpenAiChatThinkingConfigurations` 调用、注释"Version 2 stored OpenAI Chat's built-in reasoning rule as model-agnostic"）在 195–205，建议锚点移至 :195。
4. **[86]** `:293`：DeepSeek 过滤（`isDeepSeekProvider`）与 `addDeepSeekResponsesThinkingRule` 在 305+，建议锚点移至 :305。
5. **[166]** `:93`：`getExternalVerificationFile` 的路径组合逻辑在窗口内，但字面量 `"usage_verification.dat"` / `"Operit"` 在 :22–23，建议补充引用 :22 或在事实中注明常量位置。
6. **Q1 描述精度**："函数本身无任何脱敏或二次确认"——调用方 `ChatBackupSettingsScreen.kt:652–658` 确实把 `exportAllConfigs()` 结果直接 `writeText` 进 `model_config_backup_<timestamp>.json`（明文 Key 落文件实锤），但导出后会弹安全警告对话框（`showModelConfigExportWarning = true`）。建议补一句"调用方仅在导出完成后弹安全警告，无导出前确认"，描述更精确。高危定级维持。
7. **Q13 evidence 格式**：evidence 存的是字面 `\n` 转义序列（JSON 内反斜杠-n）而非真实换行，内容与 `EnvPreferences.kt:56–58` 的 `getAllEnv` 一致、断言成立（`v as? String` 静默丢弃非字符串），但非严格逐字原文；建议改用真实换行或单行证据。
8. **"停止维护"标注（[69][70][100]–[104]）**：ref 窗口仅支撑符号身份（`MNN`/`LLAMA_CPP` 枚举项、llama/mnn 参数字段），"停止维护"来自项目定稿约定（mnn/llama/mmd 端侧推理引擎已久未维护），属 SCHEMA §8 要求的强制标注，非虚构——通过，备注其来源为项目约定而非代码注释。

### 通过项明细

- **行号验真**：181/181 引用文件存在且行号在范围内、无越界、无重复锚点。
- **原子化**：脚本筛出 4 条嫌疑（[46][78][79][167]），人工确认均为原子：[46][78][79] 是同一函数的条件行为描述；[167] 的 `|` 是字面拼接符（`"$totalUsage|$nextDate"`）。
- **quality evidence**：14/14 在源码中找到原文（Q0–Q12 窗口命中；Q13 内容一致、格式见上建议）。
- **高危复核**：Q0（Key 明文 JSON 落盘 `preferences[configKey] = json.encodeToString(config)`，`ModelConfigData` 确含 `apiKey`/`apiKeyPool`，同目录 Codex 凭据确用 `EncryptedSharedPreferences`）真实，high 合理。Q1（`exportAllConfigs` 返回全量明文 JSON，调用方确写入备份文件）真实，high 合理。
- **正文**：概述 / ## AI 速览 / 核心机制 / 关键符号 / 输入→处理→输出调用链 / 来源齐全；符号名英文原名；数字断言已验真（`ApiProviderType` 38 个枚举值、`StandardModelParameters` 7 个标准参数）；正文"导出明文 Key"与 Q1 一致，无矛盾。
- **lint**：critic 独立隔离重跑 `scripts/lint.py`：0 硬失败 / 0 警告（与 .lint.md 一致）。
- **status.json**：`issue: 65`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，refs_valid 格式正确。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"零命中。

### 打回清单（writer 需改）

| # | 位置 | 改法 |
|---|------|------|
| 1 | facts[67] ref | `ModelConfigManager.kt:1089` → `:1105`（或 :1106） |
| 2 | facts[133] ref | `ModelConfigManager.kt:1166` → `:1174` |
| 3 | facts[148] ref | `CodexAuthPreferences.kt:131` → `:119` |
| 4 | facts[168] ref | `FreeUsagePreferences.kt:44` → `:62`（或 :68） |
| 5 | quality Q13 evidence（建议） | 把字面 `\n` 换成真实换行或改为单行证据 |
| 6 | quality Q1 description（建议） | 补"调用方仅在导出后弹安全警告"一句 |
| 7 | facts[83][84][85][86][166]（建议） | 锚点下移至关键行为行（见上） |

修完后请 parent 派独立 critic（非本次）复验 4 处硬问题锚点；轻微项修不修不影响放行，但建议顺手。

---

## 复验（第二轮）——2026-10-01，结论：**通过**

复验方为与首轮 critic 完全独立的第二位 critic，未采信修错员自报，对每项修正逐个重新核了源码（Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，`git rev-parse HEAD` 一致）。

### 4 处硬问题逐项复核（全部 ✅）

1. **facts[67]** ref `:1105`：窗口 1100–1110 内 `catch (e: Exception)` 在 1105、`AppLogger.e("ModelConfigManager", "Failed to parse or convert custom parameters", e)` 在 1106，catch 无重抛，断言"只记日志不抛异常"成立 ✅
2. **facts[133]** ref `:1174`：窗口 1169–1179 内 `catch` 在 1174、`AppLogger.e(..., "导入配置失败", e)` 在 1175、`throw Exception(context.getString(R.string.model_config_import_failed, ...))` 在 1176，断言成立 ✅
3. **facts[148]** ref `:119`：窗口 114–124 内 `getInstance` 在 118–122，`instance ?: synchronized(this) { instance ?: ... }` 双重检查成立 ✅
4. **facts[168]** ref `:63`（修错员偏离首轮建议 :62/:68）：窗口 58–68 内哈希比对 `actualHash != expectedHash` 在 61、`maxOf(extTotalUsage, currentTotalUsage)` 在 68，**两处支撑同时被覆盖**，:63 比 :62/:68 的任一单点都更优，偏离成立 ✅

### 3 处"有据偏离"复核（全部 ✅）

- **[84] :161**（偏离首轮建议 :157）：窗口 156–166 同时覆盖 `thinkingRulesForProvider(...)`（160）与 `firstThinkingOptionIdForModel(...)`（166）；若取 :157，窗口 152–162 会漏掉 166 行的第二处支撑。偏离成立 ✅
- **[85] :199**（偏离首轮建议 :195）：窗口 194–204 同时覆盖 `migrateOpenAiChatThinkingConfigurations(...)` 调用（196）与 "Version 2 stored OpenAI Chat's built-in reasoning rule as model-agnostic." 注释（204）；若取 :195，窗口 190–200 会漏掉注释。偏离成立 ✅
- **[168] :63**：见上 ✅

### 轻微建议逐项复核（全部 ✅）

- [83] `:103`：窗口 98–108 覆盖 `configList.isNotEmpty() return`（103）与 `createFreshDefaultConfig`（107）✅
- [86] `:305`：窗口 300–310 覆盖 `isDeepSeekProvider`（301）与 `addDeepSeekResponsesThinkingRule`（305）✅
- [166] `:93`：窗口 88–98 覆盖 `getExternalVerificationFile`（91），事实文本已注明常量 `EXTERNAL_DIRECTORY`/`EXTERNAL_VERIFY_FILENAME` 定义于 `:22-23`（已核实 22–23 行确实为两常量定义）✅
- **Q1 description 补充句**：已逐行核实 `ChatBackupSettingsScreen.kt:648–662`——652 行 `val jsonContent = modelConfigManager.exportAllConfigs()`，657 行 `exportFile.writeText(jsonContent)`，661 行 `showModelConfigExportWarning = true`（导出**后**弹警告）；`ModelConfigExportWarningDialog` 组合点在 1376 行。补充句"调用方仅在导出完成后弹安全警告对话框，无导出前二次确认"逐字属实 ✅
- **Q13（索引 13，EnvPreferences.getAllEnv）**：evidence 已为真实换行，与 `EnvPreferences.kt:56–58` 逐字一致（`return prefs.all.mapNotNull { (k, v) -> / val key = k.trim() / val value = v as? String`），line 字段为 56 ✅

### 全量复查

- **facts**：181/181 ref 程序化校验（文件存在、行号在界）全过；14 条随机抽样人工核 ±5 窗口全部支撑 ✅
- **quality**：2 条 high 的 evidence 逐字命中源码，定级不夸大；14 条全量与首轮一致无改动 ✅
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"零命中 ✅
- **status.json**：issue=65（整数）、review-pending、operit、`dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✅
- **lint**：单页隔离独立重跑（条目文件复制到 /tmp 独立目录，.lint.md 与报告输出文件排除在扫描外）：检查文件 2，**硬失败 0 / 警告 0** ✅

### 结论

**通过。** 修错员的 9 处重锚全部独立验真，3 处偏离均有据成立且优于首轮建议行号；轻微建议全部落实。本页评审闭环完成，可随整批上评审站。
