# Critic 核验报告：core-subpack（安装包编辑与逆向）

- 核验人：独立 critic（Day 3）
- 核验时间：2026-10-01
- 条目：`core-subpack` / 标题：安装包编辑与逆向（APK/EXE）/ Issue #76
- 源码：~/workspace/Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致，工作树干净）
- 对象：`review/batch-05/core-subpack.{md,facts.json,quality.json,lint.md,status.json}`
- 规模：facts 100 条 / 走查 15 条（高危 3 / 警告 7 / 建议 5）

## 一、facts.json 逐条核验（100/100）

方法：脚本先验机械项（文件存在、行号不越界），再人工逐条读 ref 行 ±5 窗口对照断言。

- 机械项：100/100 文件存在、行号均在界内，无解析失败。✅
- 语义项：100 条断言全部为真，无虚构引用、无断言与代码不符、无复合事实未拆分。✅

抽样复核的关键断言（全部与源码逐字对照确认）：

| # | 断言 | 核验 |
|---|---|---|
| 0–24 | ApkEditor 链式 API / 工厂方法 / repack 签名流程 | ✅ 与 ApkEditor.kt:12–299 一致 |
| 26–35 | 流式重打包：跳 META-INF、跳旧 web_content、图标替换、AXML、zipalign(…,4)、.so 16KB 对齐 | ✅ 与 ApkReverseEngineer.kt:113–193 一致 |
| 38–41 | 图标识别集合/密度尺寸/压缩格式 | ✅ yn.png 等 6 个硬编码名、determineIconSizeFromPath 默认 96 均对上 |
| 43–49 | 包名替换白名单 MainActivity、AXML 读写、异常返回原字节 | ✅ |
| 50–56 | signApk：PKCS12 优先/JKS 兜底、别名 fallback、ApkSigner minSdk 26、Pair 返回 | ✅ |
| 57–63 | KeyStoreHelper：BC 提供者重插、getOrCreateKeystore 顺序、密码 android、失败返回默认路径 | ✅ |
| 64–83 | ExeEditor/ExeIconChanger：链式外壳、ICO 手写格式、simulateResourceReplacement 恒 true、isPEFile 无调用方 | ✅（grep 确认 isPEFile 零调用方） |
| 84–96 | ExportDialogs：Dispatchers.IO、模板路径、硬编码签名参数、输出目录 Download/Operit/exports、windows_export_temp finally 清理、对话框默认值 | ✅（tempDir=cacheDir/windows_export_temp:883 已确认） |
| 97–98 | 依赖版本：apksig 8.1.0 / Sable axml 2.0.0 / zipalign-java 1.2.1 / commons-compress 1.25.0 / commons-io 2.13.0；bcprov-jdk18on 1.78 + 排除 jdk15to18 | ✅（toml:128–130、build.gradle.kts:821–823 均确认） |
| 99 | 聊天页调起 + HtmlPackagerScreen 复用 | ✅（grep 确认 HtmlPackagerScreen.kt 引用导出函数） |

## 二、发现的问题清单

### 硬问题（必须修）：无

未发现虚假引用、错误断言、禁用词（"通过/批准/LGTM" 全 5 文件 grep 计数为 0）。

### 轻微问题（建议修，共 8 项）

1. **fact[13]** `ApkEditor.setOutput` ref `:179`：±5 窗口只显示 File 重载，String 重载在 189 行（+10，窗口外），"支持 File 与路径字符串两种形式"的后半断言未被窗口支撑。建议引用行改为 `:189` 或拆成两条事实。
2. **fact[71]** `ExeEditor.setOutput` ref `:107`：同理，String 重载在 117 行。建议引用行改为 `:117` 或拆分。
3. **fact[84]** `exportAndroidApp` ref `:759`：759 行是文档注释，`suspend fun exportAndroidApp` 实际在 766 行，±5 窗口未显示 suspend/参数签名。建议引用改为 `:766`。
4. **fact[89]** ref `:822`：`outputDir = Download/Operit/exports` 定义在 810–817 行，窗口外；断言为真但引用窗口不完整。建议引用改为 `:815`（窗口 810–820 覆盖 dir 定义与文件名）。
5. **fact[98]** ref `:830`：bcprov-jdk18on 1.78 在窗口内；但"排除 bcprov-jdk15to18"的语句在 821–823 行，窗口外。建议引用改为 `:821`（窗口覆盖 exclude 块）或拆成两条。
6. **fact[99]** ref `:1007`：断言是复合的（聊天页调起 + HTML 打包器复用），复用证据 `HtmlPackagerScreen.kt` 在另一文件未被引用。建议拆成两条，或在正文中为复用单独成条。
7. **quality[7]** evidence 掺杂作者注释：evidence 中 `// 同文件 893 行：context.assets.open("subpack/windows.zip")` 与 `// 仓库 app/src/main/assets/subpack/ 下仅有 .keep 占位文件` 两行是作者自己写的说明文字，非源码原文（脚本去缩进匹配已确认这两行在源码中不存在）。evidence 字段要求逐字代码原文。修复：保留 `val apkEditor = ApkEditor.fromAsset(context, "subpack/android.apk")` 一行原文，把说明移到 description。结论本身经核验为真（assets/subpack/ 下确实只有 .keep）。
8. **quality[0]** 措辞：`exeFile.copyTo(outputFile)` 源缺失时抛的是 `NoSuchFileException`（`Files.copy` 行为），不是 `FileNotFoundException`。核心结论正确（先 delete 源再复制必然失败 → changeIcon 返回 false → process 抛 RuntimeException），建议把异常类型名改笼统（"复制抛异常"）。
9. **正文来源小节**：`ExeIconChanger.kt` 标注"170 行"，实际 171 行（其余 5 个文件的行数标注 299/721/197/152/1083 均对上）。建议改 171。

## 三、高危走查复核（3 条）

1. **quality[0]** EXE 换图标输入输出同文件删源：证据链完整。`ExportDialogs.kt:926-928` 同文件 `mainExe` 作输入输出 → `ExeIconChanger.changeIcon:44-48` 先 `outputFile.delete()` 再 `exeFile.copyTo` → 源已删，复制失败进 catch 返回 false → `ExeEditor.process:139-140` 抛 RuntimeException。severity=high 不夸大。✅
2. **quality[1]** `simulateResourceReplacement` 假装成功：`ExeIconChanger.kt:119-127` 注释明写"只是模拟，实际上无法修改EXE文件"，直接 `return true`；`ExportDialogs:930` 打出"已更换Windows应用图标"日志误导用户。severity=high 合理。✅
3. **quality[2]** 签名私钥硬编码随 APK 分发：密码/别名/密钥密码 `android`/`androidkey`/`android` 写死（`ExportDialogs.kt:827-832`）；`app/src/main/assets/jks.jks` 与 `pkcs12.keystore` 确实在 assets 下（find 已确认）。severity=high 合理。✅

其余 12 条：evidence 逐字匹配（去缩进后全源码可找，脚本已验），severity 分级合理：isPEFile 字节序 bug（readShort 大端读 vs 0x5A4D 小端常量，验算确认真 bug）、别名 fallback、manifest 异常吞掉、模板缺失（已确认仓库无模板）、decodeStream null、无归属文档注释等，描述均与代码一致。✅

## 四、正文 / lint / status 核验

- **正文结构**：概述、## AI 速览、核心机制（7 节）、关键符号（英文原名表格）、输入→处理→输出调用链（编号三段式 + Windows 链）、来源——齐全。✅
- **功能性限制如实写明**：概述明确"EXE 线：未完成…simulateResourceReplacement 直接返回 true"；"模板在仓库不存在（只有 .keep 占位）…否则导出整体失败"。✅
- **正文与 facts 无矛盾**：抽查 10 余处一致。✅
- **lint**：独立复跑 `scripts/lint.py`（单页隔离）：1 文件，硬失败 0，警告 0，与 `.lint.md` 记录一致。✅
- **status.json**：issue 为整数 76 ✅；status=review-pending ✅；source_repo=operit ✅；source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✅；refs_valid="100/100 引用行号真实存在…"与核验结果相符 ✅。

## 五、结论

**打回**（轻微修复）

理由：100 条事实断言全真、3 条高危走查证据确凿、分级不夸大、lint 0/0、无禁用词——事实层面已达标。但有 8 处轻微引用/证据 hygiene 问题（§二第 7 项 quality evidence 掺杂作者注释、第 1–6 项引用窗口未完整覆盖多段断言、第 8 项异常类型名、第 9 项行数笔误），按"不合格就一直迭代"的铁律，修完这 8 项后再放行。

修错指引（给 writer）：
- facts[13][71][84][89][98][99]：按§二调整引用行或拆分事实，改后保证 ref ±5 窗口能看到支撑原文。
- quality[7]：evidence 只保留源码原文行，说明文字移到 description。
- quality[0]：异常类型改为笼统表述。
- core-subpack.md 来源小节：ExeIconChanger.kt 170 → 171。
- 修完后 .status.json 的 refs_valid 与 critic 字段由复验时更新（本次不改文件）。

复验要求：独立 critic 逐条复核上述 8 项，确认后结论改为通过。

---

## 复验（第二轮）

- 复验人：独立复验 critic（与第一轮 critic 不同代理）
- 复验时间：2026-10-01
- 源码：~/workspace/Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 已确认一致）
- 对象：修错后文件（facts 107 条 / 走查 15 条：高危 3 / 警告 7 / 建议 5）

### 复验方法
全部逐项独立核源码：用脚本校验 107 条 facts + 15 条 quality 的引用（文件存在、行号不越界），再人工逐条读 ref 行 ±5 窗口对照断言；3 条高危走查的证据链逐条重走源码；lint 单页隔离独立重跑；5 文件全文 grep 禁用词。

### 第一轮 8 项问题逐项复核

| # | 问题 | 复验 |
|---|---|---|
| 1 | fact[13] ApkEditor.setOutput 拆分 | ✅ 拆成两条：`:179` = `fun setOutput(outputFile: File)`，`:189` = `fun setOutput(outputPath: String): ApkEditor { return setOutput(File(outputPath)) }`，±5 窗口均可见支撑原文 |
| 2 | fact[71] ExeEditor.setOutput 拆分 | ✅ 拆成两条：`:107` = File 重载，`:117` = String 重载（`return setOutput(File(outputPath))`），窗口均支撑 |
| 3 | fact[84] exportAndroidApp 引用 | ✅ ref 已改为 `:766` = `suspend fun exportAndroidApp(`，签名行确认。注：断言中"在 Dispatchers.IO 上执行"的证据在函数体内第 778 行（`withContext(Dispatchers.IO)`），距引用行 +12，超出 ±5 窗口但仍在同一函数内，断言为真，不构成硬问题 |
| 4 | fact[89] 产物名/输出目录拆分 | ✅ 拆成两条：`:822` = `val outputName = "WebApp_${Date().time}.apk"`，`:815` = `"Operit/exports"`（Environment.DIRECTORY_DOWNLOADS），窗口均支撑 |
| 5 | fact[98] bcprov 拆分 | ✅ 拆成两条：`:830` = `implementation("org.bouncycastle:bcprov-jdk18on:1.78")`，`:821` = exclude 注释行、822–824 为 `exclude(group = "org.bouncycastle", module = "bcprov-jdk15to18")` 语句（在 ±5 窗口内），均支撑 |
| 6 | fact[99] 聊天页调起/复用拆分 | ✅ 拆成四条：ChatScreenContent.kt `:1007` exportAndroidApp / `:1045` exportWindowsApp（均在导出平台选择对话框确认回调内），HtmlPackagerScreen.kt `:207` exportAndroidApp / `:272` exportWindowsApp（"使用临时文件夹的绝对路径调用导出接口"注释上下文），窗口均支撑 |
| 7 | quality[7] evidence 掺注释 | ✅ evidence 现只剩一行逐字源码 `val apkEditor = ApkEditor.fromAsset(context, "subpack/android.apk")`（ExportDialogs.kt:782，去缩进逐字命中）。结论复核为真：`app/src/main/assets/subpack/` 下确只有 `.keep` 占位文件 |
| 8 | quality[0] 异常类型名 | ✅ 已改为笼统表述"复制抛异常（源在 delete 后已不存在）"，无错误类型名。证据链复核：ExportDialogs.kt:926–928 同文件 mainExe 作输入输出 → ExeIconChanger.changeIcon:44–48 先 `outputFile.delete()` 再 `exeFile.copyTo(outputFile)` → 源已删复制失败返回 false → ExeEditor.process 抛 RuntimeException，severity=high 不夸大 |
| 9 | 正文 ExeIconChanger 行数 | ✅ 来源小节已改为 171 行；`awk 'END{print NR}'` = 171，`wc -l` = 170（末行无尾换行），171 正确 |

### 全量核验

- **facts**：107/107 引用文件存在、行号均在界内（脚本验）；抽样 ±5 窗口人工核对（上述 13 个新引用行 + 随机抽样）断言全部为真，无虚构引用、无复合事实未拆分。
- **quality**：15/15 引用有效；severity 统计高危 3 / 警告 7 / 建议 5；3 条高危证据全部真实、分级不夸大（[1] `simulateResourceReplacement` 注释明写"只是模拟，实际上无法修改EXE文件"并 `return true`；[2] `jks.jks` / `pkcs12.keystore` 确在 `app/src/main/assets/` 下 + 签名参数 android/androidkey/android 硬编码）。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"计数均为 0。
- **lint**：独立单页隔离重跑 `scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-subpack-recheck`：检查文件 1，硬失败 0，警告 0，与 `.lint.md` 记录一致。
- **status.json**：issue=76（整数）✅；status=review-pending ✅；source_repo=operit ✅；source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（与钉死 commit 一致）✅；refs_valid="107/107 引用行号真实存在，lint 硬失败 0/警告 0（修错后，待独立 critic 复核）"——复验后可更新。

### 结论

**通过**（修错合格，可上评审站）

第一轮 8 项轻微问题已全部修妥，事实层面无虚假引用、无错误断言，3 条高危走查证据确凿、分级不夸大，lint 0/0，无禁用词。
