# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 自检说明

- 运行：`python3 scripts/lint.py --src ~/workspace/Operit --dir <仅含 ui-floating.md 的临时目录>`
- 首轮 33 警告：均为正文断言的反引号符号不在引用行 ±5 行内，已逐条拆分断言、重锚到符号出现的行（声明行↔属性行分离、单断言单引用），复检通过。
- 第二轮 5 警告：主语符号与属性行错位，去掉主语反引号（关键符号表保留声明行锚点），复检 0 硬失败 / 0 警告。
- facts.json：138 条，全部为 {"fact","ref"} 结构；ref 全部匹配 `app/src/...kt:行号` 且行号逐条实地核对；自写脚本验真：138 条 ref 文件存在且行号有效；refs_valid=138 与 status.json 一致。
- quality.json：8 条（warn 4 / suggestion 4），每条含 file:line 与 ±5 行证据，severity 仅用 high|warn|suggestion。
- 禁用词（可能/大概/似乎/应该/也许）：全文无。
- frontmatter：title/module/sources/date/issue 齐全；"来源"小节非空，列出 28 个种子文件行数。
