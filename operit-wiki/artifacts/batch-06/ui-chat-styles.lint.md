# Lint 记录 — ui-chat-styles（Issue #92）

- 时间：2026-10-01
- 命令：4 个交付文件（.md/.facts.json/.quality.json/.status.json）复制到 /tmp 隔离目录后运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-uics/`（避免 `.lint.md` 自扫）
- 结果：硬失败 0 / 警告 0
- 引用检查：111 条 facts 的 `file:line` 全部存在、行号不越界、键仅为 `fact`+`ref`；8 条 quality 的 evidence 均为源码逐字原文且落在 ±5 行窗口内
- 禁用词与模糊词扫描：5 个交付文件均干净，0 命中
- 状态文件：id(ui-chat-styles)/issue(92)/status(review-pending)/source_repo(operit)/source_commit 均正确，refs_valid=119，critic 留空待独立 critic

## 修错后复跑（2026-10-01）

- 依据 `ui-chat-styles.critic.md` 修正 6 项：facts[36] `drawContent`→`drawWithContent`；facts[50]/[55] 各拆成两条原子事实并重锚（:783/:159、:321/:681）；quality[7] 描述"两处 320.dp"→"三处 320.dp（BubbleUserMessageComposable.kt:408、:553，cursor/UserMessageComposable.kt:246）"、evidence 换完整逐字行；正文 §6"工具输出恒用折叠执行模式"按实现（读 toolCollapseMode 偏好）重写；11 条 facts 按报告行号表挪锚。
- facts 总数：111 → 113；`status.json` refs_valid 同步更新为 121（113 facts + 8 quality）
- 4 文件复制到 /tmp/lint-ucs92f 隔离重跑 `lint.py --src ~/workspace/Operit`：硬失败 0 / 警告 0
- 修正条目的 ±5 窗口逐条复验：关键词全部落入窗口；禁用词 0 命中；severity 仅 warn/suggestion；顶层数组格式正确
