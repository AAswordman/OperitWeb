# Lint 报告（修错后复跑，2026-10-01）

- 检查文件：1（md + facts.json + quality.json + status.json 隔离复制到 /tmp，不含本文件自扫）
- 硬失败：0
- 警告：0

修错内容（critic FAIL 清单 9 项全部落实）：
1. F72 拆成两条：normalizeStaticPath 拒反斜杠/`..`（:2660）、serveStatic 返 403（:250）。
2. F79 拆成两条：createNewChat（:471）、setCurrent→switchAppChatContext（:480）。
3. F106 锚点 :1305→:1311（Cache-Control: no-store 在 :1312）。
4. F121–F128 8 条复合事实拆成 19 条原子事实，锚点修正到各数据类定义行（:46/:52/:64/:87/:95/:163/:170/:547/:554/:711/:713/:195/:206/:491/:501/:508/:649/:661/:667）。
5. 正文：ExternalChatHttpServer 670→570 行；WebChatModels.kt 490→760 行；数据模型 ~40→~50。
6. 正文 §6 与 Q06：超限状态码 413→400。
7. 正文 §6：readRegisteredAsset 按源码五分支重写（删掉虚构的 http(s)/data URI）。
8. quality 14 条 evidence/evidence2 全部改为源码逐字原文（含原始缩进）；Q06 行号 995→996、evidence2 1007→1010；Q09 evidence2 1032→1033。
9. facts 总数 139→152，status.json refs_valid 同步为 152。

命令：`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-iwc80` → exit 0。
禁用词 5 文件全文检查 0 命中；severity 仅 high/warn/suggestion；facts/quality 顶层数组。

## 修错轮（critic2 2026-10-01）
- 5 处 facts 重锚：[133] :195→:200、[135] :491→:496、[93] :1043→:1046、[98] :1144→:1147、[115] :2607→:2611，均逐条核对 ±5 窗口支撑
- quality evidence 恢复原始缩进（逐字节比对）：Q01 evidence/evidence2、Q03 evidence、Q05 evidence
- Q03/Q12 新增 evidence2_file=WebChatHttpBridge.kt（evidence2 代码实际所在文件）
- 隔离 lint：0 硬失败 / 0 警告；facts 152 条，refs_valid=152
