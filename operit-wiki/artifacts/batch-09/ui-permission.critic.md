# ui-permission 独立 critic 评审报告

- 条目：`ui-permission`（权限与 Token 配置界面），Issue #118
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 评审方式：facts.json 随机抽查 30 条（seed 118）逐条 sed 实地核对 + 全量 124 条符号锚定扫描；quality.json 8 条逐条核 evidence/severity；md 结构与禁用词；status.json；lint.py
- 结论：**FAIL**（2 处引用锚点错位 + 1 处事实文本不精确，必须修复后复验）

## 一、facts 抽查：30 条，命中 29 / 错位 1

抽查索引：[0, 2, 3, 12, 16, 18, 23, 26, 37, 38, 39, 42, 43, 46, 63, 65, 66, 72, 74, 77, 80, 87, 89, 91, 92, 98, 102, 105, 108, 110]。29 条命中，逐条核对窗口内断言与代码一致。

### 错位 1：fact#12（抽查命中问题）

- 断言：位置权限回调中 ACCESS_FINE_LOCATION 或 ACCESS_COARSE_LOCATION 任一授予即调用 viewModel.updateLocationPermission(true)
- 原 ref：`app/src/main/java/com/ai/assistance/operit/ui/features/permission/screens/PermissionGuideScreen.kt:142`
- 问题：:142 处是 `BASIC_PERMISSIONS_PAGE_INDEX -> viewModel.setCurrentStep(...)` 的翻页状态分支，与位置权限回调无关，完全错位
- 正确 ref：同文件 `:133`（窗口 128–138 覆盖 ACCESS_FINE_LOCATION:130、ACCESS_COARSE_LOCATION:131、`if (fineGranted || coarseGranted)`:132、`viewModel.updateLocationPermission(true)`:133）
- 修正建议：ref 改为 `:133`，断言文本无需改

### 错位 2：fact#78（全量扫描发现，抽查未覆盖）

- 断言：工具选择弹窗每行展示工具名与 toolHandler.getToolDescription(it) 的描述
- 原 ref：`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ToolPermissionSettingsScreen.kt:319`
- 问题：:319 处是搜索框 TextField 区域（`value = searchQuery` 等），行描述渲染不在该窗口
- 正确 ref：同文件 `:345`（窗口 340–350 覆盖 `text = toolName`:340 与 `text = descriptions[toolName] ?: toolName`:345；描述 map 构建在 :293 `allTools.associateWith { toolHandler.getToolDescription(it) }`）
- 修正建议：ref 改为 `:345`，断言文本可微调为"每行展示工具名与 descriptions[toolName] 描述（构建自 getToolDescription）"

### 不精确 1：fact#80（锚点正确，文本不精确）

- 断言：CompactPermissionLevelSelector 中 ALLOW/ASK/FORBID 分别映射 R.string.permission_level_allow/ask/forbid 文案
- 原 ref：同文件 `:397`（正确，窗口 396–399 覆盖全部三个分支）
- 问题：FORBID 实际映射的是 `R.string.forbid`（:399），不是 `R.string.permission_level_forbid`。`permission_level_forbid` 在 res 里确实存在，但选择器没用它
- 修正建议：fact 文本改为"ALLOW→R.string.permission_level_allow、ASK→R.string.permission_level_ask、FORBID→R.string.forbid"

### 全量扫描结论

124 条中除上述 2 处错位外，全部满足：文件存在、行号在界、断言符号落在 ±5 行窗口内。ref 全部为 `app/src/` 开头的仓库根相对全路径，keys 全部为 `fact/ref`。

## 二、quality.json 核查：8 条全部真实，severity 合理

- 5 warn / 3 suggestion，0 high，无 severity 通胀
- [0] pm 命令字符串拼接（:169）：`executeShellCommand("pm $action $packageName ${permission.rawName}")` 实锤；warn/security/medium 合理
- [1] 调试/错误占位行可被拨动并执行 pm 命令（:1438）：占位行 rawName="debug.info"/"error.info" 进同一 permissions 列表，经 PermissionItem→onToggle（:714）走 pm 命令路径，已实地确认调用链；warn/correctness/medium 合理
- [2] 用户配置 URL 未校验 scheme 即 loadUrl（TokenConfigWebViewScreen.kt:159）：`webView.loadUrl(urlConfig.signInUrl)` 前无校验；warn/security/medium 合理
- [3] 非白名单协议一律放行给 WebView（:130）：源码注释"对于其他协议（如javascript:, about:等），也让WebView处理"原文佐证；warn/security/medium 合理
- [4] 保存权限级别失败仅打日志（ViewModel:133）：catch 块只有 AppLogger.e，无用户反馈；warn/correctness/medium 合理
- [5] 底栏硬编码 Color.White（:211）：`color = Color.White` 实锤；suggestion/maintainability/high 合理
- [6] 从系统设置返回后权限状态不自动刷新（PermissionGuideScreen.kt:106）：checkPermissions 仅在 LaunchedEffect(Unit) 及运行时权限 launcher 回调（:120）、刷新按钮（:691 onRefresh）触发；无 OnResume/ON_RESUME 监听；suggestion/correctness/medium 合理
- [7] 标签匹配用子串 contains（:143）：`finishedUrl.contains(destination.url)` 实锤；suggestion/correctness/medium 合理

## 三、md 结构结论：符合 §9，禁用词 0

- 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源
- frontmatter 齐全：title / module / sources(7) / date / issue(118)
- AI 速览含核心符号清单 + 主入口 + 数据流向一句话；调用链 5 条均为"输入→处理→输出"编号
- 人话质量：三层权限拆分（系统权限/AI 工具权限/第三方应用权限）的叙事准确，与代码一致；无编造表述
- 全文无禁用词（可能/大概/似乎/应该/也许）
- 无 wikilink（无需断链检查）
- 注意：正文"来源"节自称"引用全部实地验真"——本轮 critic 发现 2 处错位，该自称不成立，修复后方可保留

## 四、status.json 结论：一致

- refs_valid=124 = facts 数 ✓
- status=review-pending ✓
- issue=118 ✓
- source_repo=operit、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb（完整 hash）✓

## 五、lint：0 硬失败 / 0 警告（本页）

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09` 全目录输出中无任何 `ui-permission` 相关报错；writer 自检报告（ui-permission.lint.md）同样 0/0。目录内其他报错均为其他 writer 文件，与本页无关。

## 六、必须修复清单（FAIL → 修复后复验）

1. fact#12 ref `:142` → `:133`（PermissionGuideScreen.kt）
2. fact#78 ref `:319` → `:345`（ToolPermissionSettingsScreen.kt）
3. fact#80 文本修正：FORBID 映射 `R.string.forbid`（非 `permission_level_forbid`）
4. md"来源"节"引用全部实地验真"的自称在修复前先去掉或改写，复验通过后再恢复

建议 writer 修复后对 fact#12、#78、#80 做针对性复验（重新拉窗口确认），其余 121 条本轮已确认无需重核。
