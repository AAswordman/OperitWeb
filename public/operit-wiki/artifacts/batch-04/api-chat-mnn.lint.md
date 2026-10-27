# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 修错记录（2026-10-01，critic 退回 5 处已修）

- #63 事实错误修正："max_tokens 不经 setConfig"改为"两条路都走"——拆成 3 条原子事实（:657 提取 requestedMaxNewTokens；:686 传入 generateStream；:848 写入 configMap['max_new_tokens']），正文同步修正
- #61 引用窗口违规：拆成 3 条（:822 temperature/top_p；:831 top_k；:836 min_p）
- #26 引用窗口违规：拆成 2 条（:294 图片/音频；:300 视频）
- #66 引用窗口违规：拆成 3 条（:879 INT；:887 FLOAT/BOOLEAN/STRING；:900 OBJECT）
- quality Q4 行号错位：line 950 → 971（evidence 在 971–974 行）
- facts 总数：73 → 80 条；全部 ref 经 ±5 窗口复验通过，无重复 ref
- 本报告为修错后单页隔离重跑结果
