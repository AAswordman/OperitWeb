# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（自查记录 2026-10-01：`scripts/lint.py --src ~/workspace/Operit --dir <隔离目录>` 单页隔离重跑，util-stream-parse.md 0 硬失败 / 0 警告；facts.json 83 条引用逐条脚本核验（文件存在+行号在界+断言关键词在 ±5 行窗口内）全部有效，18 个 Markdown 插件类声明行逐行核对一致；quality.json 10 条 evidence 逐字核对源码一致；正文无禁用词（模糊词/评审口令词均未出现）。）

（修错后复跑记录 2026-10-01：按独立 critic 打回的 A–C 8 项修正——facts[0] PluginState 四个状态（ref :10→:13，窗口 8–18 覆盖全部四个状态）；facts[54] :11→:30（listOf(tagName, chunk)/listOf("text", chunk) 在 :30/:33，critic 建议的 :24 窗口够不着 :30，已按源码核实）；facts[57] :7→:21；facts[64] :290→:280；facts[66] :201→:206（flushJob/groupChannel.close/session.destroy(:207) 全落入 201–211 窗口）；facts[80] 拆成两条（type 0 :440 / type 1 :451）；facts[38] :1374→:1411；quality[6] line 7→21。facts 83→84 条，status.json refs_valid 同步为 84。4 文件隔离重跑 lint：0 硬失败 / 0 警告；修正条目 ±5 窗口逐条复验全覆盖；禁用词 0 命中；顶层数组格式合规。）
