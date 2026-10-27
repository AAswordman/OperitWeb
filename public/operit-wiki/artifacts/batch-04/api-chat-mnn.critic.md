# Critic 复核报告：api-chat-mnn（MNN 端侧供应商·已停止维护）

- 复核对象：`review/batch-04/api-chat-mnn.*`
- 源码版本：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse`，一致）
- 复核方式：73 条 facts 全部做行号有效性校验 + 关键词窗口预检，29 条预检未命中逐条人工看源码窗口核对；5 条 quality evidence 逐字 diff；正文结构与数字断言抽查；status 字段核对。

## 结论：退回修正（5 处）

### facts.json：73 条中 69 条通过，4 条需改

1. **#63（ref :850）事实错误，必须改。** 断言"max_tokens 不经 setConfig，在 generateStream 调用时单独处理"与源码矛盾：
   - `applyModelParameters` 在 845–850 行把 `configMap["max_new_tokens"]` 写入配置表，该表最终拼成 JSON 调 `session.setConfig`（941 行，本页 #68 的证据链确认）——所以 max_tokens **确实**经 setConfig 下发；
   - 同时 655–658 行从参数中提取 `requestedMaxNewTokens`，687 行单独传给 `session.generateStream(safeHistory, requestedMaxNewTokens)`。
   - 正确表述：max_tokens 两条路都走——generateStream 参数 + configMap 经 setConfig。writer 误信了 846 行的过期注释"这里不设置"（注释与紧随其后的代码自相矛盾）。
   - 建议改写并补 ref :655。

2. **#61（ref :825）引用窗口违规。** 断言含"min_p→minP"，该映射在 834 行，超出 ref 825 的 ±5 窗口（820–830）。建议拆成两条：temperature/top_p/top_k 用 ref :829，min_p 单独用 ref :834。

3. **#26（ref :288）引用窗口违规。** 断言枚举 extForMimeType 全部分支（png/jpg/webp/gif + 音频 + 视频），但 gif 及之后分支在 294–301 行，超出 ±5 窗口。结论本身正确（已核对完整 when 块），建议拆成两条：图片/音频 ref :292，视频 ref :298。

4. **#66（ref :876）引用窗口违规。** 断言"自定义参数按 INT/FLOAT/BOOLEAN/STRING/OBJECT 类型透传"，但 FLOAT/BOOLEAN/STRING/OBJECT 分支在 882–894 行，超出 ±5 窗口。结论正确，建议按类型拆成两条或收窄断言。

其余 69 条：引用行号全部有效（1–1021 范围内，无越界、无重复行），断言均被 ±5 窗口源码支撑。抽查 #2/#6/#10/#14/#20/#30/#40/#50/#60/#70 全部属实。

### quality.json：5 条中 4 条通过，1 条需改

- 5 条 evidence **全部逐字命中源码**（全文 diff 验证通过），无虚构。
- severity/confidence 标注合理（Q0 runBlocking 逐 token 阻塞标 warning/medium；Q1 废弃 API 标 warning/high，属实）。
- **Q4 行号错位，必须改**："formatFileSize 用默认 locale"标注 `line: 950`，实际 evidence 在 **971–974** 行（950 行是 `applyModelParameters` 尾部）。改为 971。

### 正文 api-chat-mnn.md：通过

- §9 双受众结构完整：概述 / ## AI 速览 / 核心机制（7 小节）/ 关键符号 / 调用链（输入→处理→输出编号）/ 来源。
- 开头有"已停止维护"醒目标注（> ⚠️ 状态：已停止维护），符合要求。
- 术语首现有解释（端侧 on-device），符号名保留英文原文，来源引用精确到行。
- 正文数字断言已验真：单文件 1021 行、max_all_tokens 缺省 2048（:236）、max_tokens 缺省 512 上限 8192（:659）、prompt 预算最少 128（:660）。
- 注意：正文第 93 行"采样参数映射"小节若引用了 #63 的"不经 setConfig"说法，需同步修正。

### status.json：通过

- `{"id": "api-chat-mnn", "title": "MNN 端侧供应商（已停止维护）", "issue": 31, "status": "review-pending", "source_repo": "Operit", "source_commit": "dbf71916fae9750cfdc9f9a774f5a0fee56633fb"}`——与 brief（title/issue 31）一致，critic 字段留空正确。

## 待办（writer 修完后需复检）

- [ ] 重写 #63（max_tokens 双通道），ref 补 :655
- [ ] 拆分 #61（min_p 独立成条，ref :834）
- [ ] 拆分 #26（图片/音频 vs 视频）
- [ ] 拆分 #66（自定义参数类型分支）
- [ ] Q4 line 950 → 971
- [ ] 正文"采样参数映射"小节同步 #63 修正
- [ ] 修完后重跑 lint（保持 0/0）

## 复检（2026-10-01T13:55 CST，修错后复验）

**结论：通过。** 修错项全部验证合格，本页达到收货标准。

### 验证明细（全部用 sed 亲眼核实源码窗口）

**1. 事实错误 #63（max_tokens 双通道改写）——通过**
- idx 66 ref :657："requestedMaxNewTokens 从 max_tokens 参数单独提取，缺省 -1"——窗口 652–662 含 660–663 行提取代码 ✓
- idx 67 ref :686："requestedMaxNewTokens 作为生成上限参数传入 session.generateStream"——窗口 681–691 含 686 行 `session.generateStream(safeHistory, requestedMaxNewTokens)` ✓（避开与 idx 51 的 :687 重复）
- idx 68 ref :848："max_tokens 同时写入 configMap['max_new_tokens']"——窗口 843–853 含 851–855 行写入代码；846–847 行过期注释"这里不设置"确实与紧随其后的代码自相矛盾，断言中的注释说明属实 ✓

**2. 拆分 #61（采样参数）——通过**
- idx 62 :822（temperature 直传/top_p→topP）✓、idx 63 :831（top_k→topK，835–837 行在窗内）✓、idx 64 :836（min_p→minP，840–842 行在窗内）✓

**3. 拆分 #26（extForMimeType）——通过**
- idx 26 :294（图片 png/jpg/webp/gif + 音频 mp3/wav/ogg/webm，289–299 行全覆盖）✓、idx 27 :300（视频 mp4/webm/ogv）✓

**4. 拆分 #66（自定义参数类型）——通过**
- idx 71 :879（INT 分支）✓、idx 72 :887（FLOAT/BOOLEAN 分支在 882–896 行）✓、idx 73 :900（OBJECT 解析分支）✓

**5. 4 条重建 fact 逐条亲验——全部存在且正确**
- idx 25 :271："readModelCapabilities 结果缓存在 cachedModelIsVisual/cachedModelIsAudio"——窗口 266–276 含 275–276 行赋值 ✓
- idx 61 :816："applyModelParameters 只处理启用的参数"——窗口 811–821 含 820 行注释"只包含启用的参数" ✓（822 行的 `filter { it.isEnabled }` 距 ref 6 行，但 820 行注释本身直接陈述该断言，支撑充分）
- idx 65 :842："presence/frequency/repetition_penalty 统一映射为 MNN 的 penalty"——窗口 837–847 含 844–848 行 ✓
- idx 70 :866："n_gram→n_gram、ngram_factor 直接透传"——窗口 861–871 含 868–876 行 ✓

**6. quality Q4 line 971——通过**：evidence 3 行与源码 971–973 行逐字一致（含 12 空格缩进）✓

**7. 总数与完整性——通过**：facts 80 条，无缺失、无重复 ref、全部行号在 1–1021 范围内；721/711 顺序问题为 critic 已知的既有问题，非修错引入

**8. 正文同步——通过**：正文 103–107 行三段 max_tokens 表述（:655/:686/:848）全部到位，无"不经 setConfig"残留说法 ✓

**未通过条目：无。**
