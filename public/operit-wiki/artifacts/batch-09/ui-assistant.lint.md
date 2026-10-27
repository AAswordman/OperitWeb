# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 自检说明

- 运行：`python3 scripts/lint.py --src ~/workspace/Operit --dir <仅含 ui-assistant.md 的临时目录>`
- 首轮 0 硬失败 / 3 警告：3 处正文断言的反引号符号不在引用行 ±5 行内（S:53、C:595、C:860），已逐条改写断言、重锚到调用点符号，复检通过。
- facts.json：143 条，全部为 {"fact","ref"} 结构；ref 全部匹配 `app/src/...kt:行号` 且行号逐条实地核对；refs_valid=143 与 status.json 一致。
- quality.json：4 条（warn 2 / suggestion 2），每条含 file:line 与 ±5 行证据。
- 禁用词（可能/大概/似乎/应该/也许）：全文无。
- frontmatter：title/module/sources/date/issue 齐全；"来源"小节非空，列出 7 个种子文件。
