# Critic 复核报告：data-repo-misc（扩展仓库）

- 复核对象：`review/batch-05/data-repo-misc.{md,facts.json,quality.json,lint.md,status.json}`
- GitHub Issue：#64
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 一致）
- 复核方式：157 条 facts 全量行号存在性校验（文件存在、行号不越界、0 缺失）+ 关键词窗口重叠启发式筛出 14 条可疑逐条人工核 ±5 窗口 + quality 21 条 evidence 逐字比对 + 正文结构/断言抽查 + 全文禁用词 grep + lint.py 独立隔离重跑

## 结论：打回修正

**硬问题：12 条 facts 引用锚点错位（断言本身为真，锚点偏离 ±5 窗口）+ 1 条 quality 行号错位 + 9 条复合事实需拆分。**

### 一、facts 引用锚点错位（12 条，必须修）

| # | 原 ref | 正确锚点 | 说明 |
|---|--------|----------|------|
| [22] | AvatarRepository.kt:391 | **:404**（或 :406） | 断言"glTF 优先 .glb 其次 .gltf、跳过 .operit_ 前缀"为真；但扩展名过滤在 401–404、glb 优先排序在 406–407，原窗口 386–396 只含类声明 |
| [30] | AvatarRepository.kt:607 | **:613**（或 :615） | 断言"prefs 有记录、磁盘目录消失但原路径仍存在则保留"为真；关键谓词 `!existsOnDisk && pref.getBasePath()?.let { File(it).exists() } == true` 在 615 行，原窗口 602–612 不含 |
| [34] | AvatarRepository.kt:690 | **:712**（或 :718） | 断言"删除模型目录后同步更新配置列表；若删的是当前 Avatar 则回退到第一个可用配置"为真；`deleteRecursively()` 在 703、`updatedConfigs` 在 712、`updateCurrentAvatar(updatedConfigs.firstOrNull()?.id)` 在约 717，原窗口 685–695 只含函数签名与内置检查 |
| [41] | AvatarRepository.kt:925 | **:934** | 断言"单模型导入支持 .glb/.gltf/.mp4/.fbx 四后缀"为真；`normalizedExt` 四分支在 934，原窗口 920–930 不含 |
| [50] | WorkflowRepository.kt:216 | **:228**（或 :230） | 断言"写入用 android.util.AtomicFile，经 startWrite/finishWrite/failWrite"为真；`AtomicFile(file)`/`startWrite()` 在 227–228、`finishWrite`/`failWrite` 在 231–233，原窗口 211–221 不含 |
| [70] | WorkflowRepository.kt:909 | **:916**（或 :923） | 断言"冷启动触发扫描 triggerType 为 app_open 的节点、注入 trigger_source=cold_start_app_open"为真；`put("trigger_source", "cold_start_app_open")` 在 916、`triggerType == "app_open"` 在 923，原窗口 904–914 不含 |
| [71] | WorkflowRepository.kt:937 | **:965** | 断言"语音触发用 triggerConfig 的 pattern 正则匹配，支持 require_final/ignore_case/cooldown_ms"为真；`node.triggerConfig["pattern"]` 在 965、`require_final` 在 968，原窗口 932–942 不含 |
| [77] | WorkflowRepository.kt:687 | **:700** | 断言"执行状态更新把 lastExecutionStatus 与 lastExecutionTime 写回工作流文件"为真；`lastExecutionStatus = status, lastExecutionTime = executionTime` 在 700–701，原窗口 682–692 不含 |
| [84] | UIHierarchyManager.kt:107 | **:121** | 断言"launchProviderInstall 在 Android N 及以上用 FileProvider 生成 URI 发起 APK 安装"为真；`FileProvider.getUriForFile` 在 121–125，原窗口 102–112 不含 |
| [114] | SkillRepository.kt:260 | **:283** | 断言"isValidSkillId 额外拒绝 id 为单个点或双点"为真；函数在 283–284（`skillId != "." && skillId != ".."`），原窗口 255–265 不含 |
| [118] | SkillRepository.kt:294 | **:381** | 断言"downloadFromUrl 连接超时 15 秒、读取超时 30 秒，UA 伪装桌面浏览器，非 200 返回 false"为真（`CONNECT_TIMEOUT = 15_000` 在 30 行、`READ_TIMEOUT = 30_000` 在 31 行、UA `Mozilla/5.0 (Windows NT 10.0; …)` 与 `responseCode != HTTP_OK → false` 在 381–396）；但函数 `downloadFromUrl` 在 381 行，原 ref 偏离 87 行 |
| [119] | SkillRepository.kt:330 | **:414**（或 :428） | 断言"getGithubDefaultBranch 解析 GitHub 仓库 API 返回的 default_branch 字段"为真；函数在 414、`jsonObject.get("default_branch")` 在 428，原窗口 325–335 是另一函数的 URL 解析 |

### 二、quality 行号错位（1 条，必须修）

- **quality[7]**（warn）`SkillRepository.kt:294` → **:381**：evidence（`downloadFromUrl` 函数体前 4 行）逐字真实，但实际在 381–384 行，不在 294 行附近。断言"下载 zip 无大小上限"为真（函数体 381–407 全程无 Content-Length/累计字节检查，无界 `while(true)` 读流写文件）。

### 三、复合事实需拆分（9 条）

每条含 2 个以上独立断言，按铁律必须拆成原子事实（各断言本身为真，拆分后各自重新锚定）：

1. **[22]** "优先选择 .glb，其次 .gltf" + "跳过 .operit_ 前缀的内部文件" → 拆 2 条（分别 :406、:402）
2. **[34]** "删除模型目录后同步更新配置列表" + "若删除的是当前 Avatar 则回退到第一个可用配置" → 拆 2 条（分别 :712、:717）
3. **[35]** "renameAvatar 拒绝空白新名" + "新名与旧名相同时直接返回 true" → 拆 2 条（分别 :729、:734；注意第二条原窗口 722–732 差 2 行出窗）
4. **[37]** "ZIP 导入支持 UTF-8、GBK、GB18030、CP437 四种文件名编码" + "解码报 MALFORMED 时自动换下一种重试" → 拆 2 条（分别 :512、:1054；第二条的重试逻辑在 1054 行附近，原 ref 完全不覆盖）
5. **[59]** "createWorkflow 要求工作流 id 非空" + "启用且含 schedule 触发器时自动创建调度" → 拆 2 条（分别 :365、:375；`require(workflow.id.isNotBlank())` 在 365，`if (workflow.enabled && hasScheduleTrigger(workflow)) scheduleWorkflow(...)` 在 375–376）
6. **[85]** "bindToService 用 Mutex 串行化" + "经 resolveService 把隐式 Intent 显式化" + "绑定等待最多 3 秒超时" → 拆 3 条（分别 :198 `bindingMutex.withLock`、:209 `resolveService`、:223 `withTimeoutOrNull(BIND_SERVICE_TIMEOUT_MS)`，常量 `BIND_SERVICE_TIMEOUT_MS = 3000L` 在 42 行）
7. **[118]** "连接超时 15 秒、读取超时 30 秒" + "UA 伪装桌面浏览器" + "非 200 响应返回 false" → 拆 3 条（:30/:31 常量、:387–389 UA、:393–396 状态码分支）
8. **[120]** "tree 与 blob 链接可指定分支与子目录" + "blob 指向 SKILL.md 时取其父目录为技能子目录" → 拆 2 条（均在 336–344 窗口内，拆分即可）
9. **[130]** "deleteCustomEmoji 同时删除表情文件与元数据" + "id 不存在返回失败" → 拆 2 条（:150 函数签名、:153–155 `emoji_not_exist` 失败分支）

### 四、轻微问题（建议顺手修）

1. **`.lint.md` 第 12 行自指性提及"通过/批准/LGTM"**（引号内描述扫描动作）——建议改写为"禁用词与模糊词扫描干净"（与 data-api-oauth 同类问题同口径）。
2. **`.lint.md` 称"quality.json 14 条 evidence"**——实际 quality.json 有 21 条，走查数以文件实数为准，lint.md 数字需同步修正。
3. **quality[0] 与 quality[14] 是同一根因的重复发现**（`getWorkflowFile` 用 `File(dir, "$workflowId.json")` 未做路径消毒）：[0]（warn, conf 0.5）称"当前唯一创建点用 UUID，暂无可利用路径"，[14]（warn, conf 0.8）指出 `StandardWorkflowTools.kt:884` 的 `triggerWorkflow` 把 AI 参数 `workflow_id` 原样传入。我已亲手追链验证：`triggerWorkflow(id)` → `triggerWorkflowInternal`（WorkflowRepository.kt:603）→ `getWorkflowById(id)`（:316）→ `getWorkflowFile(id)`（:164），AI 可控 id 确实直达路径拼接（`..` 可逃逸，读侧限于 `*.json` 后缀）。建议合并两条或修正 [0] 的"暂无可利用路径"表述（读路径可达，写路径确为 UUID）。分级 warn 可接受（利用需先经提示注入操纵模型工具参数，影响限于 `.json` 后缀文件读取），不要求提 high。
4. **[9]** "情绪/心情/自定义心情三映射分别存于 data 的三个键"——三键枚举属同一模式，结构上可接受不拆，仅备注。

## 通过项

- **引用存在性**：157/157 ref 文件存在、行号不越界、格式正确；除上表 12 条外其余 145 条窗口支撑有效（含人工复核的 [33] 内置拒绝删除、[102] GlobalScope IO、[117] 导入失败删目录、[128] 表情白名单、[155] 黑名单 8 秒超时、[53] 30 个执行记录上限）。
- **断言真实性**：12 条错位锚点的断言内容全部为真（已逐条对照源码确认）；数字断言抽查：6 个 Avatar delegate（`AvatarPersistenceDelegate` 实现确为 6 个，Fbx 跨 431–433 行声明）、4 种 ZIP 文件名编码、15s/30s 超时常量、8 秒黑名单超时——全部属实。
- **quality**：21 条（warn 14 / suggestion 7，高危 0）中 20 条 evidence 在行号附近逐字命中；分级整体合理无夸大。重点复核：[3] 黑名单无签名校验（warn 合理）、[13] isBuiltIn 死逻辑（warn 合理）、[15] 工作流 JSON 存公共 Download 目录（warn 合理）、[17] 按包名信任外部 App 未验签名（warn 合理）。
- **正文**：结构齐全（概述 / ## AI 速览 / 核心机制 6 节 / 关键符号 / 输入→处理→输出调用链 / 来源）；符号名英文原名；正文无禁用词残留、无模糊词（可能/大概/似乎/应该/也许 0 命中）；来源小节 7 个文件行数标注与源码 `wc -l` 逐一核对一致；正文断言与 facts 无矛盾。
- **status.json**：`issue: 64`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb` 全部正确；`critic` 为空待填。注：`refs_valid` 称"157/157 引用行号真实存在"——行号存在为真，但 12 条锚点窗口错位，修错后需更新该字段为复验结果。
- **lint**：critic 独立隔离重跑 `scripts/lint.py`（条目文件复制到 /tmp 临时目录，避开 .lint.md 自扫）：检查文件 1，**硬失败 0 / 警告 0**。

## 打回清单（修错员需改）

| # | 位置 | 改法 |
|---|------|------|
| 1–12 | facts[22][30][34][41][50][70][71][77][84][114][118][119] | 按上表重锚（新行号均已亲手验真 ±5 窗口支撑） |
| 13 | quality[7] | line :294 → :381 |
| 14–22 | facts[22][34][35][37][59][85][118][120][130] | 拆分为原子事实（见第三节） |
| 23 | .lint.md | 第 12 行改写自指措辞；"14 条 evidence"→"21 条" |
| 24 | quality[0]/[14]（建议） | 合并或修正 [0] 的"暂无可利用路径"表述 |
| 25 | .status.json | refs_valid 更新为修错后复验结果 |

修完后请 parent 派**独立** critic（非本次）复验全部 12 处新锚点与拆分条目；修错员自报不能放行。

---

## 复验（第二轮，2026-10-01）——结论：**通过** ✅

复验人：与首轮 critic、修错员完全独立的第二位 critic。源码 Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 一致），未采信修错员自报，逐项亲自核源码。

### 修错项逐项复核（全部 ✅）

**12 处重锚**（±5 窗口逐个 awk 导出人工比对）：
- [30]:615 ✅（保留谓词 `!existsOnDisk && pref.getBasePath()?.let { File(it).exists() } == true`）
- [41]:934 ✅（四后缀 when 分支）
- [50]:228 ✅（AtomicFile startWrite，231–233 finishWrite/failWrite）
- [70]:916 ✅（`put("trigger_source", "cold_start_app_open")`；923 行 app_open 过滤在窗外，但 912 行日志"cold-start app-open-triggered workflows"语义支撑）
- [71]:965 → **改为 :968**（见下）
- [77]:700 ✅（`lastExecutionStatus = status, lastExecutionTime = executionTime`）
- [84]:121 ✅（FileProvider.getUriForFile 在 123–126，N 及以上分支在 122）
- [114]:283 ✅（`skillId != "." && skillId != ".."`）
- [119]:414 → **改为 :428**（见下）
- [22]→:406/:402 ✅、[118]→:30/:388/:394 ✅（拆分一并重锚，全部窗口支撑）

**9 处拆分**（全部确认单断言、各自锚定）：
- [22] :406（glb 优先排序）/:402（跳过 .operit_）✅
- [34] :712（更新配置列表）/:717（回退首个可用）✅
- [35] :729（空白拒绝）/:734（同名返回 true）✅
- [37] :512（四种编码）/:1054（MALFORMED 重试）✅
- [59] :365（id 非空）/:375（schedule 调度）✅
- [85] :198（Mutex）/:209（resolveService）/:223（3 秒超时）✅
- [118] :30（超时常量）/:388（UA）/:394（非 200 返回 false）✅
- [120] :340（分支子目录）/:341（SKILL.md 父目录）✅
- [130] :161/:154 ✅——**修错员的有据偏离成立**：:161 的 ±5 窗口（156–166）同时覆盖 160 行 `file.delete()` 与 164 行 `preferences.deleteCustomEmoji`，:150 的窗口（145–155）确实覆盖不到元数据删除，偏离更精确。

**复验员追加的 3 处锚点优化**（已直接修正并同步正文 md 行内引用）：
1. **facts[76]** :965 → **:968**：原窗口 960–970 只覆盖 pattern（966）与 require_final（969），漏掉断言中的 ignore_case（972）与 cooldown_ms（973）；:968 的窗口 963–973 同时覆盖四处。
2. **facts[128]** :414 → **:428**：断言 operative 词是"解析 default_branch 字段"，:414 窗口只见函数签名与 GitHub API URL，`jsonObject.get("default_branch")` 实际在 428 行；:428 窗口 423–433 精确命中。
3. **facts[156]** :141 → **:146**：断言含 schemaVersion/version/指针版本/hashAlgorithm 四项，:141 窗口 136–146 漏掉 147 行的 hashAlgorithm 校验；:146 的窗口 141–151 全部覆盖（hashAlgorithm == "sha256" 常量在 209 行已核实）。

**quality**：
- [7] :381 ✅ evidence 逐字原文；"下载 zip 无大小上限"为真（381–407 无界 `while(true)` 读流，无 Content-Length/累计字节检查）
- [0] 合并项 ✅ evidence 逐字原文；调用链亲手追链验真：StandardWorkflowTools.kt:883 取 AI 参数 `workflow_id`（仅判空）→ :898 `workflowRepository.triggerWorkflow(workflowId)` 原样传入 → WorkflowRepository.triggerWorkflow:552 → triggerWorkflowInternal:603（`getWorkflowById(id)` :608）→ getWorkflowById:316（`getWorkflowFile(id)` :318）→ getWorkflowFile:164（`File(dir, "$workflowId.json")` 未消毒）。**读侧与执行状态写回均可达**（:700 `updateExecutionStatus` 经同一 id 写文件），description 称"读取/覆写存储目录内任意 .json 文件"不夸大；warn 分级合理（利用需先经提示注入操纵模型工具参数）。
- 20/20 evidence 逐字命中源码；warn 13 / suggestion 7 / 高危 0，分级无夸大。

### 全量复查
- 168/168 facts：文件存在、行号不越界、无重复锚点；随机抽样 12 条未修复 facts 全部窗口支撑成立
- 正文 md：结构齐全（概述/AI 速览/6 节核心机制/关键符号/调用链/来源）；符号英文原名；17 处行内引用已同步（含本次 3 处）；禁用词"通过/批准/LGTM" 0 命中；模糊词 0
- status.json：issue 64（整数）、review-pending、operit、dbf71916… 全对；`critic` 字段已填"独立 critic 初验打回后修错，独立复验通过（data-repo-misc.critic.md）"
- lint 单页隔离独立重跑（--src ~/workspace/Operit）：**硬失败 0 / 警告 0**

**本页评审闭环完成，可随整批上评审站。**
