# ui-about 自检报告

- 日期：2026-10-01
- 种子：6 文件（about/screens ×2、update/screens ×3、help/screens ×1），约 2,536 行
- 注：任务列出的 8 个种子路径中有 4 个在该 commit 下不存在（LoginScreen/FeedbackScreen/ChangelogScreen/PrivacyScreen，经 `git ls-tree dbf71916` 确认），已用同名 find 全仓库核实，实际按存在的 6 文件交付

## 检查项

1. facts.json 为顶层数组，共 118 条，每条含 fact/ref：通过
2. 全部 ref 为仓库根相对全路径 + 行号，共 118 个，逐条经脚本核对 ±5 行内出现断言符号名：通过
3. facts 数（118）= status.json refs_valid（118）：通过
4. frontmatter sources（6）= 引用去重文件数（6）：通过
5. 正文含 概述/AI 速览/核心机制/关键符号/调用链/来源 六节：通过
6. 禁用词（可能/大概/似乎/应该/也许）扫描：0 命中
7. quality.json 7 条，每条含 title/description/file/line/severity/confidence/evidence，severity 取值 high|warn|suggestion：通过
8. 引用精确到行，无"详见某文件"式模糊指代：通过

## 结论

- 硬失败：0
- 警告：0
