# Lint 记录（util-stream-core）

- 运行：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/usclint`（5 文件复制到 /tmp 隔离运行）
- 结果：检查文件 1，硬失败 0 / 警告 0
- 修正过程：
  - facts.json 初写时三段拼接出现双逗号 → 已修正，JSON 校验正常
  - facts 行号修正 6 处（stream 构建器 CancellationException `:127`→`:128`、finally `:133`→`:134`；chunked 尾块 `:212`→`:210`；`KmpPattern` 类声明 `:512`→`:493`、`group` `:528`→`:511`、`toRegexPattern` `:534`→`:518`、`repeat` `:616`→`:640`、`greedyStar` `:600`→`:625`）
  - splitBy 默认文本组引用错挂在 chunked 行 `:210` → 改为文档行 `:221`
  - 160 条 facts 逐条脚本核引用：文件存在、行号合法；含中文表述的 5 条人工复核源码，均有效
- 5 文件全文禁用词扫描：0 命中
- md 模糊措辞扫描：0 命中

## 修错后复跑（2026-10-01，critic FAIL → 修错）

- 按 critic 报告修正清单执行：
  - 拆分 6 条复合事实为单断言：[17] FlowAsStream finally（Stream.kt :206/:210）、[33] tryEmit（HotStream.kt :140/:132）、[46] share EAGERLY（HotStream.kt :335/:365）、[58] stream 构建器（StreamBuilders.kt :136/:140）、[93] savepoint（:14×2）、[94] rollback（:20×2）→ facts 160→166
  - facts 行号重锚 5 处：[119] StreamOperators.kt :394→:405、[139] StreamKmpGraph.kt :117→:124、[140] :124→:132、[141] :149→:155、[145] :253→:261
  - quality[5] line 97→107（StreamKmpGraph.kt，`return when (description)` 实际位置）
- 修正条目 ±5 窗口逐条复验：18 条全部支撑
- status.json refs_valid 同步为 166
- 复跑：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-usc85b`（4 文件隔离）→ 检查文件 1，硬失败 0 / 警告 0
- 5 文件禁用词复查：0 命中；severity 仅 high/warn/suggestion（1/11/2）
