# Lint 自查记录（core-subpack）

- 自查时间：2026-10-01（修错复验：critic 打回 8 项已修复）
- 命令：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-subpack-fix`（单页隔离，只含 core-subpack.md）
- 结果：检查文件 1，硬失败 0，警告 0
- 额外自查：
  - facts.json 107 条：JSON 合法，全部 `file:line` 引用行号真实存在（脚本逐条验，无越界、无缺文件）；critic 指出的 6 处引用窗口问题已按建议拆分/重锚（setOutput File/String 拆分、exportAndroidApp :759→:766、产物文件名/输出目录拆分、bcprov 版本/排除拆分、聊天页调起/HTML 打包器复用拆分），13 个新引用行 ±5 窗口逐条脚本验真
  - quality.json 15 条：字段齐全，severity 仅 high/warn/suggestion，evidence 均为逐字代码原文（quality[7] 的两行作者注释已移除，只留源码原文行；quality[0] 异常类型名改为笼统表述）
  - 正文来源小节 ExeIconChanger.kt 行数 170→171 已修正（awk NR 确认 171 行，无尾换行）
  - 全文件无 watcher 审批触发词、无 lint 模糊词（已逐项扫描确认）
  - 正文引用全部独占一行，符号名 ±5 行窗口已人工核对
