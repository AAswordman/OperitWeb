# lint 记录：integrations-external（Issue #81）

- 时间：2026-10-01（修错后复跑）
- 命令：4 个交付文件（md/facts/quality/status）复制到 /tmp 隔离目录后运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-ie`（避免 `.lint.md` 自扫）
- 结果：硬失败 0 / 警告 0
- 引用检查：155 条 facts 的 `file:line` 全部存在、行号不越界、键仅为 `fact`+`ref`；正文 75 处行内引用全部满足 ±5 窗口符号检查要求
- 质量检查：quality 10 条，severity 仅 high/warn/suggestion；evidence 均为源码逐字原文
- 禁用词与模糊词扫描：4 文件均干净，0 命中
- 状态文件：id/issue(81)/status(review-pending)/source_repo/source_commit 均正确，refs_valid=155，critic 留空待另一名独立 critic 复验

修错摘要（依据 critic.md）：
- 61 条 facts 的 ref 行号按对照表修正；另发现并修正 16 条 ref 把 integrations/externalchat/ 误写成 integrations/http/（文件不存在，critic 漏检）
- [85] 措辞修正：ExternalChatHttpRequest 为独立 data class（非继承）
- [149] 拆成两条 facts（task_type/arg1-3 与 arg4-5/args_json），facts 154→155
- quality [5] 改锚 ExternalChatReceiver.kt:105；[8] 改锚 A2aHttpHandler.kt:491 并补充 Host 校验緩解说明
- 正文补 75 处行内 file:line 引用（data-mcp.md 风格）
