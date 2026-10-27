---
title: 文件、媒体与格式转换工具
module: util
sources: FileUtils.kt, ArchiveUtil.kt, OperitPaths.kt, PathMapper.kt, AssetCopyUtils.kt, AndroidUserPathUtils.kt, DocumentConversionUtil.kt, HttpMultiPartDownloader.kt, SkillRepoZipPoolManager.kt, ToolPkgArtifactMinifier.kt, ToolPkgJsAstMinifier.kt, ToolPkgWasmRuntime.kt, ImagePoolManager.kt, MediaPoolManager.kt, ImageBitmapLimiter.kt, MediaBase64Limiter.kt, ColorQrCodeUtil.kt, OCRUtils.kt, FFmpegUtil.kt
date: 2026-10-01
---

# 文件、媒体与格式转换工具（util.file.media）

这些工具类是应用的"文件杂务间"：一切跟文件打交道但不值得单独成章的杂活都在这里——文本/视频文件判定、压缩包解压打包、目录定义、文档格式互转、多线程下载、图片与媒体入池限流、彩色二维码、OCR、FFmpeg 转码。

## AI 速览

核心符号清单：`FileUtils`、`ArchiveUtil`、`OperitPaths`、`PathMapper`、`AssetCopyUtils`、`AndroidUserPathUtils`、`DocumentConversionUtil`、`HttpMultiPartDownloader`、`SkillRepoZipPoolManager`、`ToolPkgArtifactMinifier`、`ToolPkgJsAstMinifier`、`ToolPkgWasmRuntime`、`ImagePoolManager`、`MediaPoolManager`、`ImageBitmapLimiter`、`MediaBase64Limiter`、`ColorQrCodeUtil`、`OCRUtils`、`FFmpegUtil`。

主入口：各 `object` 单例的公开函数（如 `ImagePoolManager.addImage`、`ArchiveUtil.extractArchive`、`HttpMultiPartDownloader.download`），多数是无状态的静态风格调用。

数据流向一句话：用户文件或网络字节流进来，被判定类型、解压或转码、限流归一化后，落入各自的内存+磁盘双层缓存池或输出文件。

## 核心机制

### 文件类型判定（FileUtils）

判定文本文件有两条路：扩展名白名单（`isTextBasedExtension`）和内容嗅探（`isTextLike`）。嗅探默认读前 512 字节，按字节分类：可打印 ASCII 和合法 UTF-8 多字节序列算文本，其余算非文本；非文本字符占比低于 10% 即判为文本。空文件视为文本。视频判定先查 `ContentResolver` 的 MIME 类型是否以 `video/` 开头，再回退到 8 种视频扩展名名单。

`copyFileToInternalStorage` 把外部 URI 拷贝进应用 filesDir，文件名是 `uniqueName_UUID.扩展名`，用 4KB 缓冲区在 `Dispatchers.IO` 上逐块拷贝。`checkVideoSize` 默认只允许 30MB 以内的视频：读得出大小就比较，读不出就返回 `true` 放行（宁可误放也不误拦用户）。

### 压缩包（ArchiveUtil）

zip/tar/7z/rar 四种格式都支持解压，打包只支持 zip/tar/7z（RAR 打包因许可证限制直接拒绝）。解压时加密包的处理不统一：ZIP 走标准 `ZipInputStream`，根本不支持密码，遇到加密包就在目标目录留一个 `EXTRACTION_FAILED.txt` 说明文件并返回 false；7z 和 RAR 则支持传入密码。格式转换（`convertArchive`）是"解压+重打"：先解到 cacheDir 下的临时目录，重打后再在 finally 里删掉临时目录。

### 目录与路径（OperitPaths、PathMapper）

`OperitPaths` 把所有标准目录钉死：根目录是公共 `Download/Operit`，下面有 plugins、mcp 插件、bridge、exports、workspace、test、websession 等子目录；图片池、媒体池、技能仓库 ZIP 池各有独立池目录，且这三池目录加模型和向量索引目录会被快照排除。插件配置目录名对 pluginId 做了消毒（替换掉 `\/:*?"<>|` 和控制字符），消毒后若改名会再追加原名的哈希后缀防碰撞。

`PathMapper.mapLinuxPath` 把 Linux 路径（如 `/home/user/x`）拼到 proot 的 Ubuntu 根目录下，让工具代码能用"真 Linux 路径"读写文件。

### 文档格式互转（DocumentConversionUtil）

文本转 PDF 用 PDFBox，按 Helvetica 12、固定行距逐行排版。PDF 提取文本走两层：先用 PDFBox 直接提，提出来不足 20 个字符就当它是扫描件，转用 Android `PdfRenderer` 逐页渲染成图再 OCR。PDF 转图片只渲第一页，按 2 倍缩放导出。

表格转 HTML 用 POI 打开、公式求值，输出带工作表切换标签的 HTML 页面，并对内容做 HTML 转义。DOC→DOCX 用 POI 的 HWPF 读旧格式再 XWPF 重写；但 DOCX→DOC、HTML→DOC 这两个方向其实是"把纯文本改个 `.doc` 后缀存下来"，算不上真正的格式转换。

### 多线程下载（HttpMultiPartDownloader）

先发 HEAD 探测文件大小和是否支持断点续传；探测失败就回退用 `GET Range: bytes=0-0` 探测。线程数默认 4、钳在 1–8 之间，按字节区间均分任务；下载前用 `RandomAccessFile.setLength` 预分配目标文件大小，每个分片先落到 `文件名.part.N` 临时文件再拼进对应偏移。任一分片失败就删掉目标文件并抛异常。请求头名和头值都做了换行符消毒，防止 CRLF 注入。

### 图片与媒体池（ImagePoolManager、MediaPoolManager）

两个池都是"内存 LRU + 磁盘持久化"双层结构。图片池上限 20 张，媒体池上限 12 个、单文件 20MB。

图片入池有一条固定流水线：EXIF 方向归一 → 按比例缩放 → 长边压到 2048 以内 → 格式选择（AUTO 时有透明通道用 PNG，否则 JPEG；转 JPEG 前先在白底上压平透明）→ 编码。编码完还会用 `BitmapFactory` 探测真实 MIME，声明和实际不符就自动修正。磁盘上每张图存一对文件：`$id.dat`（base64 数据）+ `$id.meta`（宽高和 MIME 的 JSON）。

媒体入池超 20MB 就转码：音频转单声道 16kHz 的 mp3（64k 不行再试 32k），视频按 640 宽 h264 → 640 宽 mpeg4 → 480 宽 mpeg4 依次尝试；转码还压不下来就拒绝入池。base64 输入先用 `MediaBase64Limiter` 估算解码大小（`(字符数*3/4 - 填充数)`），超限就流式解码到临时文件再转码，避免一次性吃光内存。

### 发布产物压缩（ToolPkgArtifactMinifier、ToolPkgJsAstMinifier、ToolPkgWasmRuntime）

ToolPkg 发布时做三件事：① 可达性剪枝——从 manifest 声明的可执行入口出发，沿静态 require/import 做 BFS，只保留可达的模块和资源，其余条目丢掉；② JS 压缩——QuickJS 里跑 Terser（3 遍压缩、顶层不混淆、输出纯 ASCII），但源码顶部的 `/* METADATA */` 块会被原样保留；③ 市场来源注入——主入口压缩前先追加 `market: "Operit"` 的来源信息，让来源随代码一起被压缩而不是当注释剥离。剪枝后会校验 manifest 和所有可执行入口仍在可达集合里，防止产出空壳包。

WASM 运行时走 native 的 `toolpkgwasm` 库，按 cacheKey 缓存已加载模块；同 key 但字节变了（SHA-256 指纹对不上）就先关旧模块再重载；支持按 `packageName:` 前缀批量关闭。

### 彩色二维码（ColorQrCodeUtil）

自研的彩色二维码协议：14 字节头（魔数 `CQR1`、协议版本 1、颜色数、4 字节大端载荷长度、4 字节 CRC32），2/4/8/16 色分别对应每符号 1–4 比特。文本载荷在"变小了"的前提下先 gzip。解码时按 16/8/4/2 依次尝试，16 色还会试 9 种色相偏移容错；每个模块采 5 个点投票定色。定位用 zxing 的 Detector 找角点再裁剪。

### OCR（OCRUtils）

ML Kit 的封装，提供拉丁/中文/日文/韩文四个识别器并缓存。HIGH 质量档先把图放大 2 倍（上限 4096 边）再识别；默认的 `recognizeText` 同时跑拉丁和中文两路识别合并结果。结果用密封类 `OCRResult` 区分成功和失败。

### FFmpeg（FFmpegUtil）

`executeCommand` 直接把命令字符串丢给 FFmpegKit 执行、按返回码判成功；`scaleFilterMaxWidth` 生成的 scale 滤镜里逗号做了转义，因为 FFmpegKit 的参数解析不经过 shell。

## 关键符号

| 符号 | 作用 |
|---|---|
| `FileUtils.isTextLike` | 512 字节内容嗅探判定文本/二进制 |
| `FileUtils.checkVideoSize` | 视频 30MB 限额检查（读不出大小则放行） |
| `ArchiveUtil.extractArchive` | 按扩展名分发四格式解压 |
| `ArchiveUtil.createArchive` | zip/tar/7z 打包（RAR 打包拒绝） |
| `OperitPaths` | 全部标准目录定义（含三池目录与快照排除名单） |
| `PathMapper.mapLinuxPath` | Linux 路径映射到 proot Ubuntu 根目录 |
| `DocumentConversionUtil.extractTextFromPdf` | PDFBox 提文本 + 不足 20 字符走 OCR 兜底 |
| `DocumentConversionUtil.convertSpreadsheetToHtml` | POI 表格转带标签页的 HTML |
| `HttpMultiPartDownloader.download` | HEAD 探测 + Range 分段多线程下载 |
| `SkillRepoZipPoolManager.getOrDownloadZip` | 技能仓库 ZIP 的 6 槽 LRU 缓存（per-key 互斥） |
| `ImagePoolManager.addImage` | 图片入池流水线（EXIF→缩放→2048 长边→格式） |
| `MediaPoolManager.addMedia` | 媒体入池（超 20MB 自动转码，压不下拒收） |
| `ToolPkgArtifactMinifier.processArtifactFile` | 发布产物：可达剪枝+Terser 压缩+市场来源注入 |
| `ToolPkgWasmRuntime.call` | WASM 模块调用（SHA-256 指纹缓存） |
| `ColorQrCodeUtil.generate/decode` | 自研彩色二维码编解码 |
| `OCRUtils.recognizeText` | ML Kit 四语言 OCR（默认拉丁+中文双识别） |
| `FFmpegUtil.executeCommand` | FFmpeg 命令执行 |

## 调用链

**1. 图片入池**：`ImagePoolManager.addImage(filePath)` → `registerBitmap`（EXIF 方向归一 `normalizeBitmapOrientationIfNeeded` → `scaleBitmapIfNeeded` → `limitBitmapLongEdgeIfNeeded`（2048）→ `resolveOutputFormat` → `flattenAlphaForJpeg`（如需）→ `encodeBitmap`）→ `saveToDisk`（`$id.dat`/`$id.meta`）→ 返回图片 ID。

**2. 超大媒体入池**：`MediaPoolManager.addMediaFromBase64` → `MediaBase64Limiter.estimateDecodedSizeBytes` 估算 → 超限则 `decodeBase64ToFile` 流式落盘 → `transcodeToFit`（FFmpegUtil 转码，音频 16kHz 单声道 mp3 / 视频多档 mp4）→ 仍超限返回 `"error"` → 否则 `saveToDisk`（`$id.meta`/`$id.b64`）。

**3. 多线程下载**：`HttpMultiPartDownloader.download` → `probeDownload`（HEAD 探测，失败回退 Range 探测）→ `buildSegmentPlan`（均分区间）→ `downloadMulti`（预分配 `RandomAccessFile` → 各分片 `downloadSegment` 落 `.part.N` → seek 拼入）→ 失败删目标文件抛异常。

**4. 压缩包格式转换**：`ArchiveUtil.convertArchive` → 解到 `temp_extract_时间戳` 临时目录（`extractArchive` 分发）→ `createArchive` 重打目标格式 → finally 递归删除临时目录。

**5. ToolPkg 发布压缩**：`ToolPkgArtifactMinifier.processArtifactFile` → `processToolPkgArchive` → `collectReachableToolPkgEntries`（BFS 可达剪枝）→ 校验 manifest 与入口可达 → `injectToolPkgMarketOrigin` → `minifyJavaScriptSourcePreservingMetadata`（Terser，保留 METADATA 块）。

**6. 彩色二维码解码**：`ColorQrCodeUtil.decode` → `cropToQrRegion`（zxing Detector 定位）→ 按 16/8/4/2 试颜色数（16 色带 9 种色相偏移）→ 校验魔数/版本/CRC32 → `decodeToString`（gzip 则解压）。

## 来源

源码 commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，共 19 个文件，全部位于 `app/src/main/java/com/ai/assistance/operit/util/` 下：FileUtils.kt、ArchiveUtil.kt、OperitPaths.kt、PathMapper.kt、AssetCopyUtils.kt、AndroidUserPathUtils.kt、DocumentConversionUtil.kt、HttpMultiPartDownloader.kt、SkillRepoZipPoolManager.kt、ToolPkgArtifactMinifier.kt、ToolPkgJsAstMinifier.kt、ToolPkgWasmRuntime.kt、ImagePoolManager.kt、MediaPoolManager.kt、ImageBitmapLimiter.kt、MediaBase64Limiter.kt、ColorQrCodeUtil.kt、OCRUtils.kt、FFmpegUtil.kt。
