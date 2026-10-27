# Critic 复核报告：core-tools-misc

- 复核对象：`review/batch-04/core-tools-misc.*`（专项工具：PhoneAgent/计算器/MCP/Skill/CLI 模式/条件）
- 源码版本：~/workspace/Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 git rev-parse 核对一致）
- 复核方法：134 条 facts 全部跑脚本校验（文件存在/行号越界/反引号符号 ±5 窗口），47 条脚本标记逐条人工看窗口核验；另抽查无反引号枚举类断言。quality 8 条逐条 diff 验证 evidence 逐字一致性。

## 结论：退回修正

**facts：134 条中 91 条通过 / 1 条事实错误 / 26 条引用错位 / 16 条轻微**

### 事实错误（1 条，必须重写断言）

- **[53]** `ExpressionParser.kt:280`：断言"`convert` 函数三参数被特殊处理：第 2、3 个参数存入 `_convert_from`/`_convert_to` 临时变量"**与源码矛盾**。实际代码（287–288）：`ExpressionContext.setVariable("_convert_from", 0.0)`——存的是 Double `0.0`，不是第 2、3 个参数（算出的 `fromUnit`/`toUnit` 局部变量被直接丢弃）；且 `setVariable(name, value: Double)` 只存 Double，而 `ExpressionContext.kt:212` 用 `variables["_convert_from"] as? String` 读取恒为 null → 抛 "from_unit not provided"。注意：writer 自己的 quality.json warning 已正确指出这个 bug，facts 却写反了。修正：断言改为"第 2、3 个参数被解析为 fromUnit/toUnit 但随后被丢弃，实际存入的是 Double 0.0，导致 convert 永远失败"之类如实表述。

### 引用错位（26 条，断言为真，ref 需重锚或拆分）

writer 习惯引用"代码段起点"而非"断言所在行"，导致支撑代码落在 ±5 窗口外：

| # | 现 ref | 问题 | 建议 |
|---|---|---|---|
| 7 | PhoneAgent.kt:624 | 前半句截图调用在 606 行，窗口无；且断言写 `AIService.sendMessage`，源码是 `uiService.sendMessage` | 拆成两条：截图→606；sendMessage→624 并改名 uiService |
| 9 | PhoneAgent.kt:641 | `executeAgentAction` 在 651 行，窗口外 | 拆分，第二条重锚 ~648 |
| 10 | PhoneAgent.kt:669 | `do(action=` 在 676 行，窗口外 | 重锚 ~672 或拆分 |
| 21 | PhoneAgentJobRegistry.kt:14 | `invokeOnCompletion` 在 ~24 行，窗口外 | 重锚 ~22 |
| 42 | JsCalculator.kt:37 | ref 落在空行；`calc` 函数在下方 | 重锚到 `fun calc` 实际行 |
| 43 | JsCalculator.kt:77 | 窗口是 formatDate 注释，单位列表在 ~99 行 | 重锚 ~99 |
| 44 | JsCalculator.kt:102 | 窗口是单位列表，日期函数在 ~112 行 | 重锚 ~114 |
| 45 | JsCalculator.kt:117 | 窗口是日期函数，统计函数在 ~130 行 | 重锚 ~130 |
| 46 | JsCalculator.kt:132 | 窗口是统计函数，JS 特性列表在更下方 | 重锚到 getSupportedJsFeatures 实际行 |
| 50 | ExpressionParser.kt:69 | `=`/`==` 区分在 ~78 行，复合赋值在 ~89 行 | 重锚 ~80 |
| 51 | ExpressionParser.kt:220 | `.length`→FunctionCallNode 在 234–239 行 | 重锚 ~236 |
| 54 | ExpressionParser.kt:377 | TemplateStringNode/未闭合抛错在 `parseTemplate` 函数体内 | 重锚到 parseTemplate 实际行 |
| 57 | ExpressionNode.kt:8 | **ref 落在空行** | 重锚到 sealed interface 声明（4 行）附近 |
| 58 | ExpressionNode.kt:30 | 1.0/0.0 与 IllegalArgumentException 在 36–48 行 | 重锚 ~40 |
| 59 | ExpressionNode.kt:141 | Double.NaN 在 ~150 行 | 重锚 ~150 |
| 64 | ExpressionContext.kt:170 | 窗口是 month/year，stdev 在 ~202 行 | 重锚 ~202 |
| 65 | ExpressionContext.kt:251 | 窗口是重量换算，factorial 在 270–272 行（断言内容已核实为真） | 重锚 ~271 |
| 71 | CliToolModeSupport.kt:90 | `limit` 参数在 137–142 行，窗口外 | 拆分或重锚 ~92（query）+ ~140（limit） |
| 79 | CliToolModeSupport.kt:139 | 窗口是 limit 参数 schema，buildCliModePrompt 在他处 | 重锚到 buildCliModePrompt 实际行 |
| 92 | MCPToolParameter.kt:90 | 窗口是有类型分支，无类型智能猜测在别处 | 重锚到无类型猜测分支实际行 |
| 93 | MCPToolParameter.kt:130 | 窗口是 true/false 回退，parseArray 在别处 | 重锚到 parseArray 实际行 |
| 96 | McpRuntimeSession.kt:32 | 窗口是 McpRuntimeCallResult，接口方法在 38–46 行 | 重锚 ~40 |
| 97 | McpRuntimeSession.kt:38 | getToolDescriptions 在接口更下方 | 重锚到该方法实际行 |
| 99 | MCPPackage.kt:38 | runBlocking 建连在 51 行 | 重锚 ~45 |
| 101 | MCPPackage.kt:91 | MCPToolParameter( 在 103 行 | 重锚 ~100 |
| 104 | MCPToolExecutor.kt:236 | 窗口是"格式化 JSON"函数的 KDoc，完全无关 | 重锚到 invoke 的 server_name:tool_name 校验实际行（~410） |

### 轻微（16 条，差几行或索引式引用，建议顺手重锚）

[12] 8 种动作动词枚举，ref:966 指向 when 起点（全枚举在 966–1142，来源节已给区间，facts 内建议注明范围）；[13] `[x,y]` 格式在 parseRelativePoint 实现（1220 行）不在窗口；[19] 函数名在 68 行，ref:78；[52] Math.PI/E 分支在 305–309，ref:300 窗口擦边；[55] TokenType 14 枚举（数量已数过=14，无误），ref:13 是注释行；[63] now() 在 127 行，ref:120；[72] params 参数在 116–121 行，ref:106；[74] 具体工具名经 SEARCH_TOOL_NAME 等常量（66–68 行）间接，ref:209 窗口只有跳过逻辑；[75] 四个目录来源在 buildHiddenToolCatalog 函数体下方，ref:189 只有函数头；[77] 100/40/25 分值在 ref:636 下方；[106] smartConvert 调用在 ~397 行，ref:380；[109] `<link>` 输出在 121 行，ref:115；[112] 文件名格式在 62 行，ref:55；[115] `getOrCreateSession` 函数名不在 ref:532 窗口（重连行为本身可见）；[121] 单例模式（getInstance 双重检查锁，14–23 行）不在 ref:30 窗口；[126] ref:168 指向 getSkillLoadErrors，getAvailableSkills 在 163 行。

## quality：8/8 通过

每条 evidence 第一行均与源码逐字一致且落在 ±5 窗口内，severity/confidence 合理。

- **high ×1（已实锤）**：ShowerBinderReceiver 广播注入。manifest 441 行 `exported="true"` + intent-filter；`ShowerBinderReceiver.onReceive` 对广播发送方无任何校验，直接取 intent extra 的 binder → `IShowerService.Stub.asInterface` → `ShowerBinderRegistry.setService`。任意第三方应用可伪造广播注入假 IShowerService，劫持 PhoneAgent 自动化输入输出。属实，建议保留。
- warning ×3：convert 存 0.0 致单位换算永远失败（与 fact[53] 错误形成对照，quality 是对的）；smartConvert 无类型声明数字字符串转数值；ExpressionContext 变量表无同步。
- suggestion ×4：动作参数正则逗号截断；ShowerController 实例 map 清理；SkillManager 全量扫盘；虚拟屏抓帧行填充丢余数像素。

## 正文：通过（1 处小问题顺手修）

§9 双受众结构完整（概述 / AI 速览 / 核心机制 7 节 / 关键符号 / 调用链 6 条输入→处理→输出三段式 / 来源精确到行区间），术语首现均有中文解释，符号名英文原文，frontmatter 完整。小问题：调用链与 fact[7] 写 "`AIService.sendMessage`"，源码实际变量名是 `uiService.sendMessage`（类型才是 AIService），建议统一为 `uiService.sendMessage`。

## status.json：正确

id=core-tools-misc、issue=25、status=review-pending、source_repo=Operit、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb 全对。critic 为空待填。注：writer 自加了 `refs_valid`/`summary` 备注字段，无害。

## lint：0 硬失败 / 0 警告（writer 自检报告，通过）

## 待办

writer 按上表修正 26 处重锚/拆分、重写 fact[53]、修 16 处轻微与正文 1 处变量名后，重跑 lint 即可；修正均为机械性，无需二次全文复核，但建议抽查复验 [53] 改写后的断言。

## 复检（2026-10-01 14:03 CST，修错后复验）

**结论：退回修正——4 条需重锚，其余全部通过。**

### 复验方法

1. **程序化全量校验**：156 条 facts 的 ref 文件存在、行号不越界——**0 失败**；无精确重复条目、无缺失 fact/ref 字段。用 lint.py 同款反引号符号规则扫描出 22 条"符号未在窗口"，逐条人工 sed 核验后确认为误报：均为类名前缀（如 `JsCalculator`）、函数名在窗口外 1–3 行但断言实质代码完全在窗内的形态，与 critic 原报告接受口径一致，不阻塞。
2. **改动 fact 抽查 35+ 条**：按退回清单逐条用 sed 导出 ±5 窗口核对，覆盖全部 26 条错位、16 条轻微中的 12 条、[53] 事实错误改写、全部拆分条目。
3. **重建完整性专项**：随机抽查 20 条未动条目（#0–#6、#14、#16、#18–#22、#24、#28–#32），fact/ref 与断言一致，窗口实质支撑——**重建无损坏、无丢失**。
4. **正文**：`uiService.sendMessage` 2 处已统一，全文 `AIService.sendMessage` 0 残留。

### 通过项（抽查确认）

- **[53] 事实错误改写准确**：新 #61（`ExpressionParser.kt:287`）"第 2、3 个参数被解析为 fromUnit/toUnit 后直接丢弃，实际存入 Double 0.0"——窗口 282–292 覆盖 fromUnit/toUnit 解析与两行 `setVariable(..., 0.0)`，且 `FunctionCallNode(identifier, listOf(args[0]))` 证实局部变量被丢弃；新 #62（`ExpressionContext.kt:212`）读取端 `as? String` 恒 null 抛错——窗口 207–217 逐字支撑。✓
- **拆分条目**：[7]→#7(:606 截图)/#8(:621 `uiService.sendMessage`，源码 623 行实锤 `uiService.sendMessage`)；[9]→#10(:641)/#12(:651 `executeAgentAction`)；[43]→#48/:89–#52/:139；[50]→#56/:80/#57/:91；[54]→#63/:401/#64/:571；[71]→#81/:92/#82/:140/#83/:69；[92]→#109/:118/#110/:127；[96]→#114/:41/#115/:52；[99]→#118/:51/#119/:54；[77]→#93/:639/#94/:646——窗口均实质支撑断言。✓
- **16 条轻微**：抽查 [12]/[13]/[19]/[52]/[55]/[77]/[106]/[112]/[115]/[121]/[126] 均已按建议重锚，窗口合规。✓

### 未通过条目（4 条，均为 ref 锚在列表头部、窗口盖不住列表尾部，需机械重锚）

| # | 现 ref | 问题 | 建议 |
|---|---|---|---|
| 50 | JsCalculator.kt:112 | 断言枚举 9 个日期函数，窗口 107–117 只覆盖 today/now/date/date_diff（114–117），date_add/weekday/month/year/day（118–122）在窗外 | **:117**（窗口 112–122 全覆盖） |
| 51 | JsCalculator.kt:126 | 断言枚举 6 个统计函数，窗口 121–131 只覆盖 mean/median/min（129–131），max/sum/stdev（132–134）在窗外 | **:129**（窗口 124–134 全覆盖） |
| 52 | JsCalculator.kt:139 | 断言枚举 7 个 JS 特性，窗口 134–144 只覆盖 4 个（141–144），赋值/指数/字符串索引/array.length（145–148）在窗外 | **:143**（窗口 138–148 全覆盖） |
| 96 | CliToolModeSupport.kt:168 | 断言"先 search 再 proxy，禁止直接调用隐藏工具"，窗口 163–173 只有函数声明与 "Only two public tools"，关键句 "Do not call hidden tools directly. Use `search` first…" 在 **176 行**，窗外 | **:173**（窗口 168–178 同时覆盖函数声明与 176 行关键句） |

4 条改完后重跑 lint 即可放行，无需再次全文复核。
