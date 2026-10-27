# ui-tokenstats 独立评审报告（critic）

- 条目：`ui-tokenstats`（Token 用量统计界面）
- Issue：#113
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 评审人：独立 critic（新 session）
- 日期：2026-10-01

## 一、facts.json 抽查

- facts 总数：181 条（顶层数组，键为 `fact`/`ref`）
- 抽查方式：`random.seed(113)` 随机抽样 35 条（编号 4,7,9,17,32,42,44,49,56,61,68,70,72,76,77,79,86,89,90,98,101,110,111,118,119,122,126,133,140,153,165,167,169,178,180），逐条 `sed` 拉源码窗口实地核对
- **命中：35 / 35，错位：0**
  - 断言与代码一致（如 #86 `stackTotalSelector` 取 `totalTokens.knownSum`、#118 `visibleAccent` 对比度阈值 `>= 3f` 回退内容色、#169 `HeatmapDragMode { VIEW, SCROLL }`），ref 行号处代码即断言主体
- 全量机械扫：181/181 ref 文件存在、行号合法、路径为仓库根相对全路径（`app/src/...`），无漂移

## 二、quality.json 核查

- 5 条 finding，severity 全为 suggestion，无 high（与 lint.md 自述一致）
- 逐条核 file:line 与 evidence：
  1. `TokenStatsCharts.kt:205` Paint 逐标签 new — 与源码 `:205` `android.graphics.Paint().apply` 一致
  2. `TokenUsageStatisticsScreen.kt:90` actionMessage 覆盖 — 与源码 `:90-92` Toast 逻辑一致
  3. `TokenUsageStatisticsViewModel.kt:362` 汇率无上限 — `:363` 仅 `isFinite() || <= 0.0` 校验，无上限，属实
  4. `TokenUsageStatisticsScreen.kt:668` 点击无无障碍语义 — `:668` `Modifier.clickable(onClick=...)` 无 role/semantics，属实
  5. `TokenStatsCharts.kt:384` 折线图循环内 new Paint — 与源码一致
- severity=suggestion 均合理；未发现编造

## 三、.md 结构与内容（SCHEMA §9）

- 六小节齐全：`## 概述 / ## AI 速览 / ## 核心机制 / ## 关键符号 / ## 调用链 / ## 来源`
- 术语人话：首次出现解释（Token 定义、"累计"含义），调用链用"输入→处理→输出"三段式编号
- 无禁用词（可能/大概/似乎/应该/也许）
- 正文引用另抽验 20 处（charts:79/261/564/259/70/71、screen:96/464、activity:94/104/166、dialogs:68/192/245/249、components:216/783/810/1294/1449、colors:75/102/142、VM:317/416），**全部命中**，无编造
- frontmatter 五键齐全（title/module/sources:9/date/issue:113）

## 四、status.json

- `refs_valid`: 181 = facts 数 ✓
- `status`: review-pending ✓
- `issue`: 113 ✓
- `source_commit`: 完整 hash `dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✓
- `source_repo`: operit ✓

## 五、lint

- `python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`：ui-tokenstats.* 无任何报错（0 硬失败 / 0 警告；tail 中的模糊词告警来自同批其他 writer 的 ui-assistant/ui-startup，与本页无关）

## 结论：FAIL（1 项必须修复）

### 必须修复清单

1. **`ui-tokenstats.quality.json` 字段名错误**：5 条 finding 用 `description` 字段，但 SCHEMA §8 与 `scripts/build_quality.py:43` 读的是 `detail`（`f.get("detail", "")`）。现状会导致评审站 quality.json 中本页 5 条发现的详情为空。修复：把 5 条的 `description` 键重命名为 `detail`，内容不变。

### 通过项

- facts 181 条：抽样 35/35 命中 + 全量 ref 机械校验 181/181 通过
- quality 5 条证据真实、severity 合理（只认真实性，不重做走查）
- md 结构符合 §9，无幻觉表述
- status.json 字段全部合规
- lint 0/0

修复字段名后即可通过（无需复审事实内容）。
