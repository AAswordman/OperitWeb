# Critic 报告：ui-settings-misc（Issue #100）

- 评审对象：`review/batch-07/ui-settings-misc.{md,facts.json,quality.json,lint.md,status.json}`
- 源码钉死：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse` 一致）
- writer 自报：facts 210 条、lint 0/0
- critic 方式：210 条 facts 逐条拉取 file:line ±5 源码窗口核对；43 条 quality evidence 程序化验真（逐字含缩进比对）+ 高危/敏感条目人工复核；lint 隔离重跑；禁用词扫描；正文来源计数核对
- **最终 verdict：FAIL**（存在事实错误、伪造 evidence、描述失实，需修错后复验）

---

## 一、机械项结论

| 检查项 | 结果 |
|---|---|
| lint 独立重跑（隔离复制 4 文件到 /tmp/lint-iso-07，`scripts/lint.py --src ~/workspace/Operit --dir`） | 0 硬失败 / 0 警告 ✓ |
| facts 条数 | 210 条 ✓（与自报一致，无重复断言） |
| ref 格式 | 210 个全部 `path:line` 合法，指向文件全部存在，无读文件失败 ✓ |
| 正文来源小节"原子事实 210 条" | 与 facts.json 一致 ✓ |
| quality 条数 | 43 条（high 3 / warn 14 / suggestion 26），与正文"代码走查 43 条（高危 3 / 警告 14 / 建议 26）"一致 ✓ |
| severity 取值 | 全部落在 {high, warn, suggestion} ✓ |
| `.status.json` refs_valid=210 | 与 facts 条数一致 ✓ |
| 禁用词（通过/批准/LGTM） | 五个交付文件均未检出 ✓ |
| 引用锚点真实性 | 210 个 ref 行号均落在真实代码行 ✓ |

## 二、逐条核引用结论（facts 1–210）

抽查方法：全部 210 条已拉 ±5 行窗口逐条比对；计数类断言（19 回调、13 预设、TONE 3/CHARACTER 3/FUNCTION 7、pollinations 6 处、9 TTS/3 STT、40 消息上限等）用 grep 独立计数复核；"未使用"类断言（onBackPressed×3、navigateBack、characterAssistantIntro、三个导航回调、ApiPreferences/JSONObject import）用全文件出现次数复核（均为 1 次=仅声明，或 import 行本身）。

- **208 条：断言被 ±5 窗口完整支撑，结论成立。** 包括全部 GitHub 账号/token 相关 facts（4–8 登录态展示/退出路径，52–58 GitHubAccountScreen 登录态/头像/userInfo/clearGitHubOAuthBrowserSession 顺序），证据实锤。
- **2 条事实错误**：FACT 30、FACT 31（见需修清单 A）。
- **2 条锚点漂移**（断言成立，ref 需微调）：FACT 184、FACT 191（见需修清单 D）。
- **2 条复合断言应拆分**：FACT 76、FACT 136（见需修清单 E）。

代表性已验真（抽样）：

- FACT 1：`SettingsScreen` 参数区 `() -> Unit` 出现 19 次 ✓
- FACT 33/34：开关开→`ensureBearerToken()`→`setEnabled(true)`→`ensureRunningForExternalHttp`；关→`stopExternalHttp` ✓
- FACT 51：`UUID.randomUUID().toString().replace("-", "")` ✓
- FACT 60–66：`LocalCharacterToolExecutor` 注释"本地最小工具执行器：仅处理 save_character_info"、`TOOL_NAME`、白名单 8 字段、`otherContent`→`otherContentChat` 别名、`error_unsupported_field` ✓
- FACT 93：`PresetTagBilingual(` 14 处命中含 1 处 data class 声明，列表条目 13 ✓；TONE 3 / CHARACTER 3 / FUNCTION 7 ✓
- FACT 100：`image.pollinations.ai` 6 处 ✓
- FACT 140/141：9 种 TTS / 3 种 STT 的 when 分支 ✓
- FACT 155：5 种模板（asterisk/double_asterisk/parenthesis/chinese_parenthesis/xml）✓
- FACT 173/175：打字机滑块 200f..1000f/steps=39、合并发送 500f..10000f/steps=94 ✓
- FACT 192/193：工具权限四页签 builtin/package/skill/mcp、key/title/subtitle 搜索 ✓
- FACT 194/195/196：未勾 `use_package` 则 Toast 中止；非固定模式 `chatModelConfigId=null`、`chatModelIndex=0` ✓

## 三、quality（代码走查 43 条）结论

- evidence 程序化逐字验真：39/43 逐字（含缩进）命中源码；**4 条不命中**（见需修清单 B），其中 [9][10] 的 evidence 为虚构代码（源码中不存在的签名/变量），属严重问题。
- 3 条 high 的核心断言均成立：
  - [0] `ExternalChatReceiver` manifest `exported="true"` 无 permission + 设置页 adb 示例，实锤；
  - [1] 明文 `http://$ip:$savedPort`、Bearer 头示例，实锤；
  - [2] 语音档案 DataStore 未加密实锤，但描述中"全仓库无 EncryptedSharedPreferences 用法"失实（见需修清单 C）。
- GitHub/token 相关条目 [3][4][5][6][13][19] 的核心断言均有源码支撑：token 输入框无 `visualTransformation`（0 处）、复制/重置写剪贴板、最低 6 字符、两条退出路径不一致（主页直接 `logout()` vs 账号页先 `clearGitHubOAuthBrowserSession()`）、9 处密钥输入框无遮罩（`ttsApiKeyInput`/`sttApiKeyInput` 绑定处 9 处无掩码，文件内 `PasswordVisualTransformation` 0 次）。
- [20] "密集使用 !!" 成立（14 处），但描述示例表达式与源码不符（次要，见 F）。

## 四、需修清单

### A. 事实错误（必须修）

1. **FACT 30** — "数据和权限分组第 6 项为隐私数据清理"：错误。`SettingsScreen.kt:291` 是独立的 `SettingsSection(title = settings_privacy_data_cleanup)`，"隐私数据清理"是分组标题而非条目，更不属于"数据和权限"分组（该分组在 `:249`，`:288` 处闭合，共 5 项：工具权限/数据备份/聊天记录管理/Token 用量统计/性能监控）。应改为"隐私与数据清理为独立分组"并修正 ref。
2. **FACT 31** — "数据和权限分组第 7 项为清除 Cookies"：错误。"清除 Cookies"是"隐私与数据清理"分组（`:291`–`:301`）的条目。应修正归属与 ref。
3. **正文 §1** — "数据和权限（工具权限/数据备份/聊天记录管理/Token 用量统计/性能监控/隐私数据清理/清除 Cookies）"：同上错误归组，需同步修正（另：`:235` 的"上下文摘要"分组在正文枚举中被遗漏，正文称 8 个分组计数正确但枚举不全）。

### B. evidence 伪造/失真（必须修，用逐字原文替换）

4. **quality[9]**（warn"用正则解析 XML 风格的工具调用"）— evidence 虚构。源码实际为：
   ```
       fun extractInvocations(raw: String): List<Pair<String, Map<String, String>>> {
           val list = mutableListOf<Pair<String, Map<String, String>>>()
           // 简单 XML 提取：<tool name="..."> <param name="field">..</param><param name="content">..</param></tool>
           ChatMarkupRegex.toolCallPattern.findAll(raw).forEach { m ->
   ```
   证据中 `List<ToolInvocation> =` 与 `mapNotNull { match ->` 在源码中不存在。描述结论（正则解析结构化标记易误判）可保留，evidence 必须换成上方逐字原文。
5. **quality[10]**（warn"package_proxy/proxy/search 硬编码排除"）— evidence 虚构。`private val excludedTools = setOf("package_proxy", "proxy", "search")` 不存在，实际为：
   ```
           toolHandler.getAllToolNames().filterNot {
               it == "package_proxy" || it == "proxy" || it == "search"
           }
   ```
   （`ToolPermissionSettingsScreen.kt:43-47`，注意行首 8 空格缩进）。结论成立，evidence 替换。
6. **quality[28]**（suggestion"AssistChip 点击为空实现"）— evidence 缩进错误。实际为 16 空格 `AssistChip(` + 20 空格 `onClick = { },`；证据写成 0/24 空格。按逐字原文修正缩进。
7. **quality[37]**（suggestion"请求头 JSON 明文回显"）— evidence 首行缩进丢失。实际 `OutlinedTextField(` 前有 40 空格，`value = ttsHeadersInput,` 前 44 空格。修正。

### C. 描述失实（必须修）

8. **quality[2]**（high"语音服务 API Key 明文存入未加密 DataStore"）— 描述中"全仓库无 EncryptedSharedPreferences 用法"为假：`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:146` 实际使用了 `EncryptedSharedPreferences.create(...AES256_SIV/AES256_GCM...)`。核心结论（语音档案 DataStore 未加密）成立，须把全仓库断言改为准确表述（如"语音档案 DataStore 未采用 EncryptedSharedPreferences 等加密存储"）。

### D. 锚点漂移（建议修）

9. **FACT 184** ref `:62` → 字段声明实际在 `:69`–`:77`（`name` 在 `:69`），±5 窗口（57–67）未覆盖字段列表。建议改 `:71`。
10. **FACT 191** ref `:168` → 该行位于记忆空间回填的 `LaunchedEffect` 内；"固定模型配置为空/失效回填首个可用"实际在 `:144`–`:150`（`fixedChatModelConfigId = configSummaries.first().id` 在 `:150`）。建议改 `:150`。

### E. 复合断言应拆分（建议修）

11. **FACT 76** 含两个独立断言：(a)"7 字段全非空时 `isCharacterCardComplete()` 返回 true"（ref :344）；(b)"发送消息时直接回完成消息"（`R.string.character_card_complete`，ref :455）。应拆为两条。
12. **FACT 136** 含"以独立档案管理"与"支持新建/重命名/切换/删除"两层断言，应拆分。

### F. 次要

13. **quality[20]** 描述示例 `userInfo?.avatarUrl!!` 与源码实际 `userInfo!!.avatarUrl`（`GitHubAccountScreen.kt:81`）不符；"密集使用 !!" 本身成立（14 处），修正示例即可。
14. **FACT 76** 中"直接回'已完成'"为意译，实际回复资源串中文为"🎉 角色卡生成完成！所有信息都已保存。"，可接受，建议精确化。

## 五、最终 verdict

**FAIL**

理由：FACT 30/31 及正文存在分组归属事实错误；quality[9][10] 的 evidence 为源码中不存在的虚构代码；quality[2] 含已被证伪的全仓库断言。以上修错完成后，需重新走 critic 复验（重点复核 A/B/C 三类修改），再按同步铁律 build→deploy→公网验证。

修错时注意既往教训：不要照抄本报告中的行号猜测，以修错时实际拉取的源码窗口为准。
