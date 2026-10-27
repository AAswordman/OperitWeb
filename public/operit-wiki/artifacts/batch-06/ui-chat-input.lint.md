# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（自查记录 2026-10-01：`scripts/lint.py --src ~/workspace/Operit --dir <隔离目录>` 单页隔离重跑，ui-chat-input.md 0 硬失败 / 0 警告；facts.json 74 条引用逐条脚本核验（文件存在+行号在界+断言关键词在 ±5 行窗口内）全部有效；quality.json 11 条 evidence 逐字核对源码一致；正文无禁用词（模糊词/评审口令词均未出现）。）

## 修错轮（2026-10-01，critic FAIL 后）
- F8：模型胶囊截断"前 23 字符"→"前 26 字符"（源码 take(26)），ref :534→:535；正文同源处同步改。
- F39：拆成 agent 单模型分支 :2074 / 多模型分支 :2159 两条。
- F40：拆成 classic 单模型分支 :1613 / 多模型分支 :1700 两条。
- F43：拆成对话框 :354 / FIXED_PROFILE 写回 :371 两条。
- F52：拆成 INPUT_CHANGED :1596 / dispatchSubmitRequested :1813 两条（:1813 窗口同时覆盖 BLOCK 裁决）。
- F5：拆成 :830 / :1130 两条原子事实。
- facts 74→79，status.json refs_valid=79；11 条修正条目 ±5 窗口逐条复验支撑；禁用词 0 命中。
