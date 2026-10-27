# Critic 报告：ui-settings-model（Issue #97）

- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse` 已核对一致）
- 方法：121 条 facts 逐条拉 ref file:line ±5 行窗口核对（索引 0–59 由主 critic 实地验，60–120 由子 critic 实地验，结论合并）；计数/穷举类断言用 grep 独立复核；10 条 quality evidence 程序化逐字（含缩进）比对 + 行锚核对；lint 隔离重跑；禁用词 grep；正文计数核对。
- 汇总：**PASS 105 / DRIFT 13 / FALSE 1 / COMPOSITE 2**

## 最终 verdict：FAIL

1 条事实错误 + 13 处锚点漂移 + 2 条复合断言需拆分 + 正文缺计数声明。修完需独立复验。

---

## 一、机械项

- facts 121 条 = `status.json refs_valid: 121` ✓；severity 只为 high/warn/suggestion（2/6/2）✓
- lint 隔离重跑：**0 硬失败 / 0 警告** ✓
- frontmatter `sources: 8`；种子 8 文件 `wc -l` 合计 **11,349 行**，与正文一致 ✓
- 禁用词：1 处误报——facts.json:151 "Key 池导出通过 ActivityResultContracts…" 的"通过"是"经由"义动词，非评审表态；属良性，建议修错时顺手改为"经由"避嫌（非阻塞）
- 正文 `## 来源` 小节**缺数量声明行**（batch-06 惯例）：须补"原子事实 121 条；代码走查 10 条（高危 2 / 警告 6 / 建议 2）"——必须修

## 二、quality（10 条，全部实锤）

10 条 evidence 经程序化逐字比对：**10/10 与源码逐字一致（含原始缩进），行锚全部精确命中**。severity 合规。

- high 2：Q0 `flushSettings` 日志打 `apiKey.take(5)`（:330）；Q1 ≤8 位 Key 明文显示（ApiKeyVisualTransformation.kt:21）
- warn 6：Q2 Key 池明文导出（:173）、Q3 聚焦时明文（:761）、Q4 `flushAllInBackground` 静默吞异常（:99）、Q5 非法输入归 0（:157）、Q6 列表项露 Key 末 4 位（:640）、Q7 编辑对话框默认名带末 4 位（:710）
- suggestion 2：Q8 "1.3" 硬编码（:1479）；Q9 `exportTavernPngBytes` 全仓库 grep 确认只被赋 null、从未被读取（:170、:927、:1724、:1788、:1826），死状态成立

## 三、FALSE（1 条，必须修）

**[16]** `ModelApiSettingsSection.kt:304`：事实错误。
断言称"llama 线程数小于 1 则取 4，上下文大小小于 1 则取 2048"。
源码实际（:313–315）：
```kotlin
llamaThreadCount = llamaThreadCountInput.toIntOrNull()?.coerceAtLeast(1) ?: 4,
llamaContextSize = llamaContextSizeInput.toIntOrNull()?.coerceAtLeast(1) ?: 2048,
llamaGpuLayers = llamaGpuLayersInput.toIntOrNull()?.coerceAtLeast(0) ?: 0,
```
输入 "0" → `coerceAtLeast(1)` → **1**，不是 4/2048；只有非数字/空输入才取 4/2048。断言应改为：
"llama 线程数/上下文：非数字取 4/2048，小于 1 取 1（coerceAtLeast(1)）；GPU 层数小于 0 取 0（coerceAtLeast(0)）"。GPU 子断言为真。

## 四、COMPOSITE（2 条，必须拆分）

**[30]** `ModelApiSettingsSection.kt:1382`：两独立断言——①额度进度条 `remainingPercent/100f`（:1382）；②重置倒计时按 60 秒 tick 刷新（实际在 :185–189 `LaunchedEffect(codexUsage)` 内 `delay(60_000L)`，刷新 `codexUsageNow`）。拆成两条，各给正确锚点。

**[35]** `AdvancedSettingsSection.kt:157`：两独立断言——①输入只保留数字字符（实际在 :313/:327 `it.filter { ch -> ch.isDigit() }`）；②非法输入 `toIntOrNull()?.coerceAtLeast(0) ?: 0` 按 0 处理（:157）。拆成两条。

## 五、DRIFT（13 条，断言为真、锚点漂移，实地核对后给出正确行号）

| fact | 原 ref | 正确行号 | 说明 |
|---|---|---|---|
| [19] | :761 | :754 | 去空格换行在 onValueChange（:754–755），不在 :761±5 内 |
| [31] | :60 | :340 | 隐藏 Key 池 UI 在 `if (!isCodexProvider)`（:340），:60 只是布尔定义 |
| [96] | :90 | :2056 | 预设按名合并/同名覆盖在 `headerPresets.forEach` 下拉 onClick（:2052–2061） |
| [97] | :1942 | :1948 | 防抖自动保存 `DebouncedModelConfigAutoSaveEffect` 在 :1948，落在原窗口外 |
| [99] | :2191 | :2172 / :2340 | 非法输入校验在 :2168–2177；单位 "K" 在 :2340/2355 |
| [100] | :2223 | :2242 | (0,1) 开区间与消息数 > 0 校验在 :2238–2247 |
| [107] | :358 | :385 | 二维码裁剪 `cropToQrRegion` 在 :385，多档缩放在 :395–397 |
| [109] | :3477 | :3484 | tEXt chunk 类型字节 `byteArrayOf('t','E','X','t')` 在 :3484 |
| [110] | :3305 | :3317 | 标签导入格式校验在 :3317–3319，小写匹配在 :3354 |
| [113] | :634 | :694 | 删除路径的提示对话框在 :694（:634 只覆盖改名路径） |
| [115] | :769 | :775 | 回退默认角色卡动作在 :775–777（原窗口只到条件行） |
| [119] | :66 | :53 | 搜索过滤（名/描述/tags 忽略大小写）在 :49–56 |
| [120] | :274 | :401 | "URL 为空禁用下载按钮" `enabled = downloadUrl.isNotEmpty()` 在 :401 |

## 六、PASS（105 条，抽样列举关键复核）

- 计数/穷举类全部 grep 复核无误：连接测试 5 项（ModelConnectionTestType 恰 5）、测试结果 3 态（恰 3）、就绪问题 7 项（[76]+[77]=枚举全部成员）、思考匹配方式 9 种（列表闭合恰 9）、排序选项/导出模式各 3 项、ApiAutoSaveState 恰 18 字段（val 计数 18）、7 标准采样参数 when 分支 7 项、主列表 6 区块 item 顺序逐个核对（791→802→811→820→828→837）
- 高危 facts 实锤：[17] 日志 `apiKey.take(5)`（:332）；[1][2] ApiKeyVisualTransformation 遮盖逻辑（:14/:22）
- 其余窗口支撑结论一致，不再逐条罗列。

## 七、需修清单（转交修错员）

1. 修 [16] 事实错误（按第三节改写断言）
2. 拆分 [30]、[35]（facts 121→123 条，同步 status.json refs_valid、正文计数、frontmatter 无需动）
3. 修正 13 处 DRIFT 锚点（按第五节表格，修错员须逐条实地再核对一次）
4. 正文 `## 来源` 补数量声明行："原子事实 123 条；代码走查 10 条（高危 2 / 警告 6 / 建议 2）"（按拆分后实际条数）
5. 可选：facts.json:151 "导出通过"→"导出经由"（避嫌，非阻塞）

修完后需第二名独立 critic 复验（重点复核 FALSE/COMPOSITE/DRIFT 类），再走 build→deploy→公网验证。本报告未改动任何交付文件。
