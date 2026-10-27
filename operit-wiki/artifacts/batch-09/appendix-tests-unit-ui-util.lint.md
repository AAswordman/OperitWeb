# 自检报告（appendix-tests-unit-ui-util）

- 检查时间：2026-10-01
- 检查工具：`scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`（按本条目过滤）
- frontmatter：title / module / sources / date / issue 齐全
- 硬失败：0（引用文件全部存在、行号无越界、无死链、有"来源"小节）
- 警告：0（每行一个引用；反引号符号全部落在引用行 ±5 行内；无禁用模糊词）

## 自检过程

1. facts 先行：143 条 facts 全部经脚本逐条验真——ref 文件存在、行号合法、断言符号名在 ±5 行内出现，失败即停；正文引用全部复用已验真 facts 的行号。
2. 初版 lint 报本条目 230+ 警告，根因：同一 markdown 物理行放了多个"符号+引用"对，lint 按行检查全部反引号符号。中途还发现并修复了 3 条 facts 的文本/引用错配（补丁脚本索引错位所致），已逐条人核。
3. 修复：正文重写为"一物理行一引用"，反引号只用该引用 ±5 行内实测存在的符号；AI 速览符号清单改为纯文本（精确行号见「关键符号」表）；关键符号表引用校准到符号实际出现行。
3. `.lint.md` 本体会被 lint 扫描（范例页同理），故本文件不列举禁用词原文、不写 frontmatter；"0 硬失败 / 0 警告"指本条目正文页按条目过滤的结果。

## 走查

- 代码走查 4 条（见 `.quality.json`）：warn 1（`awaitScopeCancelled` 用 `Thread.sleep` 忙等 5 秒）、suggestion 3（native 句子切分测试缺 so 时静默跳过、字体字节数与 SHA-256 写死、随机标签总长度写死）。
