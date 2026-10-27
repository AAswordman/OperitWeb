# lint 记录：ui-settings-model（Issue #97）

- 时间：2026-10-01（writer 自检 + 修正后复跑）
- 命令：4 个交付文件（md/facts/quality/status）复制到 /tmp/lint-model-only 隔离目录后运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-model-only`
- 结果：硬失败 0 / 警告 0
- 引用检查：121 条 facts 的 `file:line` 全部存在、行号不越界、键仅为 `fact`+`ref`；正文行内引用全部满足 ±5 窗口符号检查要求
- 质量检查：quality 10 条（high 2 / warn 6 / suggestion 2），severity 仅 high/warn/suggestion；evidence 均为源码逐字原文（含原始缩进）
- 禁用词扫描：4 文件全文 0 命中（通过/批准/LGTM）
- 状态文件：id/issue(97)/status(review-pending)/source_repo(operit)/source_commit(dbf71916fae9750cfdc9f9a774f5a0fee56633fb) 均正确，refs_valid=121，critic 留空待独立 critic 复验

修正摘要（writer 自查实地核验）：
- 初稿 facts 约 90 条；逐条拉源码窗口验真后修正 13 处 ref 行号错误（如 forwardTypeName :304→:1958、Codex 开关 :612→:242、kimi-for-coding :397→:384 等）
- 启发式窗口支撑扫描又揪出 20 余处实质问题并修正：拆分跨窗口断言为多条 facts（如导出/导入、连接测试 5 项与 3 态、思考规则字段、请求头 parse/serialize、角色卡排序枚举与持久化），措辞向源码原文靠拢（如 directImage=true 改为 enableDirectImageProcessingInput=true 等真实标识符）
- 核减 2 处不实断言：头像裁剪"1:1"（源码未指定比例）、"6 个预设"一窗难证（改为分条描述）
- 正文 28 处行内引用警告全部修复：stale 行号更新为验真后的行号，跨窗口断言拆成多个列表项、每项独立锚点
- facts 90→121 条；quality 10 条走查发现（API Key 日志打前 5 位、≤8 位 Key 明文显示为 high）
