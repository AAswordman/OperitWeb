# Lint 自查记录（core-config-prompts）

- 自查时间：2026-10-01
- 检查命令：`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-05`（全批扫描）及隔离目录 `/tmp/lint-mine`（仅本页 .md）
- 检查文件：1（core-config-prompts.md，隔离扫描）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 硬失败：0
- 警告：0

## 迭代过程

1. 首次扫描本页 5 项问题：frontmatter 缺少 `title` / `module` / `sources` / `date` 四键；正文含模糊词"可能"1 处（记忆分类页脚描述句）。
2. 已修复：补齐 frontmatter（title=系统提示词与功能提示配置，module=引擎核心，sources=7 个种子文件，date=2026-10-01）；模糊词句改写为确定性表述。
3. 复跑全批扫描：本页条目 .md 0 硬失败 / 0 警告（其余条目的问题为兄弟 writer 制品，与本页无关）；隔离目录单文件扫描同样 0 硬失败 / 0 警告。
4. 自研脚本逐条校验 facts.json：73 条引用文件存在、行号在范围内，0 坏引用。
5. 自研脚本逐条校验 quality.json：10 条（warn 6 / suggestion 4），evidence 去除缩进后均在 file:line ±5 行窗口内找到逐字连续原文，0 坏证据。
6. 禁用词检查：5 个交付文件全文扫描，评审触发词 0 命中；模糊词 0 命中。
7. 阅读证据：`scripts/record_read.py` 已登记 8 个文件（含 2 个兄弟文件 PromptTag.kt、ConversationService.kt），状态 complete。

## 阅读覆盖

种子目录 `core/config/` 4 个文件全文阅读（SystemPromptConfig.kt 712 行、FunctionalPrompts.kt 1352 行、SystemToolPrompts.kt 1007 行、SystemToolPromptsInternal.kt 5992 行），兄弟条目划归的 PromptTagManager.kt（243 行）、PromptVersionManager.kt（93 行）全文阅读，调用方 ConversationService.kt 相关段落、数据模型 PromptTag.kt 已读。

结论：lint 达标（0 硬失败 / 0 警告），可交付。

## 修错记录（2026-10-01）

critic 打回 4 项硬问题（纯锚点错位，断言为真），全部在 Operit @ dbf71916 源码逐行确认后修正：
- facts[5] ref :280→:285（packageSystemVisible 定义在 285-286；事实文本中误写的"（第 280-281 行）"同步改为"（第 285-286 行）"）
- facts[6] ref :340→:305（三类来源过滤在 303-308）
- facts[7] ref :68→:439（清空 TOOL_USAGE_GUIDELINES_SECTION/AVAILABLE_TOOLS_SECTION 在 439-441）
- facts[16] ref :648→:665（默认角色名 ifBlank 在 665）

单页隔离复跑 lint.py（/tmp 临时目录，避开 .lint.md 自扫）：0 硬失败 / 0 警告。5 文件全文禁用词与模糊词扫描干净，0 命中。

## 修错记录（第二轮复验，2026-10-01）
- 15 项移位：[11]:519、[21]:129、[24]:217、[31]:528、[33]:592、[34]:631、[39]:541、[41]:515、[46]:866、[58]:2542、[64]:146、[66]:234、[69]:15、[70]:70、[71]:50（均逐行核源码 ±5 窗口支撑）
- 8 处拆分：[0]→2（:163/:180）、[9]改写去后半句（ref→:459）、[13]→3（:606/:676/:684）、[19]→2（:18/:66）、[23]→3（:166/:183/:224）、[38]→2（:940/:984）、[40]→2（:541/:560）、[47]→3（:872/:897/:908）
- facts 73→83 条；status.json refs_valid 已同步更新；lint 单页隔离重跑 0 硬失败 / 0 警告
