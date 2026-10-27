# ui-permission 针对性复验报告（critic2）

- 条目：`ui-permission`（权限与 Token 配置界面），Issue #118
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 复验范围：首轮 critic 指出的 3 处修正（注：critic 报告用 0-based 编号 fact#12/#78/#80，对应 JSON 1-based fact#13/#79/#81）+ 随机抽查 5 条 facts + md 正文一致性
- 结论：**FAIL（窄）**——3 处 facts 修正全部精确命中；但 md 正文有 2 处行号引用仍是修正前的旧值，与已修正的 facts 不一致，需同步改

## 一、3 处修正逐条核对（sed 实地）

### 修正 1：fact#13（critic 0-based fact#12）
- fact：位置权限回调中 ACCESS_FINE_LOCATION 或 ACCESS_COARSE_LOCATION 任一授予即调用 viewModel.updateLocationPermission(true)。
- ref：`.../permission/screens/PermissionGuideScreen.kt:133`
- 实地（:125–135）：`:130 permissions[ACCESS_FINE_LOCATION]`、`:131 permissions[ACCESS_COARSE_LOCATION]`、`:132 if (fineGranted || coarseGranted)`、**`:133 viewModel.updateLocationPermission(true)`**
- 结论：**命中** ✓

### 修正 2：fact#79（critic 0-based fact#78）
- fact：工具选择弹窗每行展示工具名与 toolHandler.getToolDescription(it) 的描述。
- ref：`.../settings/screens/ToolPermissionSettingsScreen.kt:345`
- 实地（:338–348）：`:340 text = toolName`、**`:345 text = descriptions[toolName] ?: toolName`**；描述 map 构建于 `:293 allTools.associateWith { toolHandler.getToolDescription(it) }`
- 结论：**命中** ✓（critic 建议的文本微调为可选项，未采用不影响正确性：渲染值确由 getToolDescription 构建）

### 修正 3：fact#81（critic 0-based fact#80）
- fact：CompactPermissionLevelSelector 中 ALLOW/ASK 分别映射 R.string.permission_level_allow/permission_level_ask，FORBID 映射 R.string.forbid。
- ref：`.../settings/screens/ToolPermissionSettingsScreen.kt:399`
- 实地（:396–399）：`:397 PermissionLevel.ALLOW -> stringResource(R.string.permission_level_allow)`、`:398 ASK -> R.string.permission_level_ask`、**`:399 FORBID -> stringResource(R.string.forbid)`**
- 结论：**命中** ✓

## 二、随机抽查 5 条（JSON 未被改坏）

| fact | ref | 实地 | 结论 |
|---|---|---|---|
| #1 | PermissionGuideScreen.kt:83 | `:83 private const val INTRO_PAGES_COUNT = 3` | 命中 ✓ |
| #30 | PermissionGuideScreen.kt:304 | `:304 Settings.ACTION_MANAGE_OVERLAY_PERMISSION` | 命中 ✓ |
| #60 | PermissionGuideViewModel.kt:141 | `:141 fun updateLocationPermission(granted: Boolean)` | 命中 ✓ |
| #100 | AppPermissionsScreen.kt:1503 | `:1503 private fun extractPermissionsFromSection(section: String, permissions: MutableSet<String>)` | 命中 ✓ |
| #124 | MainActivity.kt:620 | `:620 PermissionGuideScreen(`（引导流程分支内） | 命中 ✓ |

- facts 数 = 124，`.status.json` refs_valid = 124，相等 ✓
- ref 全部为 `app/src/` 开头仓库根相对全路径，keys 全部为 `fact/ref` ✓

## 三、md 正文一致性（grep）

- **错位 A（md:69）**：正文写"位置授权回调里精或粗任一授予即 `viewModel.updateLocationPermission(true)`（`:142`）"——`:142` 是首轮 critic 已判错位的旧行号，实际调用在 **`:133`**（与已修正 fact#13 不一致）。需改为 `:133`。
- **错位 B（md:97）**：正文写"每行展示工具名与 `getToolDescription(it)` 描述（`:319`）"——`:319` 是搜索框 TextField 区域（`value = searchQuery`），描述渲染实际在 **`:345`**（`descriptions[toolName]`，与已修正 fact#79 不一致）。需改为 `:345`。
- md:99（`:371` FlowRow、`:397` 映射文案）：`:397` 落在 when 分支窗口（396–399）内，可接受；与 fact#81（`:399`）指向同一代码块，无实质矛盾。
- md:183"来源"节仍自称"引用全部实地验真"：facts.json 层面现已成立；待上述 2 处 md 行号同步后，该自称对正文亦成立。

## 四、必须修复清单（FAIL → 改后即过）

1. `ui-permission.md:69`：`:142` → `:133`
2. `ui-permission.md:97`：`:319` → `:345`
3. 改完后无需重跑全量 critic，针对性确认 2 处行号即可

## 结论

**FAIL（窄）**：3 处 facts 修正全部精确命中源码，JSON 文件完好（124/124）；仅 md 正文 2 处行号引用未同步修正。修完即 PASS。
