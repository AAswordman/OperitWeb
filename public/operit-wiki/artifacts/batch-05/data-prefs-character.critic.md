# Critic 复核报告：data-prefs-character（角色卡与人格配置）

- 复核对象：`review/batch-05/data-prefs-character.{facts,quality,md,lint,status}.json/md`
- Issue：#66
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：143 条 facts 全量结构校验（文件存在、行号在范围内、ref 格式）+ 脚本化 ±5 窗口关键词检查（35 条 flagged 全部人工逐条核对源码原文）+ 数字断言抽查 12 条 + quality 12 条逐条 diff 验 evidence + md 全文通读 + lint 独立重跑

## 结论：打回修正

**facts：143 条中 127 条通过，16 条引用错位必须修正。**
**quality：12 条 evidence 内容全部真实（逐字一致），2 条行号锚点错位必须修正（Q3、Q11）。**
**正文 md：结构齐全，内容与 facts 无矛盾，2 处引用锚点建议顺手修正（轻微）。**
**status.json：正确。lint：条目本体 0 硬失败 / 0 警告（独立重跑验证）。禁用词：5 个文件全文 grep，"通过/批准/LGTM" 0 命中。**

### 核心问题

writer 的断言内容本身基本属实（抽查的数字断言——19 个偏好键、DataStore 名与 schema 版本、PNG 头校验、chara 关键字、250ms/5000ms 默认值、take(9)/512px、chara_card_v2 导出规范等——全部与源码一致），
但 16 条 fact 的行号锚点落在 ±5 支撑窗口之外，多为函数声明行或相邻函数体，而非断言所在的真实代码行。按引用铁律必须打回重锚（下方给出每条正确锚点）。

---

## 需修正的 facts（16 条：索引 / 原 ref / 正确锚点）

CharacterCardManager.kt（除注明外）：

- [55] `:278` → `:285`（工具白名单解析失败打日志：`AppLogger.e("CharacterCardManager", "解析角色卡工具白名单失败", it)` 在 285；278 的窗口 272–283 不含打日志行）
- [56] `:290` → `:296`（归一化等于默认空配置则删键：`if (normalizedConfig == CharacterCardToolAccessConfig()) { preferences.remove(key)` 在 296–297；290 的窗口 284–295 不含）
- [58] `:454` → `:461`（新建卡设为活跃：`if (newCard.isDefault || preferences[ACTIVE_CHARACTER_CARD_ID] == null)` 在 461；454 的窗口 448–459 无活跃卡逻辑）
- [63] `:592` → `:577`（删除活跃卡后活跃 ID 回退默认卡：`preferences[ACTIVE_CHARACTER_CARD_ID] = DEFAULT_CHARACTER_CARD_ID` 在 577；592 的窗口 586–597 显示的是 Waifu 配置回退，会造成归因错位）
- [64] `:600` → `:583`（删除卡同步删主题/Waifu/表情：三行 `deleteCharacterCardTheme` / `deleteCharacterCardWaifuSettings` / `deleteCharacterCardEmojis` 在 582–586；600 的窗口 594–605 是 `setActiveCharacterCard`，完全无关）
- [65] `:604` → `:588`（删除后清聊天记录绑定：`clearCharacterCardBinding(deletedCardName)` 在 589；604 的窗口 598–609 无绑定清理）
- [68] `:636` → **拆成 4 条原子事实**（combinePrompts 四段拼接顺序：角色设定 `:635`、其他内容 `:640`、附着标签 `:649`、高级自定义 `:656`；没有任何单个 ±5 窗口能同时覆盖四段，当前锚点窗口 630–641 只覆盖前两段）
- [84] `:1003` → `:994`（酒馆卡 schema 检查：`?.takeIf { it.schema == "operit_character_card_v1" }` 在 994–995；1003 的窗口 997–1008 不含）
- [86] `:1297` → **拆成两条**：mes_example/system_prompt/post_history_instructions 进 otherContentChat 锚定 `:1320`（窗口 1314–1325 全覆盖）；alternate_greetings 进 otherContentChat 锚定 `:1331`（1329–1335 备用问候语块；1297 是函数声明行，窗口内无任一字段）
- [87] `:1322` → `:1343`（depth_prompt 进高级自定义提示词：`data.extensions?.depth_prompt?.let` 在 1343；1322 落在 otherContentChat 拼接块内，归因错位）
- [88] `:1366` → `:1391`（first_mes 做开场白：`openingStatement = data.first_mes` 在 1391；1366 的窗口 1360–1371 是 creator_notes/version 备注块）
- [91] `:1123` → `:1115`（导出映射三元组：`system_prompt = card.characterSetting` 在 1115、`post_history_instructions = card.advancedCustomPrompt` 在 1116、`creator_notes = card.marks` 在 1114；1115 的窗口 1109–1120 全覆盖；1123 的窗口 1117–1128 只看到 tags/version/extensions）
- [109] `:379` → **拆成两条**：前 9 成员 `take(9)` 在 385 锚定 `:385`；512px `sizePx = 512` 在 403 锚定 `:403`（379 是函数声明行，两个数字都不在窗口内）
- [113] `:76` → `:81`（未启用白名单时用全局可见性+全部外部源+canUsePackageSystem=true：返回体在 80–86；76 的窗口 70–81 不含 82–86 的外部源名单与 canUsePackageSystem 行）

CharacterCardBilingualData.kt：

- [133] `:236` → `:199`（世界书标签名模板 `"世界书: $characterName"` 在 199；236 是 `getAuthorLabel` 的返回行，完全无关）

PersonaCardChatHistoryManager.kt：

- [140] `:60` → `:72`（加载历史 JSON 解析失败返回空列表：`catch (e: Exception) { emptyList() }` 在 71–73；60 是 `saveChatHistory` 的函数体行）

## 需修正的 quality（2 条）

- [Q3] anchor `PersonaCardChatHistoryManager.kt:60` → `:69`（evidence 是 loadChatHistory 内的 try/catch（68–73），60 落在 saveChatHistory 内；evidence 逐字真实，severity=warn 合理——静默吞异常）
- [Q11] anchor `CharacterCardManager.kt:989` → `:973`（evidence `worldBookContent` 拼接在 973–980，989 是 `createOrReusePromptTag` 调用行；已验真：character_book 条目确实无截断拼进 `TagType.FUNCTION` 标签（987 行），severity=suggestion 合理）

---

## 轻微建议（不阻塞，可顺手修）

facts：

- [48] `:223` 通过（函数名 `migrateLegacyOtherContentToChat` 本身支撑断言），建议上移至 `:231`（合并体 `preferences[chatKey] = legacyValue` 处）更扎实
- [50] `:208` 通过（函数名 `removeDeletedTagReferences` 支撑），建议下移至 `:213`（过滤循环处）
- [91] 修正锚点后为单条亦可；如追求严格原子化可拆成 3 条
- [121] `:34` → 建议 `:45`（`DEFAULT_WAIFU_CHAR_DELAY = 250` 在 45；34 只是 key 声明行，默认值不在窗口内）
- [128] `:236` → 建议 `:240`（无专属配置则 `preferences.remove(key)` 在 242；236 的窗口 230–241 差一行）

正文 md（内容无误，仅引用锚点）：

- 第 8 节"通用转换"引用 `:1280` → 建议 `:1295`（`convertTavernCardToCharacterCard` 函数起点；1280 落在 `remapAttachedTagIds` 内）
- 第 7 节"新建角色卡复制当前 Waifu 配置"引用 `:359` → 建议 `:364`（`copyCurrentWaifuSettingsToCharacterCard` 在 364；359 是主题函数 `createDefaultThemeForCharacterCard`，断言本身为真）

---

## 各文件核验小结

- **facts.json（143 条）**：文件存在性 143/143，行号范围 143/143 有效，ref 格式 143/143 合规；数字断言抽查 12 条全部与源码一致（含 19 键计数、`character_cards`/`character_groups` 库名与版本、PNG `chara` 关键字与 Base64、8 字节头校验、`chara_card_v2`/`2.0`、250/5000ms 默认值）；枚举类事实 [32]（TavernCharacterData 16 字段）[112]（ResolvedCharacterCardToolAccess 7 字段）与源码逐字段一致。
- **quality.json（12 条）**：evidence 去缩进后 12/12 在源码全文逐字命中；severity 分级合理（fail-open 类吞异常/无确认覆盖给 warn，缺校验/未重置给 suggestion）；仅 Q3、Q11 锚点错位（见上）。
- **md 正文（213 行）**：结构齐全（概述 / ## AI 速览 / 核心机制 10 节 / 关键符号 / 输入→处理→输出三链路 / 来源）；符号名均为英文原名；与 facts 无矛盾断言；已核 md 内 14 处源码引用锚点，12 处准确，2 处轻微偏移（见建议）。
- **status.json**：`issue: 66`（整数 ✓）、`status: review-pending` ✓、`source_repo: operit` ✓、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✓；`refs_valid` 格式与条目相符（行号存在性 143/143 为真）。
- **lint.md**：独立重跑 `scripts/lint.py --src ~/workspace/Operit --dir <单页隔离目录>`（仅条目 .md）：检查文件 1，硬失败 0，警告 0，与报告一致。注：lint.py 会把目录内自带的 `.lint.md` 报告文件也当条目扫描（已知 quirks，batch-04 同样如此），正确跑法是先 lint 再落盘报告，writer 的"单页隔离跑"流程无误。
- **禁用词**：5 个文件全文 grep `通过|批准|LGTM`，0 命中。

## 结论：打回

16 条 facts 引用锚点错位 + 2 条 quality 锚点错位，按引用铁律必须修正。请 writer 按上方"需修正"清单重锚（[68][86][109] 按要求拆分），修正后由独立 critic 复验。

---

## 复验（第二轮，2026-10-01T14:55 CST）——**通过**

- 复验对象：修错后 `data-prefs-character.{md,facts,quality,lint,status}.json/md`（facts 143→149 条，quality 12 条）
- 复验人：独立 critic（非第一轮 critic，非修错员）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）

### 复验工作量
- 149 条 facts 全量程序化校验：文件存在、行号整数、1≤行号≤文件行数——**0 坏引用**。
- 第一轮打回的 16 条 facts 锚点修正：逐条用 `git show` 人工核 ±5 窗口支撑原文——**16/16 通过**（[55]:285、[56]:296、[58]:461、[63]:577、[64]:583、[65]:588、[68]拆4条:635/:640/:651/:656、[84]:994、[86]拆2条:1320/:1331、[87]:1343、[88]:1391、[91]:1115（双条均覆盖）、[109]拆2条 GroupMgr:385/:403（`.take(9)`/`val sizePx = 512` 逐字在行）、[113]→CharacterCardToolAccessResolver.kt:81（修错员纠正了 critic 的文件归属，:81 窗口 76–86 完整覆盖返回体）、[133]Bilingual:199（`"世界书: $characterName"`）、[140]Persona:72（catch 71–73）。
- quality 2 条锚点：Q3（critic 建议 :69，修错员修到 :68）——`return try {` 首行在 68，:68 正确；Q11（critic 建议 :973，修错员修到 :974）——`val worldBookContent` 首行在 974，:974 正确。两处偏差均为修错员更精确，**通过**。
- quality 12 条 evidence：去缩进后 12/12 在源码逐字命中；Q6（:519，evidence 首行在 517）、Q9（:23，evidence 首行在 24）锚点在 evidence 块边界行，±5 窗口全覆盖，属第一轮已通过项、修错未动——**可接受**。severity 分级合理（warn=吞异常/无确认覆盖，suggestion=缺校验）。
- 轻微项：[49]:234、[51]:213、[128]:45、[135]:240、[127]:34/[128]:45 拆分、md 正文 :364/:994/:1295——逐条核验**全部通过**。
- 随机抽查 15 条未修复 facts（[18][19][25][33][48][64][66][76][80][112][115][120][127][134][144]）：4 条人工 sed 核窗口（[18]:60 `isDefault=false`、[33]:92 酒馆卡字段、[112]:214 空值移除活跃群组、[25]:13 allowedMcpServers 空列表）**全部命中**。
- 禁用词：5 文件全文 grep `通过|批准|LGTM`——**0 命中**。
- status.json：`issue: 66`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916…56633fb`——正确；`refs_valid` "149/149" 与实测一致。
- lint：独立单页隔离重跑 `scripts/lint.py`——**硬失败 0 / 警告 0**。

### 结论
修错员的 16+2 处锚点修正全部合格，轻微项全部落实，抽样与全量校验无新增问题。**复验通过，本页已达收货标准，可进入发布队列。**
