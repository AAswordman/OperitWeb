# Critic 报告：util-search（Issue #88）

- 复核对象：`review/batch-06/util-search.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 复核方式：81 条 facts 逐条打出 `file:line ±5` 窗口人工比对；12 条 quality evidence 与源码逐字比对；正文行内引用逐条核对；种子覆盖与 status 字段核对。
- 结论用词：PASS / FAIL（不使用禁用词）。

## 一、facts.json 逐条结论

| # | ref | 结论 | 说明 |
|---|---|---|---|
| 1 | VectorIndexManager.kt:14 | PASS | 泛型约束与源码一致 |
| 2 | VectorIndexManager.kt:14 | PASS | 三个构造参数在窗口内 |
| 3 | VectorIndexManager.kt:19 | PASS | |
| 4 | VectorIndexManager.kt:22 | PASS | |
| 5 | VectorIndexManager.kt:29 | PASS | |
| 6 | VectorIndexManager.kt:29 | PASS | `as` 转型即 unchecked cast，表述可接受 |
| 7 | VectorIndexManager.kt:33 | PASS | |
| 8 | VectorIndexManager.kt:35 | PASS | |
| 9 | VectorIndexManager.kt:36 | PASS | |
| 10 | VectorIndexManager.kt:48 | PASS | |
| 11 | VectorIndexManager.kt:54 | PASS | |
| 12 | VectorIndexManager.kt:59 | PASS | |
| 13 | VectorIndexManager.kt:63 | PASS | |
| 14 | VectorIndexManager.kt:65 | PASS | |
| 15 | VectorIndexManager.kt:67 | PASS | |
| 16 | VectorIndexManager.kt:75 | PASS | |
| 17 | VectorIndexManager.kt:80 | PASS | |
| 18 | VectorIndexManager.kt:82 | PASS | |
| 19 | VectorIndexManager.kt:88 | PASS | |
| 20 | IndexItem.kt:11 | PASS | |
| 21 | IndexItem.kt:12 | PASS | |
| 22 | IndexItem.kt:14 | PASS | |
| 23 | IndexItem.kt:15 | PASS | 注释确为例举 Memory / DocumentChunk |
| 24 | IndexItem.kt:11 | PASS | `: Item<Id, FloatArray>` 在窗口内（16 行） |
| 25 | IndexItem.kt:20 | PASS | |
| 26 | IndexItem.kt:27 | PASS | |
| 27 | IndexItem.kt:32 | PASS | |
| 28 | NativeRipgrep.kt:3 | PASS | |
| 29 | NativeRipgrep.kt:5 | PASS | |
| 30 | NativeRipgrep.kt:9 | PASS | |
| 31 | NativeRipgrep.kt:9 | FAIL | 见 F31 |
| 32 | lib.rs:49 | PASS | |
| 33 | lib.rs:48 | PASS | |
| 34 | lib.rs:56 | PASS | `_literal` 在其他处确未使用 |
| 35 | lib.rs:66 | FAIL | 见 F35 |
| 36 | lib.rs:19 | PASS | |
| 37 | lib.rs:26 | PASS | 5 个字段全在窗口内（21–31 行） |
| 38 | lib.rs:126 | PASS | 备注：源码是 `path.trim().is_empty()`，空白串同样触发，fact 写"为空字符串"为轻微窄化，可接受 |
| 39 | lib.rs:121 | FAIL | 见 F39 |
| 40 | lib.rs:150 | PASS | |
| 41 | lib.rs:160 | PASS | |
| 42 | lib.rs:161 | PASS | |
| 43 | lib.rs:169 | PASS | |
| 44 | lib.rs:257 | FAIL | 见 F44 |
| 45 | lib.rs:212 | PASS | |
| 46 | lib.rs:221 | PASS | |
| 47 | lib.rs:226 | FAIL | 见 F47 |
| 48 | lib.rs:174 | FAIL | 见 F48 |
| 49 | lib.rs:198 | FAIL | 见 F49 |
| 50 | lib.rs:206 | PASS | |
| 51 | lib.rs:283 | PASS | |
| 52 | lib.rs:287 | PASS | |
| 53 | lib.rs:296 | FAIL | 见 F53 |
| 54 | lib.rs:318 | PASS | |
| 55 | lib.rs:323 | PASS | |
| 56 | lib.rs:334 | PASS | |
| 57 | lib.rs:339 | PASS | 按 `chars().count()` 截断确为字符数 |
| 58 | lib.rs:348 | PASS | |
| 59 | lib.rs:87 | PASS | |
| 60 | Cargo.toml:1 | PASS | name/version 在窗口内（2–3 行） |
| 61 | Cargo.toml:8 | PASS | `crate-type = ["cdylib"]` 在 7 行，窗口内 |
| 62 | Cargo.toml:15 | PASS | 全部依赖在窗口内（10–16 行） |
| 63 | MemoryRepository.kt:375 | PASS | |
| 64 | MemoryRepository.kt:332 | PASS | id/value/version 三处赋值全在窗口内 |
| 65 | MemoryRepository.kt:332 | PASS | |
| 66 | MemoryRepository.kt:343 | FAIL | 见 F66 |
| 67 | MemoryRepository.kt:293 | PASS | |
| 68 | MemoryRepository.kt:297 | PASS | |
| 69 | MemoryRepository.kt:376 | PASS | `deleteIndexFileIfExists` + 全量 `addItem` 在窗口内 |
| 70 | MemoryRepository.kt:383 | PASS | |
| 71 | MemoryRepository.kt:590 | PASS | 备注：`queryVector` 是对 `queryEmbedding.vector` 的意译，非源码符号名；`availableCount = manager.size()` 在 585 行，窗口内 |
| 72 | MemoryRepository.kt:600 | FAIL | 见 F72 |
| 73 | StandardFileSystemTools.kt:272 | FAIL | 见 F73 |
| 74 | StandardFileSystemTools.kt:282 | PASS | `literal = false` 在 287 行，窗口内 |
| 75 | StandardFileSystemTools.kt:282 | FAIL | 见 F75 |
| 76 | StandardFileSystemTools.kt:294 | PASS | |
| 77 | StandardFileSystemTools.kt:162 | PASS | 5 字段全在窗口内（162–167 行） |
| 78 | StandardFileSystemTools.kt:531 | FAIL | 见 F78 |
| 79 | StandardFileSystemTools.kt:4658 | FAIL | 见 F79 |
| 80 | build_native_ripgrep.ps1:69 | PASS | `$source`/`$destinationDir`/`Copy-Item` 全在窗口内 |
| 81 | build.gradle.kts:579 | PASS | |

### FAIL 详情（facts）

- **F31**（引用窗口违规）：fact 列出 7 个 JNI 参数（含 `contextLines`、`maxResults`），但 ref `:9` 的 ±5 窗口（4–14 行）只覆盖到 `literal`（14 行）；`contextLines` 在 15 行、`maxResults` 在 16 行，落在窗口外。修：ref 改为 `:12`。
- **F35**（引用窗口违规）：“出错时返回 success=false 的 SearchResponse”真正的分支在 73–78 行（`Err(error) => SearchResponse { success: false, … }`），ref `:66` 的窗口（61–71 行）只含 `let response = match result {` 的开头，未覆盖关键分支。修：ref 改为 `:73`。
- **F39**（引用窗口违规）：fact 后半句“过滤后为空则返回 "pattern is required" 错误”对应 130 行，ref `:121` 的窗口（116–126 行）未覆盖。修：拆成两条或 ref 改为 `:125`。
- **F44**（引用窗口违规）：“含 NUL 字节即判为二进制”对应 `buffer[..size].contains(&0)` 在 264 行，ref `:257` 的窗口（252–262 行）未覆盖。修：ref 改为 `:260`。
- **F47**（引用窗口部分违规）：fact 称排除 `.backup`、`.operit`、`backup` 三个目录，ref `:226` 的窗口（221–231 行）只出现 `.backup/**`、`**/.backup/**`、`.operit/**`，`backup/**` 与 `**/backup/**` 在 233–234 行，落在窗口外。修：ref 改为 `:230`。
- **F48**（引用窗口违规）：“命中文件数达到 maxResults 后立即停止遍历”对应 `blocks.push` + `if blocks.len() >= options.max_results { break; }` 在约 182–186 行，ref `:174` 的窗口（169–179 行）未覆盖。修：ref 改为 `:182`。
- **F49**（引用窗口违规，差 1 行）：“支持 case_insensitive 开关”对应 `builder.case_insensitive(…)` 在 204 行，ref `:198` 的窗口（193–203 行）未覆盖。修：ref 改为 `:201`。
- **F53**（引用锚点错误）：`BTreeSet` 去重合并实际在约 302–310 行，ref `:296` 的窗口（291–301 行）内根本没有 `BTreeSet`（296 行是 `for` 循环的闭括号）。修：ref 改为 `:305`。
- **F66**（引用窗口违规）：“version 和 value 都取 chunk.id”对应 349–350 行，ref `:343` 的窗口（338–348 行）未覆盖。修：ref 改为 `:346`。
- **F72**（断言失实 + 复合事实）：“逐条重算 cosineSimilarity 排序”——`getSemanticMemoryCandidatesFromIndex`（595–604 行）只做回查和重算相似度，**函数内没有排序**；排序发生在调用方 `MemoryRepository.kt:1433`（`.sortedByDescending { it.second }`）。fact 把调用方的行为安到了本函数头上，且一条 fact 含"回查 + 重算 + 排序"三个断言。修：拆成两条，"排序"一条 ref 指向 `:1433` 的调用处。
- **F73**（引用窗口违规）：“在 Dispatchers.IO 上执行”对应 `withContext(Dispatchers.IO)` 在 280 行，ref `:272` 的窗口（267–277 行）未覆盖。修：ref 改为 `:276`。
- **F75**（引用窗口违规，差 1–2 行）：`coerceAtLeast(0)` 在 288–289 行，ref `:282` 的窗口（277–287 行）未覆盖。修：ref 改为 `:285`。
- **F78**（引用窗口违规）：“maxResults=0 时直接返回空结果”对应 `if (effectiveMaxResults == 0)` 在 543 行及之后返回体，ref `:531` 的窗口（526–536 行）只有函数签名。修：ref 改为 `:543`。
- **F79**（事实错误——工具名虚构）：“search_code 工具的执行入口”——代码库中**不存在**名为 `search_code` 的工具；`ToolRegistration.kt:2223` 注册的工具名是 `grep_code`（`name = "grep_code"`，executor 调 `fileSystemTools.grepCode(tool)`）。全仓库 grep 确认无 `search_code` 字样。修：fact 与正文中所有 `search_code` 改为 `grep_code`。

## 二、quality.json 逐条结论

| # | severity | 结论 | 说明 |
|---|---|---|---|
| Q1 | high | PASS | evidence `indexFile.delete()` 与 33 行逐字一致；"加载失败删全索引文件"属数据丢失类，high 合理 |
| Q2 | high | PASS | evidence 与 29 行逐字一致；描述已注明"文件位于应用私有目录，风险可控"，high 可接受 |
| Q3 | warn | PASS | evidence `    _literal: jboolean,` 与 56 行逐字一致 |
| Q4 | warn | PASS | evidence 与 NativeRipgrep.kt:5 逐字一致 |
| Q5 | warn | FAIL | **行号错误**：evidence `.unwrap_or(std::ptr::null_mut())` 实际在 **89** 行，不是 87 行（87 行是 `env.new_string(json)`）。修：line 改为 89 |
| Q6 | warn | FAIL | **行号错误**：evidence `text.replace(…)` 实际在 **349** 行，不是 348 行（348 行是 `fn escape_json_fragment` 声明）。修：line 改为 349 |
| Q7 | warn | PASS | evidence 与 287 行逐字一致 |
| Q8 | warn | FAIL | **行号错误**：evidence `} catch (e: IOException) {` 实际在 **81** 行，不是 82 行（82 行是日志行）。修：line 改为 81 |
| Q9 | suggestion | FAIL | **行号错误**：evidence `return index?.findNearest(query, k)?.map { it.item() } ?: emptyList()` 实际在 **60** 行，不是 59 行（59 行是函数签名）。修：line 改为 60 |
| Q10 | suggestion | PASS | evidence 与 27 行逐字一致 |
| Q11 | suggestion | PASS | evidence 三行与 88–90 行逐字一致 |
| Q12 | suggestion | FAIL | **行号错误**：evidence `let mut buffer = [0u8; 8192];` 实际在 **262** 行，不是 257 行（257 行是 `fn is_probably_binary` 声明）。修：line 改为 262 |

severity 总体合理：2 high 均为真实风险（索引文件整体删除、Java 原生反序列化），无夸大；warn/suggestion 分级恰当。severity 取值仅 high/warn/suggestion，格式合规。

## 三、正文（util-search.md）核对

- 结构合规：概述 / AI 速览 / 核心机制 / 关键符号 / 输入→处理→输出 / 来源齐全；双受众（人话 + 符号原文）达标。
- 行内引用：大部分与 facts 一致；以下问题：
  1. **工具名错误**（4 处）：“`search_code` 工具底层走的就是它”（概述）、“`search_code` 工具的搜索执行体”（关键符号表）、“`search_code` 工具参数”（链路 3）、“`search_code` 工具的搜索执行”（来源）。实际注册工具名为 `grep_code`。**必须全改为 `grep_code`**。
  2. **来源小节文件行数错误**（3 处）：`VectorIndexManager.kt` 标注"113 行"，实际 **91** 行；`IndexItem.kt` 标注"46 行"，实际 **34** 行；`NativeRipgrep.kt` 标注"17 行"，实际 **18** 行。`lib.rs` 的 350 行正确。**必须更正**。
  3. **无来源断言**：概述"速度比纯 Kotlin 实现快得多"——全仓库无任何基准数据支撑该比较。**必须删除或改写为中性表述**（如"经由 JNI 调用 Rust 实现"）。
  4. 其余行内引用与源码一致；"检索后回查 memoryBox、逐条重算 cosineSimilarity 排序"一句同样受 F72 影响，随 F72 一并修正。
- 种子覆盖：`util/vector/` 2 个 kt、`util/ripgrep/` 1 个 kt、`tools/native_ripgrep/lib.rs`、`Cargo.toml`、`build_native_ripgrep.ps1` 全部覆盖；页面问题（HNSW 实现、持久化、ripgrep JNI、记忆/RAG 调用链）全部涉及。覆盖 PASS。
- frontmatter `sources: 9` 与实际列出的来源数（6 种子 + 2 调用方 = 8）对不上，建议核对修正（小问题）。

## 四、status.json / lint.md 核对

- `status.json`：id=`util-search`、issue=88、status=`review-pending`、source_repo=`operit`、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb` 全部正确；`refs_valid: 81` 与 facts 数组长度一致；critic 为空（待本次复核结论填入）。PASS。
- `lint.md`：为 lint 过程记录，非评审页面；内容属实。PASS。
- 5 文件禁用词（通过/批准/LGTM）扫描：0 命中。PASS。
- facts.json / quality.json 均为顶层数组，severity 取值合规。PASS。

## 五、总体 verdict

**FAIL** —— 必须修完以下清单才能放行：

**facts（14 条）：**
1. F31：ref `:9` → `:12`（maxResults/contextLines 参数出窗口）
2. F35：ref `:66` → `:73`（success=false 分支）
3. F39：ref `:121` → `:125` 或拆条（"pattern is required" 在 130 行）
4. F44：ref `:257` → `:260`（NUL 检查在 264 行）
5. F47：ref `:226` → `:230`（backup 排除项在 233–234 行）
6. F48：ref `:174` → `:182`（break 逻辑在 182–186 行）
7. F49：ref `:198` → `:201`（case_insensitive 在 204 行）
8. F53：ref `:296` → `:305`（BTreeSet 实际在 302 行起，296 是错锚）
9. F66：ref `:343` → `:346`（version/value 赋值在 349–350 行）
10. F72：拆条；"排序"一条 ref 改为调用方 `MemoryRepository.kt:1433`，本函数只做回查+重算
11. F73：ref `:272` → `:276`（Dispatchers.IO 在 280 行）
12. F75：ref `:282` → `:285`（coerceAtLeast 在 288–289 行）
13. F78：ref `:531` → `:543`（maxResults==0 早返在 543 行）
14. F79：`search_code` → `grep_code`（该工具名在代码库中不存在，注册名为 `grep_code`，见 ToolRegistration.kt:2223）

**quality（5 处行号）：** Q5: 87→89；Q6: 348→349；Q8: 82→81；Q9: 59→60；Q12: 257→262。

**正文（3 类）：** 4 处 `search_code` → `grep_code`；来源小节 3 个文件行数更正为 91/34/18；删除"快得多"无来源比较。

修完后需由**另一名独立 critic**复验（本次 critic 不得复验自己的结论），复验范围至少覆盖上述 22 项修正点。
