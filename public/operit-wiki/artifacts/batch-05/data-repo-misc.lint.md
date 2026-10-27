# Lint 报告

- 检查文件：1（data-repo-misc.md，单页隔离）
- 硬失败：0
- 警告：0

自查过程：
- 初版 352 警告，全部为“引用行 ±5 行未见符号”类：长段落一行内放多个引用，lint 把整行反引号符号逐个对每个引用校验。已按 batch-04 模式重构——每个 `file:line` 引用独立成行，该行不含其他反引号符号。
- 重跑 lint.py（--src ~/workspace/Operit --dir 单页隔离目录）：0 硬失败 / 0 警告。
- facts.json 168 条引用行号已用脚本逐条验真（文件存在、行号不越界），0 缺失。
- quality.json 20 条 evidence 去除缩进差异后逐字命中源码。
- 全文件禁用词与模糊词扫描干净。

修错记录（2026-10-01，critic 打回 25 项全部落实）：facts 12 条重锚（[30]:615、[41]:934、[50]:228、[70]:916、[71]:965、[77]:700、[84]:121、[114]:283、[119]:414，另 [22][118] 随拆分重锚）；9 条复合拆分（[22]→2、[34]→2、[35]→2、[37]→2、[59]→2、[85]→3、[118]→3、[120]→2、[130]→2，其中 [130] 第一条锚点取 :161 而非 critic 建议 :150——:161 的 ±5 窗口同时覆盖 160 行 file.delete 与 164 行元数据删除，:150 窗口覆盖不到，属有据偏离）；正文 md 14 处行内引用同步更新；quality[7] line :294→:381；quality[0]/[14] 同根因合并为 1 条（AI 参数 workflow_id 经 StandardWorkflowTools.kt:884→WorkflowRepository.triggerWorkflow:552→triggerWorkflowInternal:603→getWorkflowById:316 直达 getWorkflowFile:164，已逐行追链验真）；facts 157→168 条、quality 21→20 条；单页隔离重跑 lint 0 硬失败 / 0 警告。

复验记录（2026-10-01，独立复验 critic）：168 条 facts 引用脚本全量验真 0 缺失；全部 12 处重锚与 9 处拆分锚点逐个手工核 ±5 窗口确认有效，另发现 3 处可更优的锚点并修正（facts[76] :965→:968 使窗口同时覆盖 pattern/require_final/ignore_case/cooldown_ms 四处；facts[128] :414→:428 精确命中 default_branch 解析行；facts[156] :141→:146 使窗口同时覆盖 schemaVersion/version/指针版本/hashAlgorithm），正文 md 3 处行内引用同步更新；quality 20/20 evidence 逐字命中；触发链 StandardWorkflowTools.kt:884（AI 参数 workflow_id）→triggerWorkflow:552→triggerWorkflowInternal:603→getWorkflowById:316→getWorkflowFile:164（File(dir, "$workflowId.json") 未消毒）亲手追链验真，读/写回均可达，warn 分级合理；5 文件禁用词 0 命中；单页隔离重跑 lint（--src ~/workspace/Operit）：0 硬失败 / 0 警告。
