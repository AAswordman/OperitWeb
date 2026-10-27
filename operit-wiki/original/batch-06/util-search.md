---
title: 向量索引与本地检索
module: 工具函数库 / app
sources: 8
date: 2026-10-01
---

# 向量索引与本地检索（util-search）

## 概述

这一页讲 Operit 做"本地检索"的两套工具。第一套是**向量索引**：把记忆、文档块的 embedding 向量放进 HNSW（一种近似最近邻索引）里，查的时候按语义相似度找回最相关的记忆——这是记忆 RAG 检索的核心。第二套是 **native ripgrep**：用 Rust 写的代码/文件内容搜索，经由 JNI 暴露给 Kotlin，`grep_code` 工具底层走的就是它，经由 JNI 调用 Rust 实现。

两套工具都在 `util/` 下，特点都是"薄封装"：向量侧只是把开源 hnswlib 包了一层（建索引、增删查、落盘），检索侧只是把 Rust 实现的 grep 经由 JNI 桥接出来。真正的业务逻辑（按维度建索引、重建策略、结果分组）在调用方 `MemoryRepository` 和 `StandardFileSystemTools` 里。

## AI 速览

- **核心符号清单**：`VectorIndexManager`、`IndexItem`、`NativeRipgrep`、`searchJson`、`SearchResponse`/`SearchBlock`、`RipgrepBlock`、`searchNativeRipgrepBlocks`、`grepCodeWithNativeRipgrep`
- **主入口**：向量检索 `MemoryRepository.getSemanticMemoryCandidatesFromIndex` → `VectorIndexManager.findNearest`；代码搜索 `StandardFileSystemTools.grepCodeWithNativeRipgrep` → `NativeRipgrep.searchJson`
- **数据流向一句话**：embedding 向量 → HNSW 索引 → Top-K 候选 id → 回查数据库 → 重算余弦相似度；搜索词 → Rust 遍历文件 → JSON 结果块 → Kotlin 解析成结果块列表

## 核心机制

### 向量索引：精简 HNSW 封装

- `VectorIndexManager` 是泛型类，类型参数约束为 hnswlib 的条目与 id 类型（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:14`）
- 构造参数为 `dimensions`（向量维度）、`maxElements`（容量上限）和可选的 `indexFile`（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:14`）
- 内部 `index` 是可空的 `HnswIndex` 引用（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:19`）
- 构造时 `init` 块立即调用 `initIndex()`（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:22`）
- 索引文件存在时用 `ObjectInputStream.readObject` 反序列化加载（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:29`）
- 加载失败记日志并 `delete()` 删掉已损坏的文件（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:33`）
- 新建索引的距离函数固定为 `FLOAT_COSINE_DISTANCE`（余弦距离）（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:35`）
- 构建器调用 `withRemoveEnabled()` 启用删除能力（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:36`）
- `addItem` 先 `ensureCapacity(size() + 1)` 预留容量再写入（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:48`）
- `removeItem` 的 `version` 参数默认 `Long.MAX_VALUE`（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:54`）
- `findNearest` 只返回条目列表，HNSW 算出的距离被丢弃（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:59`）
- `size()` 在索引为空时返回 0（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:63`）
- `maxItemCount()` 在索引为空时回退到构造参数 `maxElements`（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:65`）
- `ensureCapacity` 只在容量不足时调 `resize` 扩容（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:67`）
- `save()` 先 `mkdirs()` 建父目录，再用 `ObjectOutputStream.writeObject` 把整个索引序列化写出（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:80`）
- `save()` 吞掉 `IOException` 只记日志，不向调用方抛异常（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:82`）
- `close()` 只是把索引引用置空，不做持久化（`app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt:88`）
- 依赖声明：`implementation("com.github.jelmerk:hnswlib-core:1.2.1")`（`app/build.gradle.kts:579`）

### IndexItem：索引条目包装

- `IndexItem` 实现 hnswlib 的 `Item` 接口，是条目的泛型包装（`app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt:11`）
- `version` 字段默认值为 `0L`（`app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt:14`）
- `value` 字段可指向 `Memory` 或 `DocumentChunk` 等原始对象（`app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt:15`）
- `dimensions()` 直接返回 `vector.size`（`app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt:20`）
- `equals` 只比较 `id`，忽略向量和版本的差异（`app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt:23`）
- `hashCode` 只取 `id.hashCode()`（`app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt:32`）

### 记忆侧用法（RAG 检索）

- 记忆侧按向量维度分文件建索引（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:375`）
- 记忆条目的 id 和 value 都用 `memory.id`（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:335`）
- 记忆条目的 `version` 取 `updatedAt.time`（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:337`）
- 没有 `embedding` 或向量为空的记忆返回 null，不入索引（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:333`）
- 文档块条目的 version 和 value 都取 `chunk.id`（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:343`）
- 记忆索引文件名形如 `memory_hnsw_<profile>_<维度>.idx`（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:293`）
- 文档块索引文件名形如 `doc_index_<profile>_<记忆id>_<维度>.hnsw`（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:297`）
- 重建时先 `deleteIndexFileIfExists` 删旧文件（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:372`）
- 重建时全量 `addItem` 后调 `save()` 落盘（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:381`）
- 检索用 `findNearest` 把全量候选一次取出（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:590`）
- 检索后回查 `memoryBox`、逐条重算 `cosineSimilarity`（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:598`）
- 调用方再按相似度降序排列（`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:1433`）

### native ripgrep：Kotlin 侧声明

- `NativeRipgrep` 是 `internal` 单例对象（`app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt:3`）
- `init` 块调 `System.loadLibrary` 加载 `operit_ripgrep`（`app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt:5`）
- `searchJson` 是 `@JvmStatic` 修饰的 `external` 函数（`app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt:9`）
- Kotlin 侧 `searchNativeRipgrepBlocks` 在 `Dispatchers.IO` 上执行 JNI 调用（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:272`）
- 调用时固定传 `literal=false`（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:282`）
- `parseNativeRipgrepBlocks` 在返回失败时抛 `IllegalStateException`（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:294`）
- `RipgrepBlock` 是 `protected` 的结果数据类（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:162`）
- `grepCodeWithNativeRipgrep` 在 `maxResults=0` 时直接返回空结果（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:531`）
- 代码搜索工具的执行入口最终调 `grepCodeWithNativeRipgrep`（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4658`）

### native ripgrep：Rust 实现

- JNI 入口函数用 `extern "system"` 加 `#[no_mangle]`（`tools/native_ripgrep/src/lib.rs:49`）
- `literal` 参数在 Rust 侧被忽略（命名为 `_literal`）（`tools/native_ripgrep/src/lib.rs:56`）
- 出错时返回 `success=false` 的 JSON 而不是抛异常（`tools/native_ripgrep/src/lib.rs:66`）
- JNI 字符串构造失败时返回空指针（`tools/native_ripgrep/src/lib.rs:87`）
- 空白 pattern 被过滤（`tools/native_ripgrep/src/lib.rs:121`）
- path 为空时返回 `path is required` 错误（`tools/native_ripgrep/src/lib.rs:126`）
- `max_results` 为 0 直接返回成功空结果（`tools/native_ripgrep/src/lib.rs:150`）
- `hidden(false)` 表示不跳过隐藏文件（`tools/native_ripgrep/src/lib.rs:160`）
- 遍历启用 `git_ignore` / `git_global` / `git_exclude` / `parents` 规则（`tools/native_ripgrep/src/lib.rs:161`）
- 只处理 `is_file()` 为真的普通文件（`tools/native_ripgrep/src/lib.rs:169`）
- 命中数达到 `max_results` 立即停止遍历（`tools/native_ripgrep/src/lib.rs:174`）
- 匹配器用 `RegexMatcherBuilder` 构建，支持 `case_insensitive` 开关（`tools/native_ripgrep/src/lib.rs:198`）
- 非法正则返回 `invalid regex` 错误（`tools/native_ripgrep/src/lib.rs:206`）
- `filePattern` 为空或 `*` 时不过滤文件类型（`tools/native_ripgrep/src/lib.rs:212`）
- 不含路径分隔符的 pattern 自动追加 `**/` 前缀变体（`tools/native_ripgrep/src/lib.rs:221`）
- 固定排除 `.backup`、`.operit`、`backup` 三个目录（含嵌套变体）（`tools/native_ripgrep/src/lib.rs:226`）
- `is_probably_binary` 读前 8192 字节查 NUL 判二进制（`tools/native_ripgrep/src/lib.rs:257`）
- 每行用 `from_utf8_lossy` 解码并去掉行尾回车（`tools/native_ripgrep/src/lib.rs:283`）
- 单行匹配出错时按不匹配处理（`tools/native_ripgrep/src/lib.rs:287`）
- 上下文行号用 `BTreeSet` 去重合并（`tools/native_ripgrep/src/lib.rs:296`）
- 单匹配文件的行内容截断到 300 字符（`tools/native_ripgrep/src/lib.rs:318`）
- 多匹配文件只取前 5 个匹配做摘要（`tools/native_ripgrep/src/lib.rs:323`）
- 匹配上下文总长度截断到 4000 字符（`tools/native_ripgrep/src/lib.rs:334`）
- `clip_text` 按字符数截断并追加省略号（`tools/native_ripgrep/src/lib.rs:339`）
- 兜底转义函数只处理反斜杠和双引号（`tools/native_ripgrep/src/lib.rs:348`）
- 返回字段名经 `rename_all` 转为 `camelCase`（`tools/native_ripgrep/src/lib.rs:19`）
- 结果块含 `filePath`、`firstMatchLine`、`lineContent`、`matchContext`、`matchCount` 五个字段（`tools/native_ripgrep/src/lib.rs:26`）
- crate 名为 `operit_ripgrep`（`tools/native_ripgrep/Cargo.toml:2`）
- crate 版本为 `0.1.0`（`tools/native_ripgrep/Cargo.toml:3`）
- `crate-type` 为 `cdylib` 动态库（`tools/native_ripgrep/Cargo.toml:8`）
- 依赖含 `jni`、`serde`、`ignore`、`grep-regex`（`tools/native_ripgrep/Cargo.toml:14`）
- 构建脚本把 `liboperit_ripgrep.so` 拷到 `jniLibs` 目录（`tools/native_ripgrep/build_native_ripgrep.ps1:69`）

## 关键符号

| 符号 | 说明 |
|---|---|
| `VectorIndexManager` | HNSW 索引管理器：初始化/添加/删除/查 Top-K/保存/加载 |
| `IndexItem` | 索引条目包装：id、vector、version、value（原始对象引用） |
| `HnswIndex` | hnswlib 的索引实现（外部依赖 1.2.1） |
| `NativeRipgrep` | JNI 桥接单例，加载 `liboperit_ripgrep.so` |
| `searchJson` | JNI 搜索入口，返回 JSON 字符串 |
| `SearchResponse` / `SearchBlock` | Rust 侧返回结构（camelCase 字段） |
| `RipgrepBlock` | Kotlin 侧解析后的结果块 |
| `searchNativeRipgrepBlocks` | Kotlin 侧 JNI 调用封装（IO 线程） |
| `grepCodeWithNativeRipgrep` | `grep_code` 工具的搜索执行体 |

## 输入→处理→输出调用链

### 链路 1：记忆语义检索

1. **输入**：用户查询的 embedding 向量，维度决定用哪个索引文件。
2. **处理**：按维度打开对应的 `VectorIndexManager` → `findNearest(查询向量, 全部候选数)` 取回条目 → 用条目的 value（记忆 id）回查数据库 → 逐条重算余弦相似度。
3. **输出**：记忆与相似度的配对列表，供 RAG 检索排序。

### 链路 2：索引重建

1. **输入**：记忆增删改事件，带受影响的向量维度。
2. **处理**：删除旧索引文件 → 新建管理器（容量按条目数）→ 全部重新添加 → 保存落盘 → 关闭。
3. **输出**：新的索引文件，下次检索时加载。

### 链路 3：代码搜索

1. **输入**：`grep_code` 工具参数：路径、正则、文件通配、大小写开关、上下文行数、最大结果数。
2. **处理**：IO 线程调 JNI → Rust 遍历文件、正则匹配、按文件聚块成 JSON → Kotlin 解析为结果块列表。
3. **输出**：工具结果（匹配列表、总命中数、搜索文件数）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/util/vector/VectorIndexManager.kt`（91 行）：HNSW 索引的精简封装。
- `app/src/main/java/com/ai/assistance/operit/util/vector/IndexItem.kt`（34 行）：索引条目泛型包装。
- `app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt`（18 行）：JNI 桥接声明。
- `tools/native_ripgrep/src/lib.rs`（350 行）：Rust 实现的 ripgrep 搜索与 JNI 入口。
- `tools/native_ripgrep/Cargo.toml`：crate 定义（`operit_ripgrep` 0.1.0，`cdylib`）。
- `tools/native_ripgrep/build_native_ripgrep.ps1`：把 `liboperit_ripgrep.so` 拷贝到 `app/src/main/jniLibs/<abi>/`。
- 调用方（非种子，仅作链路佐证）：`MemoryRepository.kt`（记忆向量索引的建/查）、`StandardFileSystemTools.kt`（`grep_code` 工具的搜索执行）。
