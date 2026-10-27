# Lint 自查记录（data-prefs-app）

- 自查时间：2026-10-01
- 检查命令：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-mine`（仅本页 .md 隔离运行）及整批 `review/batch-05` 扫描
- 检查文件：1（data-prefs-app.md）
- 硬失败：0
- 警告：0

## 修错后复跑（2026-10-01）

critic 打回 2 处硬问题（facts[170] `:708`→`:721`、quality 第 11 条 `:59`→`:38`）及轻微建议（facts[164] 拆成 2 条、quality 第 11 条 evidence 补写入行），已全部修复并逐行对源码复验。

- facts.json：229→230 条（拆分一条复合事实），230/230 引用文件存在、行号在范围内且 ±5 窗口支撑原文，0 坏引用。
- quality.json：19 条；第 11 条行号锚点 `:59`→`:38`，evidence 补上 `saveTtsSettings` 写入行 `httpConfig?.let { prefs[TTS_HTTP_CONFIG] = serializerJson.encodeToString(it) }`（逐字命中源码），description 注明写入位置。
- 隔离重跑 lint：硬失败 0 / 警告 0；5 文件全文禁用词扫描 0 命中。

## 迭代过程

1. 初次全批扫描发现 14 条"引用文件不存在"：关键符号表中误用了缩写路径 `data/preferences/...`，lint 要求源码根相对全路径。已用 sed 批量替换为 `app/src/main/java/com/ai/assistance/operit/data/preferences/...`。
2. 修正后隔离扫描：硬失败 0 / 警告 0；全批扫描中本页无任何错误或警告（其余条目为兄弟 writer 在制品，与本页无关）。
3. 自研脚本逐条校验 facts.json：229 条引用文件存在、行号在范围内，0 坏引用。
4. 自研脚本逐字校验 quality.json：19 条 evidence 去除缩进后均能在对应源码中找到逐字连续原文（修正两处：ThemePreferenceSnapshot 证据空行数、MemorySearchSettingsPreferences 证据尾逗号）。
5. 禁用词检查：全文无评审触发词；模糊词（可能/大概/似乎/应该/也许）扫描 0 命中。
6. frontmatter 四键（title/module/sources/date）齐全；"来源"小节非空。

结论：lint 达标（0 硬失败 / 0 警告），可交付。
