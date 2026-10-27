# Lint 记录（util-search）

- 运行：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/uslint`（5 文件复制到 /tmp 隔离运行）
- 结果：检查文件 1，硬失败 0 / 警告 0
- 修正过程：
  - 初版 md 行内引用用裸文件名（`StandardFileSystemTools.kt:272`）→ 补全为仓库相对全路径
  - frontmatter 补 `title` / `module` / `sources` / `date`
  - md 措辞修正 2 处（禁用词零残留）
  - md 模糊措辞 1 处 → 已改定稿
  - 引用 ±5 符号校验：把段落拆成单引用 bullet，确保每个 bullet 内反引号符号都出现在引用行 ±5 内；修正错位引用 4 处（`IndexItem.kt:27`→`:23` 的 equals 声明行、`MemoryRepository.kt:373`→`:372`、`590`→`:598` 等）
- 5 文件全文禁用词扫描：0 命中

## 修错轮（critic FAIL → 22 项清单，2026-10-01）

- facts 13 条重锚（逐条核源码 ±5 窗口）：F31 :9→:12、F35 :66→:73、F39 :121→:125、F44 :257→:260、F47 :226→:230、F48 :174→:182、F49 :198→:201、F53 :296→:305、F66 :343→:346、F73 :272→:276、F75 :282→:285、F78 :531→:543
- F72 拆条：原"回查+重算+排序"三断言 → 事实条（函数内回查 memoryBox、逐条重算 cosineSimilarity，不排序，ref :600）+ 调用方排序条（sortedByDescending { it.second }，ref MemoryRepository.kt:1433）；facts 81→82
- F79 事实错误修正：`search_code` → `grep_code`（ToolRegistration.kt:2222 注册名；全仓库无 search_code 字样）；正文 4 处同步改
- quality 5 条行号：Q5 87→89、Q6 348→349、Q8 82→81、Q9 59→60、Q12 257→262（evidence 逐字复核命中）
- 正文：来源小节行数 113→91、46→34、17→18；删除"速度比纯 Kotlin 实现快得多"无来源比较；F72 连带句修正（函数回查重算 vs 调用方排序，拆成两条 bullet 使 lint 符号校验归属正确）
- status.json refs_valid 81→82
- 重跑：隔离 lint 0 硬失败 / 0 警告；82 条 facts 行号全在界；12 条 quality evidence 逐字命中 ±5 窗口；禁用词 0 命中
