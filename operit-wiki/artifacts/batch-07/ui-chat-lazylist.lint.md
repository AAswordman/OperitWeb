# lint 记录：ui-chat-lazylist（Issue #94）

- 时间：2026-10-01（正文重写后复跑）
- 命令：4 个交付文件（md/facts/quality/status）复制到 /tmp 隔离目录后运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-lazylist`（避免 `.lint.md` 自扫）
- 结果：硬失败 0 / 警告 0
- 引用检查：114 条 facts 的 `file:line` 全部存在、行号不越界、键仅为 `fact`+`ref`；正文 101 处行内引用全部满足 ±5 窗口符号检查要求
- 质量检查：quality 7 条（warn 2 / suggestion 5），severity 仅 high/warn/suggestion；evidence 均为源码逐字原文（含原始缩进）
- 禁用词与模糊词扫描：4 文件均干净，0 命中（"可能/大概/似乎/应该/也许"）
- 状态文件：id/issue(94)/status(review-pending)/source_repo(source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb) 均正确，refs_valid=114，critic 留空待另一名独立 critic 复验

修错摘要（自查，非 critic）：
- 初版正文 241 条警告：主因是同一行内多个 `file:line` 引用、以及反引号符号超出引用行 ±5 窗口。重写正文，严格执行"一行一引用"，反引号只加在窗口内实测出现的符号上；不在窗口内的符号改用无反引号纯文本表述
- facts 自查：14 处 ref 行号按源码实测修正（如 LazyLayoutPrefetchState.kt:190→213、LazyLayoutStickyItems.kt:88→98、IntervalList.kt:60→157），1 条拆成 2 条（PinnableItem），1 条弱支撑删除（包名行无法支撑"仅保留 LazyColumn 链路"），8 条改写措辞使断言符号落在 ±5 窗口内；facts 105→114
- 行号已全部用 grep 验真，file:line 范围合法；±5 窗口经脚本半自动核对（断言中的长符号 token 必须出现在窗口内）

修错记录（critic FAIL 后，2026-10-01）：
- 4 条事实性错误改写：[16] remember key 排除 itemProviderLambda 与 coroutineScope 两者（:188）；[46] 拆 2 条（approachLayoutInfo 在 approach pass :606 / 其余 pass 更新 layoutInfoState :624）；[91] 删"可被子类覆写"；[95] findIndexByKey 找不到回退 lastKnownIndex（:103）
- 30 条锚点漂移/窗口不支持：逐条拉源码窗口实地核对后重锚或拆分（[7]/[29]/[32]/[52]/[60]/[63]/[73]/[74]/[80]/[104]/[109] 拆分，其中 [29]→3、[63]→3；其余重锚）
- [43] 符号名修正为 numOfItemsForTeleport（LazyLayoutScrollScope.kt:218）
- 新增 3 条覆盖 facts：ChatScrollExtensions.kt:5、ChatScrollNavigator.kt:69、ScrollToBottomButton.kt:26 三处外部调用；正文概述补充调用关系说明
- facts 114→131 条；status.json refs_valid=131；正文来源小节补计数行（131 条 / 走查 7 条：警告 2 / 建议 5）
- 隔离 lint 重跑：硬失败 0 / 警告 0；md/facts/quality 三文件"通过/批准/LGTM"仅 facts 中 3 处普通动词用法（"通过 X 实现"），无批准语义
