# Lint 自查记录（services-chatservice）

- 自查时间：2026-10-01（修错后复跑）
- 命令：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-self`（单页隔离，只含 services-chatservice.md）
- 结果：检查文件 1，硬失败 0，警告 0
- 额外自查：
  - facts.json 181 条：JSON 合法，全部 `file:line` 引用行号真实存在（脚本逐条验，无越界、无缺文件）；critic 指出的 53 处锚点错位已重锚，7 条复合事实已拆分；全文件重扫另发现 17 处同类锚点错位并修正
  - quality.json 14 条（warn 6 / suggestion 8）：字段齐全，severity 仅 high/warn/suggestion；quality[11] 证据虚构已删除；quality[12][14] evidence 补 `private` 并修正行号；重扫发现 quality[3][7][8][9][12] 证据行号漂移 1–25 行已修正；全部 evidence 均为逐字代码原文，已逐行复核源码
  - 全文件禁用词与模糊词扫描：5 文件均干净
  - 正文引用全部独占一行，符号名 ±5 行窗口已人工核对

- 独立复验（2026-10-01）：发现 facts[38] 与 facts[53] 为同一断言重复（均为 `PACKAGE_ATTACHMENT_PREFIX = "package_attach:"`，AttachmentDelegate.kt:40），已合并删除 [38]，facts 182→181 条；合并后重新全量验真，0 坏引用。
