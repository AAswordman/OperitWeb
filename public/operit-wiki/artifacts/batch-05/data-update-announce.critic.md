# Critic 报告：data-update-announce（应用更新与公告，Issue #72）

- 评审人：独立 critic
- 时间：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（git rev-parse 验真一致）
- 结论：**打回**（6 项硬问题，均为引用锚点错位，无断言虚构；修错员按清单改 ref 即可，不需要改断言）

## 核验方法

1. 用脚本对 123 条 facts 做机械校验：ref 文件存在、行号为整数且在该 commit 行数范围内 → **123/123 通过**。
2. 对 123 条 facts 逐条导出 `ref±5` 行窗口，逐条人工比对断言与窗口原文。
3. quality.json 9 条走查 evidence 逐条去缩进后在源码中检索逐字命中 → **9/9 通过**；6 条 warn 的证据链逐条复验。
4. 正文 5 文件全文 grep 禁用词（通过/批准/LGTM）与模糊词（可能/大概/似乎/应该/也许）。
5. status.json 字段逐项比对；lint.md 与 lint.py 规则交叉确认。

## 硬问题（必须修，共 6 项）

全部是"断言为真、ref 行号窗口内无支撑"的引用错位：

1. **[6]** `UpdateManager.kt:87` —— 复合事实跨窗口。断言含三个子断言："支持 1.7.0+1 形式"（✓）、"先去 v 前缀与 + 后缀"（支撑在 `parseVersion` 71-74 行）、"按 major/minor/patch/patchIndex 依次比较"（`patchIndex` 比较在 94 行）。ref :87 的窗口（82-92）只覆盖了部分。→ **拆分成两条**：`parseVersion` 去 v/取 + 后缀 → ref `:72`；`compareVersions` 比较顺序 → ref `:91`（窗口 86-96 覆盖 87-94 全比较链）。
2. **[11]** `UpdateManager.kt:141` —— "checkForUpdatesInternal 在 IO 线程执行" 的 `withContext(Dispatchers.IO)` 在 134 行，ref :141 的窗口（136-146）内只有 `betaEnabled` 读取，无 IO 线程证据。→ ref 改 `:134`。
3. **[18]** `UpdateManager.kt:223` —— "第 1 页前 20 个 release" 的 `page = 1, perPage = 20` 在 230 行，ref :223 的窗口（218-228）内只有 owner/repo 硬编码。→ ref 改 `:228`（窗口 223-233 同时覆盖 owner/repo 与 page/perPage）。
4. **[21]** `UpdateManager.kt:271` —— "补丁只在与当前版本相同 base version 内有效" 的检查在 253-256 行（`if (baseVersionOf(version) != currentBase) continue`），ref :271 的窗口（266-276）内只有附件匹配逻辑。→ ref 改 `:255`。
5. **[38]** `FullUpdateInstaller.kt:129` —— "分片按总量除以线程数均分，余数字节补给前几个分片" 的实际逻辑在 `splitRanges` 183-190 行，ref :129 的窗口（124-134）内只有 `splitRanges(...)` 调用。→ ref 改 `:186`。
6. **[52]** `PatchUpdateInstaller.kt:125` —— "先测速选镜像，再走内部补丁流程" 的 `selectFastestMirrorKeyWithProgress` 调用在 137 行、`downloadAndPreparePatchUpdateInternal` 在 144 行，ref :125 的窗口（120-130）内只有函数声明。→ ref 改 `:137`。

## 轻微（建议顺手修，不挡放行）

1. **[0]** `UpdateManager.kt:16` —— 六种状态横跨 16-33 行，窗口只含 Initial/Checking/Available 三种；建议拆成两条或 ref 改 `:25`。
2. **[12]** `UpdateManager.kt:143` —— "跳过补丁通道" 的 else→null 分支在窗口外；可接受，建议微调 ref 为 `:144`。
3. **[32]** `FullUpdateInstaller.kt:46` —— 行为摘要锚在函数入口，属惯例，可接受。
4. **[78]** `PatchUpdateInstaller.kt:962` —— "末尾 65557 字节" 的数值在 956 行，差 1 行出窗；建议 ref 改 `:956`。
5. `.lint.md` 第 8 行自指性写出"通过/批准/LGTM"字样（在描述"全文无禁用词"的句子里）。建议改写为"禁用词与模糊词扫描干净"，消除字面残留。

## 通过项

- **facts**：117/123 条逐条窗口语义支撑全部成立，无断言错误、无虚构；`34 个镜像前缀`已数出 `GITHUB_MIRRORS` 映射表确为 34 项；`MainActivity` 观察者 `else -> Unit`（[113]"只在"成立）；`compareVersions` 相等取正式版的 `>= 0` 逻辑（[17]）成立；`65557`、`256KB`、`64 步`、`2500ms`、`8 秒`、`300ms`、`128KB`、`6 线程` 等数值全部逐字命中。
- **quality.json**：9 条 evidence 全部逐字命中源码（去缩进差异后）；6 条 warn 分级合理、无夸大：
  - Q0 完整包下载无 SHA-256/签名校验：FullUpdateInstaller 全文件无 sha256/signature 校验，断言为真，warn 恰当（与补丁链的三重校验形成对照）。
  - Q1 静默检查吞异常（:112 `catch → AppLogger.w`）：为真。
  - Q2 beta 开关异常静默降级（:136-140）：为真。
  - Q3 补丁源仓库硬编码（:226-227）：为真（与正式版走 `about_website` 解析形成对照）。
  - Q4 补丁链 meta 取自 release 正文（:415 `parseReleaseBodyAsPatchMeta(release.body)`）：为真。
  - Q5 镜像测速 256KB×68 实测流量（`SPEED_TEST_BYTES = 256 * 1024L`，34 镜像 × patch/meta 2 URL）：为真，warn 恰当。
- **正文 .md**：结构齐全（概述 / ## AI 速览 / 核心机制 5 节 / 关键符号表 / 输入→处理→输出三链路 / 来源）；符号名均为英文原名；正文断言与 facts 无矛盾（"不做 SHA-256/签名校验只保证字节下全""meta 来自 release 正文""纯 Text 不解析 HTML"等均与 facts/quality 一致）；正文、facts、quality、status 四文件无禁用词与模糊词。
- **status.json**：`issue: 72`（整数）、`status: "review-pending"`、`source_repo: "operit"`、`source_commit` 与钉住 commit 一字不差；`refs_valid: "123/123 …，lint 硬失败 0/警告 0"` 格式与事实相符（机械校验确实 123/123）。
- **lint.md**：lint.py 已跑（单页隔离），0 硬失败 / 0 警告；自查说明与真实执行记录一致。

## 复验要求

修错员按上述 6 项硬问题改 ref（或拆分 [6]）后，须派**独立** critic 复验，不可用修错员自报代替。预期复验结果：123/123 窗口支撑全成立。

---

## 复验（第二轮）

- 复验人：独立复验 critic（非第一轮 critic，非修错员）
- 时间：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（git rev-parse 验真一致）
- 结论：**通过**（修错合格，可上评审站）

### 复验方法

独立重做全部机械核验，不信任修错员报告：

1. **源码逐条核**：原 6 项硬问题的全部修复点，用 awk 逐条导出 `ref±5` 行窗口人工比对——**8 条全成立**。
2. **全量机械校验**：125 条 facts 的 ref 文件存在、行号整数、在文件行数范围内 → **125/125 通过**，无重复 ref。
3. **抽样人工核**：16 条跨文件抽样（UpdateManager/Full/Installer/Announcement/GithubReleaseUtil/MainActivity/Dialog）±5 窗口逐条比对 → **16/16 支撑成立**。
4. **quality.json 独立核**：9 条 evidence 去缩进后源码逐字检索 + 声明行号对齐 → 8/9 行号对齐、9/9 逐字命中（见轻微观察）；6 warn + 3 suggestion 分级均不夸大。
5. **禁用词/模糊词**：5 文件全文 grep（通过/批准/LGTM + 可能/大概/似乎/应该/也许）→ 全干净；lint.md 自指措辞已改写（"禁用词与模糊词扫描干净"）。
6. **status.json**：`issue: 72`（整数）、`status: "review-pending"`、`source_repo: "operit"`、`source_commit` 与钉住 commit 一字不差、`refs_valid` "125/125" 格式相符。
7. **lint 独立隔离重跑**：四文件拷至 /tmp 隔离目录跑 `scripts/lint.py` → **0 硬失败 / 0 警告**。
8. **正文结构**：概述 / ## AI 速览 / 核心机制 5 节 / 关键符号 / 输入→处理→输出调用链 / 来源齐全；frontmatter 与源码版本标注正确；符号名英文原文。

### 修错点逐项复验结果

| # | 修复 | 复验结论 |
|---|------|---------|
| [6]拆2 | :72 parseVersion（去 v/取 + 后缀作 patchIndex） | ✓ 窗口 67-77 含 removePrefix("v")/indexOf('+')/patchIndex 解析 |
| [6]拆2 | :91 compareVersions（major/minor/patch/patchIndex） | ✓ 窗口 86-96 含四级比较全链 |
| [11] | :134 | ✓ `withContext(Dispatchers.IO)` + 136-137 isBetaPlanEnabled |
| [18] | :228 | ✓ 窗口含 230 行 `page = 1, perPage = 20` |
| [21] | :255 | ✓ `if (baseVersionOf(version) != currentBase)` + x.y.z 注释 |
| [38] | :186 | ✓ `remainder = totalBytes % threadCount` + 190 行 `i < remainder` 补前分片 |
| [52] | :137 | ✓ `selectFastestMirrorKeyWithProgress` 调用（见轻微观察） |
| [0]拆2 | :16/:28 | ✓ :16 窗口含密封类/Initial/Checking/Available/"移除下载相关状态"注释；:28 窗口含 PatchAvailable/UpToDate/Error |
| [78] | :956 | ✓ `min(65557L, fileLen)` + readCentralDirectory 上下文 |

修错后 125 条（原 123 + 拆 4 条复合事实 = +2…注：第一轮后修错员报告拆 4 条复合 facts，123→125 账对上）。

### 轻微观察（不挡放行，供顺手修）

1. **quality.json Q2**：`line` 声明为 141，evidence 首行 `val betaEnabled = try {` 实际在 **136** 行（证据块 136-140；141 为空行）。证据逐字命中成立、断言为真、分级恰当，且 ±5 窗口（136-146）完整支撑。建议顺手改 `line: 136`。
2. **facts [52]**：断言后半句"再走内部补丁流程"对应的 `downloadAndPreparePatchUpdateInternal` 调用在 **144** 行，位于 ref :137 的 ±5 窗口（132-142）之外 2 行。断言为真（已读源码确认 144-150 行），但严格按窗口标准第二半句略出窗；若要完全合规可改 ref 为 :139（窗口 134-144 同时覆盖 137 调用与 144 内部调用）。
