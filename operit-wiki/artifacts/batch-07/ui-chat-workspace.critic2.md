# 复验报告 — ui-chat-workspace（Issue #95）第二轮独立 critic

- 复验日期：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核 `git rev-parse` = dbf71916）
- 交付物：`review/batch-07/ui-chat-workspace.{md,facts.json,quality.json,lint.md,status.json}`
- 修错员自报：facts 201→211、44 处锚点改动、F104/F148/F156/F175 拆分、补 6 条新 facts、lint 0/0
- 核验方式：211 条 facts 全部做 ref 合法性检查（0 非法/0 空窗口）+ 标识符回声扫描（18 个零回声候选逐条拉窗口人工核对）+ 第一轮 critic 表 32 处改锚逐条关键词验真 + 拆分项/新增项逐条核对；21 条 quality evidence 程序化逐字验真；lint /tmp 隔离独立重跑；正文/状态/禁用词逐项核验。未改动任何交付文件。

## 总体结论

**verdict: FAIL**（5 处锚点漂移需修，均为第一轮 critic 遗漏的旧漂移，非修错员引入）

## 一、修错确认（PASS 项）

1. **F74 虚假断言已修好**：[73] 改写为"仅 web 项目模板默认启用导出"，ref WorkspaceUtils.kt:322。实地核对：`generateWebProjectConfig`（:306）的 `"export": { "enabled": true }`（:322-323）；其余 9 种模板（blank :124 / android :209 / flutter :296 / node :381 / typescript :448 / python :511 / java :588 / go :644 / office :672）均为 `"enabled": false`。结论为真。
2. **第一轮 critic 表 32 处改锚全部验真**：F5 :104（SOCK_CLOEXEC）、F23 :723（CookieManager）、F24 :750（transfer-encoding）、F25 :821（addCorsHeaders）、F79 :87、F95 :60（move_file/make_directory）、F103 :661（__default__）、F110 :1010（estimateChangedLines）、F111 :254、F112 :678、F113 :8、F115 :20、F128 :136（Uri.fromFile）、F130 :48（2.5f）、F131 :73（memoryCachePolicy(CachePolicy.DISABLED)）、F133 :234（clampImageOffset）、F134 :174（BottomStart）、F135 :167、F144 :530、F146 :1259、F147 :1418（fab_menu_offset）、F151 :724、F154 :97（isPdf）、F155 :122、F171 :28（EVENT_MASK）、F176 :113（kindFor）、F179 :171、F186 :48（escapeText）、F188 :65、F189 :107、F190 :126（aiChangedPaths.add/changes.remove）、F195 :33——窗口逐条核对，全部支撑断言。
3. **拆分项验真**：[103] SHA-256（:630）/[104] 分片+legacy（:690，objectsDir 命中）；[148] FAB 菜单 7 回调（:1400，窗口 :1394-1405 含 onExportClick/onFileManagerClick/onUndoClick/onRedoClick/onFormatClick/onUnbindClick/onRenameWorkspaceClick，:1405 在边界内）/[149] 格式化范围（:1052）；[157] read_file_binary（:353）/[158] 缓存目录（:372）；[177] 新建目录自动 watch（:145，watchDirectory 命中）/[178] 删除移除 observer（:152，removeDirectoryObservers 命中）。
4. **新增 6 条 facts 验真**：[205] baseUrl file://（:907，loadDataWithBaseURL/file:// 命中）/[206] StreamMarkdownRenderer（:146）/[207] 重命名未保存先提示（:1042，unsaved 命中）/[208] 键盘隐藏 FAB（:1002，ExpandableFabMenu 命中）/[209] isAudio（:811）/[210] isVideo（:845）——全部为真且锚点正确。
5. **Q1 evidence**：已追加 `) : NanoHTTPD(port) {`（LocalWebServer.kt:53），逐字验真通过。
6. **quality 21 条**：evidence 程序化逐字验真 21/21 命中；severity 仅 high/warn/suggestion（2/12/7）；描述与源码一致——PASS。
7. **lint 独立重跑**：`/tmp` 隔离 `lint.py --src ~/workspace/Operit --dir`：**0 硬失败 / 0 警告**——PASS。
8. **禁用词**：md/facts/quality 全文"通过/批准/LGTM" 0 命中——PASS。
9. **正文**：来源小节"原子事实（211 条），代码走查（21 条：高危 2 / 警告 12 / 建议 7）"与文件一致；21 种子文件/9758 行与第一轮一致——PASS。
10. **status.json**：refs_valid=211 = facts 条数，status=review-pending，未擅自批准——PASS。
11. **复合断言扫描**：0 候选——PASS。

## 二、必须修的问题（5 处行锚漂移，第一轮 critic 遗漏）

| # | 现 ref | 应改为 | 说明 |
|---|---|---|---|
| [86] | FileManager.kt:249 | **:238** | fact"添加 SAF 书签用 OpenDocumentTree 并 takePersistableUriPermission 做持久授权"；现窗口 :243-254 只有书签名对话框。实锤：`ActivityResultContracts.OpenDocumentTree()` 在 :234，`takePersistableUriPermission` 在 :238；:238 的 ±5 窗口（:232-243）同时覆盖两者 |
| [87] | FileManager.kt:295 | **:286** | fact"SAF 书签名做忽略大小写的重复检查"；现窗口 :289-300 只有 addSafBookmark 调用。实锤：`it.name.equals(name, ignoreCase = true)` 在 :286 |
| [97] | WorkspaceBackupManager.kt:126 | **:135** | fact"onToolExecutionStarted 只处理变更文件工具，并调用 WorkspaceChangeTracker.ignoreAiChanges 去重"；现窗口 :120-131 只有 WorkspaceToolHookSession 类声明。实锤：`override fun onToolExecutionStarted` 在 :135 |
| [106] | WorkspaceBackupManager.kt:590 | **:571** | fact"目录变更时用 find_files 枚举其下全部文本文件逐个快照"；现窗口 :584-595 只有 FindFilesResultData 结果映射，看不到工具调用。实锤：`name = "find_files"` 的 AITool 调用在 :571 |
| [125] | WorkspaceFilePreviewSupport.kt:83 | **:91** | fact"isReadOnlyDocumentPreviewable 覆盖 pdf 与 Word/Excel 文档"；现窗口 :77-88 不含定义行。实锤：`internal val OpenFileInfo.isReadOnlyDocumentPreviewable: Boolean get() = isPdf \|\| isWordDocument \|\| isSpreadsheetDocument` 在 :91-92 |

以上 5 处均为"结论为真、锚点指错"，每处修正锚点均为本次复验实地 grep/sed 核对。

## 三、观察项（非阻塞）

- [73] F74 的 :322 窗口（:316-327）含 `"export": { "enabled": true }`，但不含 `generateWebProjectConfig` 函数名（:306）与 `"projectType": "web"`（:309），"仅 web"的排他性需文件上下文支撑。排他性已由第一轮 critic 对 10 个模板逐一验真，本轮复核 9 处 false 无误。可接受，不列为 FAIL。
- [34] WebViewHandler.kt:96 的窗口未出现 `downloadBlob` 标识符，但窗口内 `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)` 完整支撑"写入公共 Downloads 目录"断言，且 :96 位于 downloadBlob 函数体内。可接受。
- [132] WorkspaceImagePreview.kt:120 的窗口用 `WORKSPACE_IMAGE_MIN_SCALE` / `WORKSPACE_IMAGE_DOUBLE_TAP_SCALE` 常量名支撑"1x 与 2.5x"，数值定义在 :48-49。行为在窗口内，数值需跳转。可接受。

## 四、需修清单（修错员用）

1. 上表 5 处行锚按"应改为"列修正（均为实地核对，勿估算）。
2. facts 条数不变（211），status.json 无需改动；修完后重新跑隔离 lint。
3. 修完后建议由 parent 做机械抽查即可（5 处均为单行锚点移动，无事实争议），或再派独立 critic 抽查。

## 最终 verdict

**FAIL** —— 5 处行锚漂移（[86]→:238、[87]→:286、[97]→:135、[106]→:571、[125]→:91）。其余 206 条 facts、21 条 quality、lint、禁用词、正文计数、status 全部 PASS。修完 5 处锚点后可翻 PASS。
