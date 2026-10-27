# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（单页隔离跑 lint.py --src ~/workspace/Operit：0 硬失败 / 0 警告。首轮 4 处 frontmatter 缺失（title/module/sources/date）与 1 处模糊词"可能"已全部修正：补 frontmatter（module=UI 聊天，sources 为 16 个种子文件名），正文"可能含流式 XML 片段"改写为"流式时为不完整的 XML 片段"。

修错后复跑（2026-10-01）：按 ui-chat-parts.critic.md 修正 47 条 facts ref 行号漂移（[110] 连文件一并改到 part/XmlCanvasBlockComponents.kt:51）、quality Q2 line 125→126、Q4 line 287→320；修正条目 ±5 窗口逐条复验支撑断言（47/47）；4 文件 /tmp 隔离重跑 lint 0 硬失败 / 0 警告；禁用词 0 命中；facts 144 条、quality 7 条不变。）
复验修错后复跑（2026-10-01）：按 ui-chat-parts.critic2.md 7 项清单修正——6 条复合 facts 拆分重锚（[72]→2 条 :161/:180、[73]→3 条 :224/:247/:274、[74]→2 条 :316/:330、[111]→2 条 :177/:193、[129]→2 条 :268/:285、[133]→2 条 :433/:439）、quality Q4 evidence 首行按源码逐字修正（`if (result.endsWith("]]>") ) {`，含 `)` 前空格）、观察项 facts[135] 重锚 :377→:383（窗口 378–388 覆盖全部映射与回退）；新锚点 ±5 窗口逐条脚本复验 14/14 关键词命中；facts 144→151，status.json refs_valid 同步为 151；4 文件 /tmp 隔离重跑 lint 0 硬失败 / 0 警告；禁用词 0 命中。
