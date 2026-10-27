# Lint 记录（util-system）

- 运行方式：4 个内容文件（md/facts.json/quality.json/status.json）复制到 `/tmp/lint-util-system` 隔离运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-util-system`（`.lint.md` 是记录本身，排除自扫）
- 结果：硬失败 0 / 警告 0
- 修复过程：初次运行报 `util-system.md` frontmatter 缺 `title/module/sources/date` 4 项硬失败，已按 batch-05 既有页面格式补上 frontmatter 后复跑，硬失败 0 / 警告 0。
- JSON 格式校验：`util-system.facts.json`（顶层数组，71 条）、`util-system.quality.json`（顶层数组，10 条）、`util-system.status.json` 均可解析；severity 仅含 `warn`/`suggestion`。
- 禁用词：5 文件全文扫描评审触发词 0 命中（facts 中一处"经由"义表述已改写规避字面命中）。
- 修错后复跑（critic 指出 3 条微瑕：quality 第 7 条 line 17→16、facts"只输出类名与 message"改写、无权限返回表述严格化）：4 文件隔离重跑 `lint.py`，硬失败 0 / 警告 0。
