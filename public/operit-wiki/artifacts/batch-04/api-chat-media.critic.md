# Critic 复核报告：api-chat-media（多模态媒体链接与能力探测）

- 复核对象：`review/batch-04/api-chat-media.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 已核对一致）
- 复核方式：22 条 facts 逐条取 ref ±5 行窗口与源码 diff；1 条 quality evidence 逐字比对+"零引用"断言独立 grep 验证；正文结构与 status 人工检查
- **结论：退回修正（9 处引用问题，见下；断言本身全部为真，无虚构）**

## 总览

| 项 | 结果 |
|---|---|
| facts 22 条 | **13 通过 / 9 需修**（6 处窗口错位、2 处复合事实需拆分、1 处窗口差 1 行） |
| quality 1 条 | **1/1 通过**（evidence 逐字一致；"全仓库零引用"已用 grep 独立验证） |
| 正文 .md | §9 结构完整，通过（正文引用行号反而比 facts 更精确，无需改动） |
| .status.json | 通过（id / issue 54 / review-pending / source_repo=operit / source_commit 正确） |
| lint | 0 硬失败 / 0 警告（writer 自报，已见 .lint.md） |

## 必须修正（9 处）

说明：以下建议行号均为实测定位（sed 逐行核对），修正后每个新 ref 的 ±5 窗口完全支撑对应断言。

### 窗口错位（6 处，断言为真，只改 ref）

| # | 现 ref | 问题 | 建议 ref |
|---|---|---|---|
| [10] | `MediaLinkBuilder.kt:27` | 断言转义 5 个字符，第 5 个（`'`→`&apos;`）在 **33 行**，窗口（22–32）盖不住 | **:28**（窗口 23–33 全覆盖） |
| [14] | `MediaLinkParser.kt:70` | "经 `ImagePoolManager.getImage(id)` 取图，取不到跳过" 的关键行在 **76 行**，窗口（65–75）盖不住 | **:73**（窗口 68–78） |
| [15] | `MediaLinkParser.kt:89` | "只返回 id" 的 `ids.add(id)` / `return ids` 在 **95–98 行**，窗口（84–94）盖不住 | **:92**（窗口 87–97） |
| [17] | `MediaLinkParser.kt:118` | 去重 key（125）、file 无 fileName 跳过（127–128）、`MediaPoolManager.getMedia`（130）、`limitBase64ForAi`（131）全在窗口（113–123）外 | **:126**（窗口 121–131 全覆盖） |
| [20] | `MediaLinkParser.kt:184` | 断言含"最后 `&amp;`"，但 `.replace("&amp;","&")` 在 **190 行**，窗口（179–189）盖不住 | **:185**（窗口 180–190 全覆盖） |
| [21] | `MediaLinkParser.kt:58` | "提取 filename 属性并反转义，空白则为 null" 的函数体在 **64–68 行**，窗口（53–63）只到函数签名 | **:63**（窗口 58–68，覆盖正则+函数体） |

### 复合事实需拆分（2 处）

**fact [16]**（现 ref `:101`）：一个引用撑起三个函数——`removeImageLinks`（101）、`replaceImageLinks`（106）、`hasImageLinks`（116）。窗口（96–106）盖不住 116，且 `replaceImageLinks` 的 `"error"`→`""` 逻辑在 111–112 行也在窗口外。拆成 3 条：
- `removeImageLinks` 删除 image 链接 → ref `:101`
- `replaceImageLinks` 把 `"error"` 换成空串、其余调 `replacer(id)` → ref `:106`（窗口 101–111 全覆盖 106–112）
- `hasImageLinks` 判定是否存在 image 链接 → ref `:116`

**fact [19]**（现 ref `:163`）：同理，`replaceMediaLinks`（163）、`removeMediaLinks`（175）、`hasMediaLinks`（180）。窗口（158–168）只盖住 replace。拆成 3 条：
- `replaceMediaLinks`：`"error"` 换空串，非媒体类型原样保留 → ref `:163`
- `removeMediaLinks` 删除媒体链接 → ref `:175`（窗口 170–180）
- `hasMediaLinks` 判定是否存在媒体链接 → ref `:180`

### [18]：窗口错位

- 现状：ref `:145`，断言"extractMediaLinkTags：同样匹配去重，只产出不带 base64 的 MediaLinkTag"。窗口（140–150）只到循环开头；`tags.add(MediaLinkTag(...))` 在 **157 行**。
- 修正：ref 改为 **:152**（窗口 147–157，覆盖去重 key 152–153 与 tag 构造 157）。

## quality（1/1 通过）

- suggestion（`FILE_LINK_PATTERN_PLAIN` / `FILE_LINK_PATTERN_ESCAPED` 从未被使用）：evidence 4 行逐字命中 `MediaLinkParser.kt:48`。
- "全仓库零引用"断言：我用 `grep -rn` 全仓库独立验证，除两处声明行外确无引用，属实。
- severity suggestion/high（死代码清理价值）合理。

## 正文（通过，无需改动）

- §9 结构完整：概述 / ## AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制（3 小节）/ 关键符号（符号表，英文原名）/ 调用链（输入→处理→输出 3 步编号）/ 来源。
- 人话短句，术语首现均有解释（闭式探测）。
- 值得肯定：正文对 remove/replace/has 系列函数采用了**逐函数独立引用**（`:101`/`:106`/`:116`/`:176`/`:181`），比 facts.json 的复合引用更精确，无走查内容混入正文。

## status.json（通过）

`{id: api-chat-media, issue: 54, status: review-pending, source_repo: operit, source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb}` — 全部正确。

## 给 writer 的修正要求

1. 按上表修正 6 处 ref、拆分 fact [16]/[19]（拆完 facts 总数 22→26 条）、修正 fact [18]。
2. 修正后逐条用 sed 核实新 ref 的 ±5 窗口完全支撑断言。
3. 重跑 `scripts/lint.py` 保持 0/0，通知复检（只需复检本次列出的 9 处）。

## 复检（2026-10-01T13:58 CST，修错后复验）

**结论：通过**。critic 退回的 9 处已全部修正并经独立验真，无未通过条目。facts 22→26 条。

- **6 处重锚**：[10]:28（5 个转义字符 29–33 全覆盖）、[14]:73（error 跳过/去重/getImage 全覆盖）、[15]:92（ids.add/return 全覆盖）、[19]:126（去重 key/file 跳过/getMedia 全覆盖）、[20]:152（去重 key/tag 构造全覆盖）、[24]:185（5 个反转义全覆盖）、[25]:63（正则+函数体全覆盖）；另 [18]→:152 已验证。✓
- **[16] 拆 3 条**：removeImageLinks :101、replaceImageLinks :107、hasImageLinks :116，窗口各自完全支撑。✓
- **[19] 拆 3 条**：replaceMediaLinks :168、removeMediaLinks :175、hasMediaLinks :180，窗口各自完全支撑。✓
- lint：0 硬失败 / 0 警告（修错后重跑）。

### 两处行号争议的最终结论（修错员 vs critic 原建议）

1. **[17] replaceImageLinks — 修错员对（:107）**：`if (id == "error") "" else replacer(id)` 在 112 行；critic 建议的 :106 窗口（101–111）盖不住 112 行，修错员的 :107 窗口（102–112）全覆盖函数行为证据。
2. **[21] replaceMediaLinks — 修错员对（:168）**：`else if (id == "error") { "" }` 在 169–170 行；critic 建议的 :163 窗口（158–168）盖不住 169–170 行，修错员的 :168 窗口（163–173）全覆盖签名、非媒体原样保留、error→""、replacer。
