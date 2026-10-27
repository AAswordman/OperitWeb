# Critic 复核报告：data-backup-export（数据备份、恢复与导入导出）

- 复核对象：`review/batch-05/data-backup-export.{md,facts.json,quality.json,lint.md,status.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：182 条 facts 全量机械校验（文件存在、行号整数、不越界）+ 关键词启发式筛查 14 条可疑逐条人工核窗 + 每 6 条 1 条抽样 31 条逐条人工核窗；quality 13 条 evidence 全部脚本逐字命中 + 3 条高危逐条人工核证据链；正文全部具体断言对照源码抽验；全文 grep 禁用词；status.json 字段核对；lint 单页隔离独立复跑。

## 结论：打回（仅 4 项轻微，无硬问题）

**硬问题：0。** 182 条 facts 断言全部为真，无虚构引用、无错误断言；13 条 quality evidence 全部逐字命中源码；3 条高危分级合理无夸大；正文结构齐全、与 facts 无矛盾；禁用词 5 文件全 0；lint 独立复跑 0 硬失败/0 警告；status.json 字段全对（issue 69 整数、review-pending、source_repo=operit、source_commit 一致）。

### 需修正（4 项轻微）

1. **F157 ref 锚点弱**：`ChatHistoryManager.kt:204` 的 ±5 窗口（199–209）只看到 `exportOperitArchiveJsonStream` 函数签名，看不到断言中的 `archiveType`/`formatVersion`/`exportedAt` 写入（实际在 213–217 行）。断言为真，建议 ref 改为 `:213`。
2. **F163 ref 锚点弱**：`ChatHistoryManager.kt:355` 的 ±5 窗口只看到 `importOperitChatHistoriesStream` 签名，看不到"兼容归档对象与旧版数组"（实际 `BEGIN_OBJECT` 分支在 364 行、`BEGIN_ARRAY` 分支在 393 行）。断言为真（已逐行核对两分支），建议 ref 改为 `:364`。
3. **F160 ref 差 1 行出窗**：`ChatHistoryManager.kt:2032` 的 ±5 窗口（2027–2037）只看到 `catch (e: Exception) {`，删除未完成文件的逻辑在 2038–2043 行（`pendingExportFile?.let { ... delete() }`）。断言为真，建议 ref 改为 `:2038`。
4. **F78 轻度复合**："`ensureScheduled` 注册 24 小时周期 Worker，并要求存储空间不低"含两个断言（周期 + 约束），虽 ±5 窗口内两者都看得到，建议拆成两条以符原子化铁律。

### 通过项（摘要）

- **facts**：182/182 行号真实存在不越界；人工核窗 45 条（14 可疑 + 31 抽样）断言全部为真，含数值断言（FORMAT_VERSION=1、64KB 分块、凌晨 3 点对齐、`room_db_backup_<ISO日期>.zip` 命名、DATABASE_VERSION=21 等）逐条验真。
- **quality**：13/13 evidence 逐字命中；3 条高危逐条核证据链通过——
  - Q0（RawSnapshotBackupManager.kt:588 先删后拷无回滚）：`replaceDirContents` 先 `deleteRecursively()` 再 `copyDir()`，中途失败无回滚路径，high 合理；
  - Q1（TokenUsageRepository.kt:28 Mutex 覆盖不足）：`databaseAccessMutex` 注释明写防恢复期访问，但只有该类自身 `withDatabaseAccess`/`withDatabaseRestore` 持有，其他 DAO 不走这把锁，high 合理；
  - Q2（OperitPaths.kt:31 明文备份存公共 Download）：`operitRootDir()=downloadsDir()/Operit`，快照 payload 含 `shared_prefs`，high 合理。
- **正文**：六段结构齐全（概述/AI 速览/核心机制/关键符号/输入→处理→输出/来源）；符号英文原名；"源码无 `data/importer/` 目录"断言已用 `git ls-tree` 在钉死 commit 上验真（确不存在，`data/converter/` 存在）；"九种 ChatFormat"与 `ChatFormat.kt` 枚举 9 个成员一致；与 facts 无矛盾；quality 发现未写入正文。
- **lint.md**：自查记录与独立复跑一致（0/0）；模糊词已清除。
- **禁用词**：4 个交付文件 grep"通过/批准/LGTM"全 0（含 .lint.md）。

文件未动。修错员修正上述 4 项后，请独立 critic 复验（重点复核 3 个新 ref 行号的 ±5 支撑）。

## 复验（第二轮）

- 复验时间：2026-10-01（独立复验方，非首轮 critic、非修错员）
- 复验范围：修错员修正的 4 项（F157/F163/F160 重锚、F78 拆分）+ 全量复查

### 修正项逐项独立核验（源码均在 Operit @ dbf71916 逐行确认，未采信修错员报告）

1. **F157 → ChatHistoryManager.kt:213** ✅
   - 213 行 `writer.append("  \"archiveType\": ")`、216 行 formatVersion、217 行 exportedAt、218 行 chats 数组；±5 窗口（208–218）四字段写入全覆盖，断言"写入 archiveType、formatVersion、exportedAt 与 chats 数组，逐会话流式 flush"成立。
2. **F163 → ChatHistoryManager.kt:364** ✅
   - 364 行 `when (reader.peek()) {` 为分发点，369 行 `JsonToken.BEGIN_OBJECT` 分支（旧版 BEGIN_ARRAY 分支在 393 行，首轮 critic 已逐行核对两分支为真）；单锚点落在分发语句，±5 窗口覆盖 JsonReader 流式 setup（362 行）与 BEGIN_OBJECT 分支头（369 行），可接受。
3. **F160 → ChatHistoryManager.kt:2038** ✅
   - 2037 行 `} catch (e: Exception) {`、2038–2042 行 `pendingExportFile?.let { incompleteFile -> if (incompleteFile.exists() && !incompleteFile.delete()) {...} }`；±5 窗口（2033–2043）完整支撑"导出失败时删除未完成的导出文件"。
4. **F78 拆分** ✅
   - [77] ref `:27`：27 行 `PeriodicWorkRequestBuilder<RoomDatabaseBackupWorker>(24, TimeUnit.HOURS)`，单断言"24 小时周期注册 Worker"成立；
   - [78] ref `:22`：22 行 `.setRequiresStorageNotLow(true)`（21 行 `Constraints.Builder()`），单断言"加 Constraints 要求存储空间不低"成立；
   - 拆分后原子化铁律符合，facts 总数 182 → 183。

### 全量复查

- **facts**：183/183 程序化校验（文件存在、行号在该 commit 范围内、条目仅 fact/ref 双键）0 坏引用；另人工抽样 15 条（含 4 个修正项）±5 窗口逐条对照源码，断言全部为真。
- **quality**：13 条未被修错员改动，沿用首轮结论；复验 3 条 high 的 evidence 逐字命中源码（归一化缩进后 diff 命中）且行号在界——Q0（RawSnapshotBackupManager.kt:588 先删后拷无回滚）、Q1（TokenUsageRepository.kt:28 恢复期互斥锁覆盖不足）、Q2（OperitPaths.kt:31 明文备份存公共 Download/Operit），high 定级不夸大。
- **禁用词**：5 文件全文 grep"通过/批准/LGTM"全 0。
- **status.json**：issue=69（整数）、status=review-pending、source_repo=operit、source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb 全对；id/title 字段齐备。
- **lint**：单页隔离独立复跑（报告输出到目录外，避开自扫 quirk）：检查文件 1，硬失败 0 / 警告 0。

### 结论：通过

修错合格，4 项修正全部落实且锚点独立验真。`.status.json` 的 `critic` 字段已填复验结论，状态保持 `review-pending`。本页可随整批上评审站。
