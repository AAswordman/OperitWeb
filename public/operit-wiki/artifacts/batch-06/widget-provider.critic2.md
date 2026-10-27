# Critic2 复验报告：widget-provider（Issue #82）

- 复验对象：`review/batch-06/widget-provider.{md,facts.json,quality.json,lint.md,status.json}`（修错后版本）
- 源码：`~/workspace/Operit @ dbf71916`（HEAD 已确认一致）
- 复验方式：critic.md 6 项清单逐项核对 + 33 条重定位 facts 全量窗口验真 + 随机 30 条 facts 抽查 + quality 13 条 evidence 逐字比对 + 正文/禁用词/lint/status 核对。
- **总体 verdict：FAIL**（critic 指出的 6 项已全部修到位；复验发现 2 条新的行号漂移，需修错员修正）

## 一、critic.md 6 项清单复验（全部修到位）

1. facts [29]/[30]："10 个偏好键"✓，ref 分别为 `:79`（`.commit()`）/`:96`（`.apply()`）✓（按 critic 建议值）。
2. facts [115]："13 个字段"✓，ref `:843`✓（13 个 `obj.put` 已数过）。
3. 正文连带：全文"14 个字段"0 处、"11 个字段"0 处✓；"13 个字段"出现在核心机制链路（md:53）✓。
4. facts 行号重定位 33 条：ref 行号与 critic 报告"正确行"列逐条一致（含修错员微调的 [72]:353、[75]:407，均更精确）；33 条 ±5 窗口逐条验真，断言全部被支撑（8 条纯中文断言人工看过窗口：[48] 标题/副标题、[93] Root→记忆空间、[111] 跨空间移动抛错、[129] 目录拒绝打开、[130] deleteRecursively、[131] 父目录校验、[135] 根显示包名、[144] 直接拼接路径，均命中）。
5. quality.json 12 条行号修正：与报告期望值逐条一致（[0]:266、[1]:192、[2]:172、[3]:178、[4]:145、[5]:79、[6]:118、[7]:1060、[9]:385、[10]:236、[11]:224、[12]:83）；[5] description 已改为"10 个键"✓。
6. lint：0 硬失败 / 0 警告✓；5 文件禁用词 0 命中✓；模糊词 0 命中✓；severity 仅 high/warn/suggestion✓；顶层数组格式✓。

## 二、复验中新发现的问题（2 条，均须修）

### R1. facts [79]：ref 窗口差 1 行
- 原文："启动时带上 INITIAL_MODE 为 FULLSCREEN 与自动进入语音聊天标志。"（ref `VoiceAssistantGlanceWidget.kt:77`）
- 实际：`putExtra("INITIAL_MODE", ...)` 在 **71 行**，`EXTRA_AUTO_ENTER_VOICE_CHAT` 在 72 行；ref :77 的 ±5 窗口为 72–82，71 行落在窗口外 1 行。
- 修正：ref 改为 **:72**（窗口 67–77，同时覆盖 71/72 两行）。

### R2. facts [46]：ref 窗口不支持断言
- 原文："无可用小组件时显示 toolpkg_widget_picker_empty_title 与 body。"（ref `ToolPkgDesktopWidgetConfigActivity.kt:133`）
- 实际：`toolpkg_widget_picker_empty_title` 在 **147 行**，`toolpkg_widget_picker_empty_body` 在 **151 行**；ref :133 的窗口 128–138 只覆盖到 `if (widgets.isEmpty())`（138 行），两个字符串资源均在窗口外。
- 修正：ref 改为 **:149**（窗口 144–154，同时覆盖 147/151 两行）。

## 三、其余抽查（全部通过）

- **facts 随机 30 条**（seed=82，避开 33 条重定位与 [29][30][115]）：25 条关键词窗口命中；5 条纯中文/关键词缺失人工看过窗口——[20] 110dp（xml:4 ✓）、[102] text/plain 写回（:797 ✓）、[109] Profile 重命名更新名称（:509，`updateMemorySpace(profile.copy(name = cleanName))` 在 515 行，窗口内 ✓），除 R1/R2 外无问题。
- **quality 13/13**：evidence 全部与源码逐字比对命中；3 个 high 评级合理（Workspace 路径穿越可读写任意应用私有文件；isChildDocument `startsWith` 无分隔符误判；deleteDocument 非递归删含文件目录失败）；file:line 全部准确（修错后）。
- **正文**：固定结构完整；行内引用抽查准确；10 个种子文件全覆盖；走查未写入正文。
- **status.json**：`issue: 82`、`source_repo: operit`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、`status: review-pending`、`refs_valid: 146`（=facts 实际条数）全部正确；`critic` 为空待 parent 闭环后填写。

## 四、修错清单（修错员）

1. facts [79]：ref `:77` → `:72`。
2. facts [46]：ref `:133` → `:149`。

两条均为单行 ref 移动，facts 数无变化，status.json 无需更新。修正后重跑 lint 确认 0/0 即可；改动微小，无需第三轮全量 critic（由 parent 决定）。

**verdict：FAIL**（2 条行号漂移待修，见 §四）
