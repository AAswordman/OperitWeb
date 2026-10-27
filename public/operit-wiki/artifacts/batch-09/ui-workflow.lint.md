# ui-workflow lint 自检报告

- 检查文件：1（ui-workflow.md）
- 硬失败：0
- 警告：0
- frontmatter：title/module/sources/date/issue 齐全，来源小节存在，无死链
- 禁用词（可能/大概/似乎/应该/也许）：0 命中
- facts：169 条（100% 机器验真：结构、文件存在、行号越界、反引号符号 ±5 行窗口）
- 代码走查：8 条（warn 3 / suggestion 5），证据行号实地核对

## 首轮问题与修复

首轮 lint 报 171 条警告，全是"ref ±5 行未见符号"。根因：lint 按 ref 所在整行为单位校验，
把同一行内所有反引号符号逐一对每个 ref 校验；正文里一行挂多个 ref、符号与 ref 分属不同源码位置，
逐行 miss。修复：逐句拆散，一个 ref 独占一句，句内只保留该 ref ±5 行内的符号；关键符号节的引用
重锚到符号定义行（如 referenceEdges :92→:78、updateNodePosition :1548→:1535）；修掉 3 个旧锚点
（filteredToolNames :772→:759、setWorkflowEnabled :1182→:1176→:1179、ConnectionMenu 对话框行）。
迭代 4 次后 0 硬失败 / 0 警告。
