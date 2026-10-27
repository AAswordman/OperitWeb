# Lint 报告：ui-chat-editor（Issue #96）

- 检查方式：`review/batch-07/ui-chat-editor.{md,facts.json,quality.json,status.json}` 4 文件复制到 `/tmp/lint-ui-chat-editor`，隔离运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-ui-chat-editor`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`

## 结果

- 检查文件：1（lint 脚本仅对 md 做 frontmatter/引用检查）
- 硬失败：**0**
- 警告：**0**

首轮曾报 4 项硬失败（md 缺 frontmatter 的 `title`/`module`/`sources`/`date`），已按 batch-06 既有格式补齐 frontmatter 后复检合格。

## 补充自检（lint 未覆盖项，人工机检）

- facts 98 条：全部 ref 文件存在、行号无越界；逐条做 token 支撑检查（断言中的关键符号/常量/字面量必须出现在 ref ±5 行窗口内），发现 11 处锚点漂移（如 `drawEditor` 误记 999 实为 1039、`updateCompletion` 误记 912 实为 921），已全部修正为真实行号后复检合格。
- quality 12 条：severity 仅 high/warn/suggestion（1/5/6），evidence 均为源码逐字原文（含原始缩进）。
- status.json：`refs_valid=98` 与 facts 条数一致；`id`/`issue`/`source_repo`/`source_commit` 字段齐全。
- 全文无"通过/批准/LGTM"字样。
