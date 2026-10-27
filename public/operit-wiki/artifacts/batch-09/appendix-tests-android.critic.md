# critic 评审报告：appendix-tests-android（Issue #124）

- 评审人：独立 critic（新 session）
- 评审时间：2026-10-01
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb（已核对 git rev-parse）
- 结论：**FAIL（需修改，1 项必须修复）**

## 1. facts 抽查

随机抽查 30 条（seed=124）：**命中 29 / 错位 1**。

全量 174 条机械校验：ref 全部为仓库根相对全路径、文件存在、行号不越界，0 异常；键只有 `fact`/`ref`。

### 必须修复（1 条）

| # | 原 ref | 问题 | 正确 ref |
|---|--------|------|----------|
| 140 | `tools/shower/app/src/main/java/com/ai/assistance/shower/DisplayCapture.java:18` | :18 是 import 区，与断言（ImageReader 建 Surface→VirtualDisplay→抓帧转 PNG，IMAGE_WAIT_TIMEOUT_MS=1000）无关，偏离 26 行 | `:29`（`static byte[] captureDisplay(int displayId)` 方法声明；ImageReader/Surface/VirtualDisplay 声明在 :30-32，IMAGE_WAIT_TIMEOUT_MS 在 :23） |

### 非阻塞建议（4 条，断言均为真，仅锚点可收紧）

- [108] `LocaleUtils.kt:93` → 建议 `:98`：ja→en 特殊处理逻辑在 :97-100，`"${locale.toLanguageTag()},${LanguageCodes.ENGLISH}"` 在 :100，距现锚点 7 行。
- [107] `LanguageSettingsScreen.kt:95`：现锚点只覆盖"切换中显示 language_changing"；整应用重启证据在 `setAppLanguage` :111 与 `FLAG_ACTIVITY_NEW_TASK|FLAG_ACTIVITY_CLEAR_TASK` :126-127，建议锚到 :111 或 :126。
- [42] `JsExecutionScriptBuilder.kt:301`：多证据断言。`new Function` 在 :298（锚点覆盖 ✓）；但 `complete()` 宿主函数定义在 :44，ref 覆盖不到。断言为真，建议拆条。
- [71] `WorkspaceUtils.kt:31`：目录普查类断言（templates/ 9 子目录、193 文件已用 `ls`/`find` 实地核实为真）；:31 指向 `copyTemplateFiles` 机制行，行号本身无法证明计数。断言为真，保留即可。

其余 25 条抽查（含 [1][4][5][8][15][25][36][45][48][53][55][58][79][80][81][91][93][99][101][103][106][121][137][139][173]）全部精确命中，断言与源码一致，无编造。抽查到的计数类断言（27 个 test()、7/12 个 test、8/6/3/2/1 个 @Test、193 文件、28 个 0 字节图等）逐一实地复算无误。

## 2. quality.json 核查

24 条（warn 12 / suggestion 12，无 high），file:line 全部存在且行号合法。实地抽查 8 条证据，全部为真：

- Q7 values-ja 孤儿 key `follow_chat_model_for_all_functions`（默认 values 无此 key）✓
- Q8 values-en 缺 6 个默认 key（脚本复算 `len(d-e)==6`）✓
- Q12 flutter 模板 28 个 0 字节图片（`find -size 0` 复算 28）✓
- Q20 `lib.rs:56` `_literal: jboolean` 参数被下划线丢弃 ✓
- Q21 `run_shower_server.bat:66` 仍写 `ws://<device>:8986`，与 Binder-only 现状矛盾 ✓
- Q22 `apk_reverse.ts:13` `"enabledByDefault": true` vs `manifest.json:15` `"enabled_by_default": false`，对照 qqbot 两处一致 ✓
- Q1 `StreamRealTimeSplitTest.kt` 全文件 0 处 `assert` ✓
- Q0/Q2-Q6/Q9-Q11/Q13-Q19/Q23 未逐条复核但 file:line 存在，证据摘录与文件内容一致

severity 合理。注：writer 汇报称"警告 10 / 建议 14"，实际为 warn 12 / suggestion 12——数据无误，仅汇报口径差。

## 3. md 结构（§9）

- 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源 ✓
- frontmatter 齐全（title/module/sources:152/date/issue:124）✓
- 无禁用词（可能/大概/似乎/应该/也许 0 命中）✓
- 调用链抽查 3 处属实：`tools/adb/execute_js_dir.bat` 存在、`onVideoFrame` 在 IShowerVideoSink.java、`MediaCodec` 在 Main.java ✓
- 来源节非空，种子目录与行数（androidTest 67 文件 / templates 193 / values 7716 strings / tools 114 / examples 540）与实地一致 ✓
- 人话质量：术语有解释，调用链用输入→处理→输出叙事 ✓

## 4. status.json

`refs_valid=174` = facts 数 174；`status=review-pending`；`issue=124`；`source_commit` 为完整 hash；`source_repo=operit`。全部正确 ✓

## 5. lint

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09` 中 `appendix-tests-android.*` 0 命中：**0 硬失败 / 0 警告** ✓

## 必须修复清单

1. fact[140]：ref 改为 `tools/shower/app/src/main/java/com/ai/assistance/shower/DisplayCapture.java:29`。

修复后对 [140] 做针对性复验即可 PASS，无需重审全文。
