# 复验报告：ui-settings-model（Issue #97）— critic2

## 核验方式
- 126 条 facts 全部程序化校验 ref 合法性（文件存在 + 行号界内）：126/126 通过。
- 全部 facts 的反引号标识符做 ±5 窗口回声检查：0 缺失。
- 标识符零回声的 5 条（[1][2][27][32][110]）全部拉源码窗口人工核对。
- 第一轮 FAIL 清单逐项实地复核：[16] 重写、[30]/[35]/[98]/[119] 拆分、13 处移锚。
- quality 10 条 evidence 程序化逐字（含缩进）比对 + 行锚界内检查：10/10。
- lint /tmp 隔离独立重跑；禁用词 grep；正文数量声明；status.json 一致性。

## 通过项
- [16] 重写验真：`llamaThreadCountInput.toIntOrNull()?.coerceAtLeast(1) ?: 4`（ModelApiSettingsSection.kt:313-314）——非数字取 4/2048、小于 1 取 1；GPU `coerceAtLeast(0) ?: 0`。断言精确，PASS。
- 拆分项全部验真：[30] 进度条 `remainingPercent / 100f`（:1382）/ [31] 60 秒 tick `delay(60_000L)`（:185）；[38] `toIntOrNull()?.coerceAtLeast(0) ?: 0`（AdvancedSettingsSection.kt:157）；[101] `unitText = "K"`（ModelConfigScreen.kt:2340）；[123] ModelScope→HuggingFace→firstOrNull 优先级（MnnModelDownloadScreen.kt:274）/ [124] `enabled = downloadUrl.isNotEmpty()`（:401）。PASS。
- 移锚抽查（[19]:754 空格过滤、[95]:97 headerPresets、[96]:125 X-Forwarded-For/Via）全部实锤。PASS。
- quality 10 条：evidence 10/10 逐字命中源码，行锚全部界内，severity 仅 high 2/warn 6/suggestion 2。两条 high（日志打 `apiKey.take(5)`、≤8 位 Key 明文显示）实锤。PASS。
- 正文：frontmatter `sources: 8`；`## 来源` 含数量声明行"原子事实 126 条…代码走查 10 条（高危 2 / 警告 6 / 建议 2）"，与文件一致。PASS。
- lint 独立重跑：0 硬失败 / 0 警告。PASS。
- 禁用词"通过/批准/LGTM"：md/facts/quality 全文 0 命中。PASS。
- status.json：refs_valid=126=facts 数，status=review-pending，source_commit 钉死 dbf71916。PASS。

## 必须修（1 处锚点漂移）
- **[110]** `ModelPromptsSettingsScreen.kt:385` → **建议 :395**：断言"对裁剪出的二维码区和原图分别做多档缩放后解码"为真（函数 :358；candidates=[cropped, bitmap] :385；多档 scales 数组 :393-397；解码循环 :392-418），但 scales 逻辑在 :393-397，超出 :385 的 ±5 窗口（止于 :390）。:395 的窗口（390-400）可覆盖 scales 数组与解码循环。

## 非阻塞说明
- [1][2]（ApiKeyVisualTransformation.kt:14/:22）：类名标识符不在 ±5 窗口内，但窗口含断言的遮盖逻辑（`length > 8` 首4尾4星号 / else 直接显示原文），断言为真、锚点可用，不判漂移。
- [27]（ModelApiSettingsSection.kt:384）：窗口含 `api.kimi.com/coding/v1`（:380）、`kimi-for-coding`（:383）、`moonshotDefaultModel`（:379/:386），断言为真，不判漂移。
- [32]（AdvancedSettingsSection.kt:340）：窗口含 `if (!isCodexProvider)` + "API Key Pool Toggle" 注释，断言为真，不判漂移。

## 最终 verdict：**FAIL**
修完 [110] 一处移锚后可翻 PASS（纯机械修正，无需第三轮全量复验）。
