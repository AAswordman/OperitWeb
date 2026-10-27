# Critic 核验报告：core-config-prompts（系统提示词与功能提示配置，Issue #74）

- 核验日期：2026-10-01
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 HEAD 一致）
- 核验人：独立 critic（非 writer、非修错员）
- 结论：**打回修正**（4 项硬问题：引用锚点错位；断言本身全部为真，无虚构）

## 核验方法

- 73 条 facts：脚本全量校验文件存在/行号不越界（73/73 通过）；逐条导出 ref±5 窗口，人工逐条对照断言原文核验；数字断言（6 占位节、12 分类、146 工具、11 文件工具、8 步流程、100 词、180000ms、4 种 TagType 等）逐项数源码确认。
- quality 10 条：evidence 全部在源码中逐字检索命中（去缩进差异）；Q9"零调用方"用全仓库 grep 确认；6 条 warn 证据链逐条复核。
- 正文：结构、符号原名、与 facts 一致性抽查；禁用词/模糊词 5 文件全文 grep。
- status.json 字段核对；lint.py 独立隔离重跑。

## 硬问题（4 条，必须修）

全部为引用锚点错位，断言内容本身为真：

1. **facts[5]** ref `:280` → 应为 **`:285`**。
   事实文本还写了"（第 280-281 行）"，但 280-281 行是 `allowedMcpServerNames` / `hookMetadata` 参数声明，与断言无关。
   `packageSystemVisible` 的真实定义在 285-286 行：
   `val packageSystemVisible = toolExposureMode == ToolExposureMode.FULL && enableTools && (toolVisibility["use_package"] ?: true)`。
   建议 ref 改 `:285`，并把事实文本里的"（第 280-281 行）"同步改为"（第 285-286 行）"。

2. **facts[6]** ref `:340` → 应为 **`:305`**。
   三类来源的过滤逻辑（过滤已不存在的包、工具包容器 `isToolPkgContainer`、受 `allowedPackageNames` 白名单过滤）在 303-308 行：
   `val validEnabledPackages = enabledPackages.filter { packageName -> packageManager.getPackageTools(packageName) != null && !packageManager.isToolPkgContainer(packageName) && (allowedPackageNames?.contains(packageName) ?: true) }`。
   :340 只是 Skill 循环尾部，与断言无关。

3. **facts[7]** ref `:68` → 应为 **`:439`**。
   断言主干"清空 TOOL_USAGE_GUIDELINES_SECTION 与 AVAILABLE_TOOLS_SECTION"的真实代码在 439-441 行（`useToolCallApi` 分支）：
   `.replace("TOOL_USAGE_GUIDELINES_SECTION", "")` / `.replace("AVAILABLE_TOOLS_SECTION", "")`。
   :68 只有 `PACKAGE_SYSTEM_GUIDELINES_TOOL_CALL` 常量文本，±5 窗口不支持"清空"断言。

4. **facts[16]** ref `:648` → 应为 **`:665`**。
   默认角色名逻辑在 665 行：`val safeRoleName = groupOrchestrationRoleName.ifBlank { if (useEnglish) "assistant" else "助手" }`。
   :648 只是 `chatModelHasDirectImage = chatModelHasDirectImage` 参数传递行，完全错位。

## 轻微问题（锚点可优化，断言为真，不阻塞但建议顺手修）

以下 ref 的 ±5 窗口只覆盖函数签名/声明行，支撑原文在函数体内。按铁律建议把锚点移到支撑原文处：

- [3] `:223` → `:228` 或 `:230`（`BEGIN_SELF_INTRODUCTION_SECTION` 替换在 230 行）
- [9] 轻度复合："移除工具相关说明节"（else 分支 455-458）与"压缩换行"（467 行）挤在一条，后者与 [10] 重叠；建议删去后半句或拆分
- [11] `:529` → `:519`（`!workspacePath.isNullOrBlank()` 门控在 519 行）
- [13] `:573` → `:606`（三阶段 hook 名在 606/676/684 行）
- [15] `:235` → `:240`（提示内容在 240-247 行）
- [19] 复合：`SUMMARY_PROMPT_EN` 在 `:66`，不在 `:18` 窗口内；建议拆成两条或补第二个 ref
- [21] `:120` → `:129`（中文标题在 129 行）
- [23] `:166` 只覆盖 `resolveSummarySections`，另两函数在 `:183`/`:224`；建议注明
- [24] `:209` → `:217`（拼接上次摘要、末尾追加 globalRules 在 217-220 行）
- [31] `:483` → `:528`（优先级 `angry > cry > aojiao > shy > happy` 在 528 行）
- [33] `:585` → `:592`（"no more than 100 words" 在 595 行）
- [34] `:623` → 正文体（8 步流程与 `save_character_info` 在 626 行之后）
- [36] `:777` → 正文体（`do(action=...)` 指令集在 790-820 行，已逐项验真 Launch/Tap/Type/Type_Name/Interact/Swipe/Note/Call_API/Long Press/Double Tap/Take_over/Back/Home/Wait）
- [38] `:919` → 正文体（"Output strict JSON only" 等在 930 行之后）
- [39] `:42` → 分类组装处（如 `:497`；11 个文件工具已逐个验真：list_files/read_file/read_file_part/create_file/edit_file/delete_file/make_directory/find_files/grep_code/grep_context/download_file）
- [40] `:497` → `:564`（`+ internalToolCategoriesEn` 在 564 行）
- [41] `:506` → `:511`（`direct_image/direct_audio/direct_video` 恒过滤在 515-519 行）
- [46] `:829` → `:866`（选分类→排序→过滤→hook 上下文流水线在 866-868 行）
- [47] `:872` 只见 3 阶段中的第 1 个，另两阶段在 `:897`/`:908` 行；建议注明
- [58] `:2523` → `:2536`（namespace 参数 `optional, system/secure/global`、default `system` 在 2536-2541 行）
- [63] `:77` → `:36`（`PROMPT_TAG_LIST = "prompt_tag_list"` 定义在 36 行；键名格式在 77-82 行窗口内已支撑）
- [64] `:140` → `:146`（`UUID.randomUUID()` 在 146 行）
- [66] `:229` → `:234`（复用逻辑 `findTagWithSameContent` → 复用 id/否则创建在 234-239 行）
- [69] `:11` → `:15`（`key` 与 `defaultsByVersion` 定义在 15/20 行）
- [70] `:58` → `:62`（更新条件 `isUsingKnownDefault && (currentContent != latestContent || storedVersion != latestVersion)` 在 69-72 行）
- [71] `:43` → `:47`（先执行 `updater` 回调、再 `applyLatest` 在 50-53 行）

## 通过项

- **73 条 facts 断言全部为真**：逐条人工核源码原文，无虚构、无矛盾。数字断言逐项验真：6 个占位节（模板内齐全）、12 个内部工具分类（`categoryName` 逐个 grep，共 12 个英文名）、146 个工具（En/Cn 各 146 个 `ToolPrompt(`）、4 个 AI 可见分类、11 个文件工具、8 步角色卡流程、100 词上限、180000ms 超时、4 种 TagType、版本号从 1 开始编号。
- **quality 10 条 evidence 全部逐字命中源码**：Q1 `ignore_ssl`（:716）、Q2 隐藏终端（:98）、Q3 `delete_memory` 不可逆（:667）、Q4 `install_app`（:2570）、Q5 `execute_shell`（:17）、Q6 `execute_intent`（:518）、Q7 namespace 参数（:2540-2544）、Q8 `update_user_profile`（:696）均与源码逐字一致。Q9"PromptVersionManager 全仓库零调用方"已用全仓库 grep 确认（除自身文件外零引用），死代码定级成立。severity 分级合理：6 条 warn（ignore_ssl 关证书校验、隐藏终端执行、delete_memory 不可逆、中英确认口径差异、execute_shell 零护栏、任意 Intent）与 4 条 suggestion 均无夸大。
- **正文结构齐全**：概述 / AI 速览 / 核心机制（10 节）/ 关键符号 / 输入→处理→输出 / 来源；符号名均为英文原名；与 facts 无矛盾断言。
- **MNN / LLAMA_CPP"停止维护"已醒目标注**（正文 §8 末 + facts[59]），符合项目定稿要求。
- **PromptTagManager（正文 §9 + facts 61-67）、PromptVersionManager（正文 §10 + facts 69-72）均已覆盖**。
- 来源小节 6 文件行数（712/1352/1007/5992/243/93）与实测一致。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"均为 0 命中；模糊词（可能/大概/似乎/应该/也许）0 处。
- **status.json**：issue 为整数 74、status 为 review-pending、source_repo 为 operit、source_commit 为 `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，refs_valid "73/73" 与实际条数一致，critic 字段留空。
- **lint**：独立隔离重跑（仅本页 .md）0 硬失败 / 0 警告。

## 给修错员的清单

修 4 项硬问题（逐项行号见上），轻微项建议顺手修。修完后须由**独立 critic（非修错员）复验**，重点复核 4 个新 ref 的 ±5 支撑。

未修改任何被核验文件。

---

## 复验（第二轮，2026-10-01）

- 复验人：独立 critic（非一审 critic、非 writer、非修错员）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（git show 逐行独立核验）
- 结论：**仍需再修**（4 处硬问题已修好；25 项轻微建议中 15 项移位 + 7 项拆分经独立核源码确认是真实的 ±5 窗口违规，修错员未动；另发现 1 处新增同类问题 [0]；另有 2 处一审建议的锚点号有误，本复验给出修正值）

### 4 处硬问题：全部确认修好 ✓

| facts | 新 ref | 独立核验结果 |
|---|---|---|
| [5] | SystemPromptConfig.kt:285 | 窗口 280–290 覆盖 285–286 `val packageSystemVisible = toolExposureMode == ToolExposureMode.FULL && enableTools && (toolVisibility["use_package"] ?: true)`；事实文本已同步改为"（第 285-286 行）"，无"280-281"残留 |
| [6] | SystemPromptConfig.kt:305 | 窗口 300–310 覆盖 304–308 三类来源过滤（`getPackageTools != null && !isToolPkgContainer && allowedPackageNames` 白名单） |
| [7] | SystemPromptConfig.kt:439 | 窗口 434–444 覆盖 439/441 `.replace("TOOL_USAGE_GUIDELINES_SECTION", "")` / `.replace("AVAILABLE_TOOLS_SECTION", "")` |
| [16] | SystemPromptConfig.kt:665 | 窗口 660–670 覆盖 665 `val safeRoleName = groupOrchestrationRoleName.ifBlank { if (useEnglish) "assistant" else "助手" }` |

### 25 项轻微建议：独立判定

**接受放行（4 项，窗口内确实有支撑）**：
- [3]（:223）：227 行注释 "Always replace the introduction placeholder so an empty intro removes it cleanly." 在窗口内，完整支撑"空介绍干净移除"断言。
- [15]（:235）：→ **改判可接受**。:240 窗口 235–245 覆盖 241/243 行完整提示词字符串（含"始终保持角色身份/严禁冒充"、"[From role: xxx]"、"参与者名单"），单行长字符串场景下锚点有效。建议可移到 :242 更居中，但非必须。
- [36]（:777）：772–776 KDoc（"uses do()/finish() commands and returns structured <think> / <answer> XML blocks"）在窗口内，完整支撑断言。
- [63]（:77）：键名格式在 77–82 行，窗口内已支撑。

**仍需移位（15 项，支撑原文确在 ±5 窗口之外）**——给出经独立核验的精确新锚点：
- [11] :529 → **:519**（`return if (!workspacePath.isNullOrBlank())` 门控在 519 行，原窗口 524–534 覆盖不到）
- [21] :120 → **:129**（中文标题 list 在 129 行）
- [24] :209 → **:217**（`appendPreviousSummary` 在 218、globalRules 追加在 219–220 行）
- [31] :483 → **:528**（`priority: angry > cry > aojiao > shy > happy` 在 528、"At most one <mood>" 在 532 行）
- [33] :585 → **:592**（"no more than 100 words" 在 595 行）
- [34] :623 → **:631**（8 步流程列表在 629–636 行）
- [39] :42 → **:541**（4 分类 `return listOf(basicTools, fileSystemTools, httpTools, memoryTools)` 在 539–543 行）
- [41] :506 → **:515**（`direct_image/direct_audio/direct_video -> false` 过滤在 515–519 行；`shouldExposeIntent` 在 506–509 行同属窗口）
- [46] :829 → **:866**（`applyToolOrder` 866 / `applyToolVisibility` 867 / `buildToolHookPayload` 868）
- [58] :2523 → **:2542**（namespace `description = "optional, system/secure/global"` 在 2542、`default = "system"` 在 2544 行）
- [64] :140 → **:146**（`UUID.randomUUID()` 在 146 行，原窗口 135–145 差 1 行未覆盖）
- [66] :229 → **:234**（复用逻辑 `findTagWithSameContent` 235 / 复用 id 237 / 否则创建 239 在 234–239 行）
- [69] :11 → **:15**（`val key` 在 15、`defaultsByVersion` 在 20 行，原窗口 6–16 覆盖不到 20）
- [70] :58 → **:70**（⚠️ 一审建议的 :62 不对：:62 窗口 57–67 覆盖不到 70/73 行的更新条件；:70 窗口 65–75 覆盖 `latestVersion` 65、`latestContent` 66、`knownDefaults` 68、`isUsingKnownDefault` 70、条件注释 72、return 73）
- [71] :43 → **:50**（⚠️ 一审建议的 :47 不对：:47 窗口 42–52 覆盖不到 53 行的 `applyLatest`；:50 窗口 45–55 覆盖 `updater` 50 与 `applyLatest` 53）

**仍需拆分（7 项，复合事实跨多个 ±5 窗口，无单一锚点可用）**：
- [9]：前半"移除工具相关说明节"在 456–462、后半"压缩换行"在 466–467（且与 [10] 重复）。修法：删去后半句，ref 改 **:459**（窗口 454–464 覆盖 456–462 移除链与 455 `enableTools=false` 分支）。
- [13]：三阶段 hook 分别在 606 / 676 / 684。修法：拆 3 条：`before_compose_system_prompt`（:606）、`compose_system_prompt_sections`（:676）、`after_compose_system_prompt`（:684）。
- [19]：`SUMMARY_PROMPT` 在 18、`SUMMARY_PROMPT_EN` 在 66。修法：拆 2 条。
- [23]：`resolveSummarySections` :166、`buildSummarySectionOverrides` :183、`applySummarySectionOverrides` :224。修法：拆 3 条。
- [38]：refine 提示词 strict JSON 在 942、select 提示词 strict JSON 在 986。修法：拆 2 条（refine :940，select :984）。
- [40]：4 分类返回在 539–543、追加 internal 在 556–564。修法：拆 2 条（getAIAllCategories :541、getAllCategories 追加 internal :560）。
- [47]：三阶段 stage 分别在 872 / 897 / 908。修法：拆 3 条。

**复验新增发现（1 项）**：
- [0]：`SYSTEM_PROMPT_TEMPLATE` 在 163、`SYSTEM_PROMPT_TEMPLATE_CN` 在 180，事实文本自带两个行号但 ref :163 的窗口覆盖不到 180。与 [19] 同类问题，修法：拆 2 条。

### 其他全量复查（通过）

- **73 条 facts**：脚本全量校验文件存在、行号不越界（73/73）；断言内容抽查（[0][1][44][50][59][61][72]）与源码一致，无虚构。
- **quality 10 条**：evidence 逐字在源码命中（10/10）；severity 分级合理（warn 6：ignore_ssl / 隐藏终端 / delete_memory 不可逆 / execute_shell 零护栏 / 任意 Intent / 中英确认口径差异；suggestion 4：namespace 参数 / update_user_profile / PromptVersionManager 零调用方 / 提示词硬编码）；Q9"零调用方"独立复核：`grep -rn PromptVersionManager` 全仓库除自身文件外零引用，定级成立。
- **正文**：MNN / LLAMA_CPP"停止维护"醒目标注在正文 §8 末（第 100 行）+ facts[59]；PromptTagManager（§9）/ PromptVersionManager（§10）均已覆盖；来源 6 文件行数与实测一致。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"——正文/facts/quality/status 均为 0；`.lint.md` 第 34 行有 1 处自指性提及（"禁用词（通过/批准/LGTM）0 命中"），按铁律零残留惯例改写为"禁用词与模糊词扫描干净"。模糊词（可能/大概/似乎/应该/也许）0 处。
- **status.json**：issue=74（整数）、status=review-pending、source_repo=operit、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb` 均正确；`refs_valid` "73/73"——**注意：本次拆分修错后 facts 条数会增加（73→约 88），修错员须同步更新该字段与实际条数一致**；critic 字段保持留空（复验未通过，不填）。
- **lint**：独立隔离重跑（/tmp 临时目录，仅本页 md+facts）0 硬失败 / 0 警告。

### 给修错员的清单

修上述 15 项移位 + 7 项拆分 + 新增 [0] 拆分 + [9] 改写 + .lint.md 第 34 行改写。注意 [70] 用 :70（不是一审的 :62）、[71] 用 :50（不是一审的 :47）。拆分后更新 facts 总数与 status.json 的 refs_valid。修完后须由**独立 critic（第三人）**再次复验。复验未修改任何被核验文件。

---

## 复验（第三轮，2026-10-01）

- 复验人：独立 critic（非一审 critic、非修错员、非第二轮复验人）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 确认一致）
- 结论：**通过**（第二轮清单 23 项全部落实；复验另发现 2 处同类锚点问题，已按独立复验直接修正惯例当场修复；全量复查通过）

### 第二轮清单逐项复核（全部 ✅，独立逐行核源码）

**15 处移位**（±5 窗口逐个确认支撑原文）：
| facts | 新 ref | 核验 |
|---|---|---|
| [12] | SystemPromptConfig.kt:519 | `return if (!workspacePath.isNullOrBlank())` 门控在 519 行 ✅ |
| [25] | FunctionalPrompts.kt:129 | 中文标题 list 在 129 行 ✅ |
| [30] | FunctionalPrompts.kt:217 | `appendPreviousSummary` 在 218、globalRules 追加在 219–220 ✅ |
| [37] | FunctionalPrompts.kt:528 | `priority: angry > cry > aojiao > shy > happy` 在 528、"At most one \<mood\>" 在 532 ✅ |
| [39] | FunctionalPrompts.kt:592 | "no more than 100 words" 在 597 行，窗口 587–597 覆盖 ✅ |
| [40] | FunctionalPrompts.kt:631 | 8 步流程列表在 629–636 ✅ |
| [46] | SystemToolPrompts.kt:541 | `return listOf(basicTools, adjustedFileSystemTools, httpTools, memoryTools)` 在 539–544 ✅ |
| [49] | SystemToolPrompts.kt:515 | `direct_image/direct_audio/direct_video -> false` 在 515–519 ✅ |
| [54] | SystemToolPrompts.kt:866 | `applyToolOrder` 866 / `applyToolVisibility` 867 / `buildToolHookPayload` 868 ✅ |
| [68] | SystemToolPromptsInternal.kt:2542 | namespace `description = "optional, system/secure/global"` 在 2542、`default = "system"` 在 2544 ✅ |
| [74] | PromptTagManager.kt:146 | `val id = UUID.randomUUID().toString()` 在 146 ✅ |
| [76] | PromptTagManager.kt:234 | `findTagWithSameContent` 235 / 复用 id 237 / 否则创建 239 ✅ |
| [79] | PromptVersionManager.kt:15 | `val key` 在 15、`defaultsByVersion` 在 20，窗口 10–20 全覆盖 ✅ |
| [80] | PromptVersionManager.kt:70 | `isUsingKnownDefault` 在 70、更新条件在 72–73 ✅ |
| [81] | PromptVersionManager.kt:50 | `updater` 回调在 50、`applyLatest` 在 53 ✅ |

注：[70] 用 :70（非一审 :62）、[71] 用 :50（非一审 :47）的修正值已落实，逐行验真成立。

**8 处拆分/改写**：[0]→:163/:180（英文/中文模板）✅；[9] 改写（删去与 [10] 重复的后半句，ref :459，窗口 454–464 覆盖 456–462 移除链）✅；[13]→:606/:676/:684（三阶段 hook）✅；[19]→:18/:66（SUMMARY_PROMPT/SUMMARY_PROMPT_EN）✅；[23]→:166/:183/:224（三函数）✅；[38]→:940/:984（refine/select strict JSON 分别在 942/986）✅；[40]→:541/:560 ✅；[47]→:872/:897/:908（三阶段 tool hook）✅。

**4 处硬问题回头看**：[6]:285（packageSystemVisible 定义 285–286）✅、[7]:305（三类来源过滤 304–308）✅、[8]:439（replace 在 439/441）✅、[19]:665（ifBlank 默认角色名）✅——二次改动未破坏；[6] 事实文本"（第 285-286 行）"已同步，无残留。

### 复验新增发现并直接修正（2 项）

1. **facts[59] 复合拆分**：原文 "internalToolCategoriesEn（第 9 行）与 internalToolCategoriesCn（第 3001 行）是两套平行定义的中英内部工具提示词"——两个断言相距 2992 行，无单一 ±5 锚点可覆盖（与已拆分的 [0] 同类问题，前两轮未发现）。已拆为 2 条：[59] 英文定义（:9）/ [60] 中文定义（:3001，窗口 2996–3006 覆盖 `val internalToolCategoriesCn` 与 categoryName "内部工具"）。facts 83→**84 条**。
2. **facts[72] 移位 :16→:17**：原文"PromptTagManager 使用名为 prompt_tags 的 DataStore，schema 版本为 1，升级时从版本 0 迁移"——:16 的窗口 11–21 覆盖不到 22 行的 `0 -> PromptTagManager.migratePreferencesFromVersionZero(preferences)` 分支；:17 的窗口 12–22 同时覆盖 name（17）、currentVersion（18）与版本 0 迁移分支（22）。

修正过程记录：复验员一度因拆分后的索引移位误改了 [71]（send_message_to_ai）与 [80]（PVM 通用管理器）的 ref，已按事实文本内容逐条比对身份后全部还原（[71]→:1322、[80]→:15），并经脚本全量复验确认无残留错误。

### 全量复查（通过）

- **84 条 facts**：脚本全量校验文件存在、行号不越界、仅 fact+ref 双键（84/84）；随机抽样未修复条目（[2]:163、[26]:139 `check(start >= 0)`、[50]:526 `shouldExposeIntent`）窗口支撑成立。
- **quality 10 条**：evidence 10/10 逐字命中源码（Q0 :716 ignore_ssl、Q1 :98 隐藏终端、Q2 :667 不可逆、Q3 :2570 install_app、Q4 :17 execute_shell、Q5 :518 execute_intent、Q6 :2540 namespace、Q7 :696 update_user_profile、Q8 :9、Q9 :50）；severity 分级合理（warn 6 / suggestion 4，高危 0）；Q8"PromptVersionManager 零调用方"独立复核：`git grep PromptVersionManager` 全仓库除自身文件外零引用，定级成立。
- **正文**：结构齐全（概述 / AI 速览 / 核心机制 10 节 / 关键符号 / 输入→处理→输出 / 来源）；MNN / LLAMA_CPP"停止维护"醒目标注在 §8 末（第 100 行）；PromptTagManager（§9）、PromptVersionManager（§10）均已覆盖；来源 6 文件行数（712/1352/1007/5992/243/93）与实测一致。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"全 0（含 .lint.md 第 34 行已改写）；模糊词 0 处。
- **status.json**：id=core-config-prompts、issue=74（整数）、status=review-pending、source_repo=operit、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb` 均正确；refs_valid 已同步为 84/84。
- **lint**：独立隔离重跑（/tmp 临时目录，仅本页 md+facts）：检查文件 1，**硬失败 0 / 警告 0**。

复验未给 Issue 留言，未修改正文 md 与 quality.json。
