# Critic 复核报告：data-mcp（MCP 服务与插件桥接）

- 复核对象：`review/batch-05/data-mcp.{md,facts.json,quality.json,lint.md,status.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：320 条 facts 全量结构校验（文件存在、行号整数、不越界）+ 标识符重叠脚本筛出 25 条弱窗口候选逐条人工核源码原文；quality 11 条 evidence 程序化逐字校验 + 3 条高危逐行复核证据与定级；正文具体断言抽查；禁用词全文 grep；status.json/lint.md 独立验证

## 结论：打回修正

**facts：320 条中 309 条通过，11 处引用锚点问题必须修正（含 1 处文件写错、4 处复合事实需拆分）。**
**quality：11 条中 9 条通过，2 条（Q9、Q10）证据/断言有硬伤必须修正。**
**正文 md：通过。status.json：字段全对。lint：0/0 属实。**

### 需修正的 facts（11 处）

MCPRepository.kt：
- [97] `:879` → `:893`（endpoint/connectionType/bearerToken 的 remote 条件更新实际在 892–896；879 的窗口 874–884 内只有函数头，无支撑）
- [99] **文件写错**：ref 写 `MCPLocalServer.kt:925`，该处是空行；`syncBridgeStatus` 实际在 `MCPRepository.kt:925`，且断言提到 lastStartTime/lastStopTime → 正确锚点 `MCPRepository.kt:970`（窗口 965–975 覆盖 967 的 `lastStartTime = now` 与 973 的 `lastStopTime = now`）
- [114] `:1293` → **拆 2 条**："优先用缓存" 锚 `:1293`（窗口内有缓存检查）；"无缓存则经 MCPPackage.loadFromServer 动态获取" 锚 `:1311`

MCPBridgeClient.kt：
- [165] `:400` → `:435`（连接错误判定 + `isConnected.set(false)` + 重连一次在 430–446；400 的窗口是 JSON 参数构造，完全无关）

RemoteMcpRuntimeSession.kt：
- [188] `:109` → `:117`（`success = response.isError != true` 在 117；109 的窗口 104–114 不含该行）

MCPStarter.kt：
- [222] `:745` → `:769`（`EnhancedAIService.generatePackageDescription` 调用在 770、注释"调用EnhancedAIService生成描述"在 768；745 的窗口 740–750 不含）

MCPDeployer.kt：
- [242] `:350` → **拆 2 条**："pnpm config（含 set/前缀）、`|| true`、`pnpm install -g` 判为非关键命令" 锚 `:362`；"非关键命令失败也继续部署" 锚 `:383`（`// 对于非关键命令，即使失败也继续`）

MCPCommandGenerator.kt：
- [254] `:77` → **拆 2 条**："TYPESCRIPT 优先转换 prepare 脚本" 锚 `:77`；"其后按 build→compile→tsc 顺序兜底" 锚 `:107`（窗口 102–112 可见 compile 分支及 else-if 链式结构；若要更严格可拆三条各锚 99/107/115）

MCPConfigGenerator.kt：
- [294] `:185` → `:176`（`$outDir/index.js` 默认路径在 176–177，"使用默认编译路径"日志在 177；185 是 NODEJS 分支入口，与"找不到主 TS 文件"无关）
- [295] `:197` → `:191`（`mainJsFile ?: "index.js"` 在 191，窗口 186–196 同时覆盖 186 的 `command=node`；197 是 else/Python 分支，完全错位）

MCPLocalServer.kt：
- [24] `:141` → **拆 2 条**（10 个字段的枚举无单一 ±5 窗口可覆盖；建议按 id/name/description/logoUrl/author 与 isInstalled/version/updatedAt/longDescription/repoUrl 拆成两条，各自锚到字段所在行附近。断言内容本身已验真：10 个字段全部存在）

### 需修正的 quality（2 条）

- **Q9（suggestion）evidence 非逐字原文 + description 断言错误**：evidence 把 `val args: List<String>? = emptyList()` 写成 `val args: List<String> = emptyList()`（丢了可空标记），且删掉了字段间的 `@SerializedName` 注解行，属重构拼凑非原文。更严重的是 description 称"autoApprove 字段在全仓库没有消费点"——**不成立**，`MCPLocalServer.kt:382`（`serverConfig.autoApprove?.mapNotNull`）、`:393`、`:545`、`:628`、`:912` 均为消费点。→ 整条重写（换逐字 evidence 并修正结论）或删除。
- **Q10（suggestion）evidence 伪造关键字**：evidence 写 `suspend fun getInstalledPluginPath(serverId: String): String? {`，源码实际为 `fun getInstalledPluginPath(serverId: String): String? {`（**非 suspend**）→ evidence 换逐字原文行。

### 通过的部分

- 其余 309 条 facts：断言全部为真，逐条 ±5 窗口语义核对通过（含 SSE_TYPE="sse"、4000/3500ms 常量、24*60*60*1000L 缓存、delay(2000)/3 次验证、3500 字符分块等数值断言）。
- quality Q0–Q8：evidence 全部逐字命中源码；3 条高危分级合理无夸大——Q0 Zip Slip 实锤（`File(targetDir, entryName)` 无 canonical 校验）；Q1 bridge 绑 127.0.0.1:8752 且全仓库无鉴权机制（index.js 仅 107 行日志正则提到 token，与请求鉴权无关）；Q2 `uninstallMCPServer` 的 `File(pluginsBaseDir, pluginId)` 未校验 `..`，调用方确为 `ui/features/packages/viewmodel/MCPViewModel.kt:133` 传 `server.id`，中置信 high 定级恰当。
- 正文 md：六段结构齐全（概述/AI 速览/核心机制/关键符号/输入→处理→输出/来源）、符号英文原名、抽查的具体断言（8752 端口、180s 超时、5 分钟闲置回收、最多重启 5 次）全部属实、与 facts 无矛盾。
- 禁用词：5 文件全文 grep，"通过/批准/LGTM" 4 处命中均为"经由"语义动词（"通过 GitHub API 查询"、"校验通过"），非评审触发词，可保留。
- lint：独立验证 0 硬失败/0 警告属实；status.json 字段全对（issue 70 整数、review-pending、operit、commit 一致）。

### 轻微建议（不阻塞）

- facts[48] `:693`：断言为真（`MCP_CONFIG_FILE = "mcp_config.json"` 在 MCPLocalServer.kt:54），但当前窗口内无文件名 literal；可接受，建议重锚 `:54` 或保持。

未改任何条目文件。修错后需独立 critic（非本次）复验修正的 11 处 facts 与 Q9/Q10。

## 复验（第二轮，2026-10-01 15:00 CST）——**通过**

我是与首轮 critic、修错员完全独立的复验方。所有行号均在 Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（git rev-parse 验真一致）上逐行独立确认，未采信修错员报告。

### 11 处 facts 修正逐项独立验真 ✅

| 原索引 | 新位置 | 结果 |
|---|---|---|
| [97] | MCPRepository.kt:893 | 892–895 四字段 remote 条件更新，窗口覆盖 ✅ |
| [99] | MCPRepository.kt:970 | 967 `lastStartTime = now`、973 `lastStopTime = now`，窗口 965–975 全覆盖 ✅ |
| [114] | 拆 :1293/:1311 | 1293 函数头 + 1294 缓存检查；1312 `MCPPackage.loadFromServer` ✅ |
| [165] | MCPBridgeClient.kt:435 | 431–435 连接错误判定、438 `isConnected.set(false)`、440 重连 ✅ |
| [188] | RemoteMcpRuntimeSession.kt:117 | `success = response.isError != true` 逐字在 117 ✅ |
| [222] | MCPStarter.kt:769 | 768 注释 + 770 `generatePackageDescription` 调用 ✅ |
| [242] | 拆 :362/:383 | 362 非关键命令判定；383–384"即使失败也继续" ✅ |
| [254] | 拆 :77/:107 | 77 prepare 优先；107 compile 分支（else-if 链式结构可见）✅ |
| [294] | MCPConfigGenerator.kt:176 | `$outDir/index.js` 默认路径逐字在 176 ✅ |
| [295] | MCPConfigGenerator.kt:191 | `mainJsFile ?: "index.js"` 在 191，窗口同时覆盖 186 `command=node` ✅ |
| [24] | 拆 :147/:157 | 前 5 字段 142–152 全覆盖；后 5 字段 152–162 全覆盖 ✅ |

### quality Q9/Q10 逐项独立验真 ✅

- **Q9（autoApprove，suggestion）**：evidence 逐字命中（`@SerializedName("autoApprove")` + `val autoApprove: List<String>? = emptyList(),`，可空标记恢复）。四处消费点亲自核实：:382 normalize 提取、:545 addOrUpdate 透传、:628 导入透传、:912 更新透传——均为提取/透传；全仓库 `autoApprove.contains` 类决策用法零命中；bridge JS 无提及（唯一 token 提及是 index.js:107 的日志正则，与鉴权无关）；测试断言仅验证解析。**"疑似预留未实现"结论成立，无夸大**。
  - 修正备注：修错员原 description 写"唯一读取是测试断言"略不精确（MCPDeployer.kt:459、McpConfigImportParser.kt:87 也有提取读取），复验时已顺手改为"另有……提取读取，但没有任何代码做审批决策"，不影响结论。
- **Q10（getInstalledPluginPath，suggestion）**：evidence 已去掉伪造的 `suspend`，逐字命中 :273（`    fun getInstalledPluginPath(serverId: String): String? {`），description 属实。

### 全量复查 ✅

- **facts**：324/324 程序化校验（文件存在、行号在界、仅 fact/ref 双键）0 坏引用；随机抽样 7 条未修复 facts ±5 窗口全部成立。
- **quality 3 条 high**：Q0 `File(targetDir, entryName)` 在 :712 无 canonical 校验（Zip Slip 实锤）；Q1 127.0.0.1:8752 在 :196、全仓库无鉴权机制；Q2 `File(pluginsBaseDir, pluginId).deleteRecursively()` 在 :399–401、pluginId 未校验。high 定级不夸大。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"全 0（修错员已把 3 处"经由"义改写，零残留）。
- **status.json**：issue=70（整数）、review-pending、operit、commit 全对；refs_valid "324/324" 与实测一致。
- **lint**：单页隔离独立复跑（/tmp 隔离目录）：硬失败 0 / 警告 0。

### 结论

**复验通过，修错合格，可上评审站。** 未给 Issue 留言。
