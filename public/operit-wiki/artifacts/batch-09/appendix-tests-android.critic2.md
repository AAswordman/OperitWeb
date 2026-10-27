# 复验报告 · appendix-tests-android（critic2）

- 条目：appendix-tests-android / Issue #124
- 首轮：FAIL（唯一必须修复项：fact[140] 锚点落在 import 区）
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 复验方式：sed 实地核对源码窗口 + facts/status 一致性检查

## 必须修复项复验

| fact | 原 ref | 修复后 ref | 实地核对 | 结论 |
|------|--------|-----------|----------|------|
| [140] | DisplayCapture.java:18（import 区） | `:29` | `sed -n '27,33p'`：`:29` = `static byte[] captureDisplay(int displayId) {`，`:30-32` 依次为 `ImageReader imageReader`、`Surface surface`、`VirtualDisplay virtualDisplay` | ✅ 精确命中 |

断言"ImageReader 创建 Surface→建 VirtualDisplay→抓一帧转 PNG byte[]"与 :29–33 窗口完全对应。

## 随机抽查 5 条（文件未改坏）

| fact | ref | 实地核对 | 结论 |
|------|-----|----------|------|
| [107] | LanguageSettingsScreen.kt:95 | :95 = `text = stringResource(id = R.string.language_changing)`，切换中 loading 文案锚点命中；首轮已注记整应用重启证据在 :111/:126-127（非阻塞建议，未改） | ✅ 命中 |
| [108] | LocaleUtils.kt:93 | :93–94 注释"日本語で未翻訳の項目は英語リソースを使用し、中国語の既定リソースを表示しない"——ja→en 回退逻辑断言为真；:98/:100 更紧（非阻塞建议，未改） | ✅ 命中 |
| [42] | JsExecutionScriptBuilder.kt:301 | :299–303 = `new Function('module','exports','require','__operit_call_runtime',...)` 参数列表 | ✅ 命中 |
| [71] | WorkspaceUtils.kt:31 | :31 = `// 根据项目类型复制模板文件并创建配置` + `when (projectType)`，模板复制入口；9 目录/193 文件普查断言首轮已用 ls 核实为真 | ✅ 命中 |
| [13] | ColorQrCodeUtilAndroidTest.kt:10 | :10 = `class ColorQrCodeUtilAndroidTest {`，:12/:30 两个 @Test，`roundTrip_2_4_8_16_colors` 与断言一致 | ✅ 命中 |

抽查 5/5 命中，无文件损坏。

## 一致性检查

- facts 数 = 174，status.json `refs_valid` = 174 ✅
- status = review-pending ✅
- issue = 124 ✅
- source_commit = dbf71916fae9750cfdc9f9a774f5a0fee56633fb（完整 hash）✅

## 结论

**PASS**。首轮 FAIL 的唯一必须修复项已精确修复，抽查无回归，元数据一致。遗留的 4 条非阻塞建议（[108]/[107]/[42]/[71] 的更紧锚点）断言均为真，不影响交付。
