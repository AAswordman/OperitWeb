---
title: 安装包编辑与逆向（APK/EXE）
module: 引擎其他
sources: ApkEditor.kt, ApkReverseEngineer.kt, KeyStoreHelper.kt, ExeEditor.kt, ExeIconChanger.kt
date: 2026-10-01
---

# 安装包编辑与逆向（APK/EXE）

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 怎么把 AI 生成的网页变成可以安装的 App。

聊天页和 HTML 打包器里都有一个"导出"按钮。选 Android，得到一个改了包名、应用名、图标、塞进新网页的 APK；选 Windows，得到一个塞了新网页的 ZIP 包（里面是 Windows 桌面壳）。

实现分两条线：

1. **APK 线**（`ApkEditor` + `ApkReverseEngineer`）：完整实现。流式重写 APK 的 zip 条目——丢掉旧签名、换掉 `assets/flutter_assets/assets/web_content/` 下的网页、改二进制 `AndroidManifest.xml` 里的包名/版本/应用名、按屏幕密度替换图标，最后 zipalign 对齐并用 apksig 重新签名。
2. **EXE 线**（`ExeEditor` + `ExeIconChanger`）：未完成。`changeIcon` 只是把 EXE 复制一份，真正的 PE 资源替换函数 `simulateResourceReplacement` 直接返回 true，其注释写明"在 Android 上无法实际修改 EXE 文件资源"。

签名用的密钥库由 `KeyStoreHelper` 管理：优先用 filesDir 下的 pkcs12/jks，兜底用 assets 里内置的两份，密码都是 `android`。

一个重要前提：导出模板 `subpack/android.apk` 和 `subpack/windows.zip` 在仓库的 `app/src/main/assets/subpack/` 下并不存在（只有 `.keep` 占位），需要构建时从外部提供；否则导出流程会在复制模板时抛异常而整体失败。

## AI 速览

- 核心符号：`ApkEditor`（链式编辑器）、`ApkReverseEngineer`（逆向/重打包/签名）、`KeyStoreHelper`（密钥库）、`ExeEditor`（EXE 编辑器）、`ExeIconChanger`（EXE 图标）、`exportAndroidApp` / `exportWindowsApp`（UI 导出入口）
- 主入口：`exportAndroidApp(context, packageName, appName, versionName, versionCode, iconUri, webContentDir, onProgress, onComplete)`；Windows 对应 `exportWindowsApp`
- 数据流向一句话：模板 APK（assets）→ 流式重写 zip 条目（换网页/清单/图标、丢旧签名）→ zipalign 对齐 → apksig 重签名 → 输出到 Download/Operit/exports；Windows 则是解压模板 zip → 换网页 → 重打包 zip。

## 核心机制

### 1. ApkEditor：链式调用的外壳

`ApkEditor` 构造函数私有，只能经 `fromAsset` / `fromFile` / `fromPath` 三个工厂方法创建。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkEditor.kt:13`

`changePackageName` / `changeAppName` / `changeVersionName` / `changeVersionCode` 只是把新值存进成员变量，`withSignature` 存四项签名信息，`setOutput` 定输出位置——全部返回 `this`，真正的活都在 `repackWithWebContent` 和 `repackAndSignWithWebContent` 里干。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkEditor.kt:87`

`repackWithWebContent(webContentDir)` 要求网页目录存在且为目录，否则抛 `IllegalArgumentException`；没指定输出文件就写到 cacheDir 的 `unsigned_` 加原文件名。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkEditor.kt:200`

`repackAndSignWithWebContent` 先调前者拿到未签名包，校验包存在且非空、四项签名信息齐全，然后签名；指定了输出文件时先签到 `to_sign_` 加时间戳的临时文件，再复制到目标位置并删除临时文件。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkEditor.kt:237`

### 2. ApkReverseEngineer：流式重打包

核心是 `repackageApkWithWebContent`：用 `ZipArchiveOutputStream` 逐条目重写原 APK，全程不落地解压。

先跳过 `META-INF/` 条目，丢掉旧签名（重签名必须的）。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:118`

再跳过 `assets/flutter_assets/assets/web_content/`，丢掉模板自带的旧网页。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:123`

如果给了新图标，对命中 `shouldReplaceIconEntry` 的条目用 `buildIconBytes` 重写：按条目路径的密度目录缩放到对应尺寸（xxxhdpi 192、xxhdpi 144、xhdpi 96、hdpi 72、mdpi 48），按扩展名选压缩格式（webp 用 WEBP、jpg/jpeg 用 JPEG、其余用 PNG）。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:127`

`AndroidManifest.xml` 条目走 `modifyManifestBytes` 修改二进制清单后写回。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:133`

收尾时 `addWebContentToZip` 把新网页目录下所有文件（按路径排序）写入 `assets/flutter_assets/assets/web_content/` 前缀。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:151`

先写出 `_unaligned.apk` 临时文件，再调 `zipalign(..., 4)` 做 4 字节对齐并删除临时文件；底层是 zipalign-java 库的 `ZipAlign.alignZip`，其中 `.so` 文件按 16KB 边界对齐。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:156`

`writeBytesEntry` 对 `AndroidManifest.xml`、`resources.arsc`、`.dex` 和 META-INF 签名文件用 STORED 方式（显式设置 size 与 CRC32），其余用 DEFLATED；`copyZipEntry` 原样保留原条目的压缩方式，size/crc 缺失时流式重算。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:301`

### 3. 二进制清单修改：AXML 读写

`modifyManifestBytes` 用 Sable axml 库：`AxmlReader` 解析二进制 AndroidManifest，改完属性后 `AxmlWriter` 写回字节数组。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:392`

改包名时若 manifest 缺少 `package` 属性会新建一个；拿到旧包名后递归替换所有属性中含旧包名的字符串，但值为 `$oldPackageName.MainActivity` 或以它结尾的属性会被保留。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:401`

`versionCode` 按整数写入（解析失败填 1），类型标记为 `TYPE_INT_HEX`；`versionName` / `versionCode` 找不到就新建，android 命名空间缺省为 `http://schemas.android.com/apk/res/android`；应用名只改 `application` 节点的 `label` 属性。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:451`

注意：修改过程发生异常时它返回原始 manifest 字节，打包流程继续——此时清单修改实际未生效，但上层收到的仍是成功。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:499`

### 4. 签名：apksig + 双格式密钥库

`signApk` 先校验未签名包与密钥库文件存在，然后先尝试以 PKCS12 格式加载签名，失败再试 JKS；两种都失败返回合并后的错误信息。返回值是 `Pair<Boolean, String?>`，成功时第二个值为 null。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:537`

别名处理：密钥库里没有任何别名直接失败；指定的别名不存在但有其他别名时，用第一个可用别名签名并打 warning 日志。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:629`

真正签名在 `signWithKeyStore`：要求别名对应私钥、证书链非空且链上证书全部为 `X509Certificate`，然后用 `com.android.apksig.ApkSigner` 签名，`setMinSdkVersion(26)`。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:660`

### 5. KeyStoreHelper：密钥库从哪来

`getOrCreateKeystore` 按顺序尝试：filesDir 下的 `pkcs12.keystore` → `jks.jks` → assets 内置的两份（`loadKeystoreFromAsset` 复制到 filesDir），密码都是 `android`；`validateKeystore` 校验（能 load 且至少含一个别名）才采用。
`app/src/main/java/com/ai/assistance/operit/core/subpack/KeyStoreHelper.kt:165`

取 PKCS12 实例前，`registerBouncyCastleProvider` 先移除旧的 `BC` 提供者，再把新的 `BouncyCastleProvider` 插入到安全提供者第 1 位，保证优先级。
`app/src/main/java/com/ai/assistance/operit/core/subpack/KeyStoreHelper.kt:28`

### 6. EXE 线：复制 + 模拟

`ExeEditor` 是与 `ApkEditor` 同构的链式外壳（`fromAsset` / `fromFile` / `fromPath`、`changeIcon` 三重载、`setOutput`），但 `process()` 只做一件事：调用 `ExeIconChanger.changeIcon`；没设置图标就抛 `IllegalStateException`。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ExeEditor.kt:127`

`ExeIconChanger.changeIcon` 先把输入 EXE 复制到输出位置，再生成临时 ICO 文件（手写 ICO 格式：6 字节文件头 + 16 字节目录项 + PNG 图像数据，宽高上限 256），最后调 `simulateResourceReplacement`——该函数注释写明在 Android 上无法实际修改 EXE 文件资源，直接返回 true。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ExeIconChanger.kt:119`

`isPEFile` 负责校验 MZ 头、PE 偏移与 PE 签名，但当前没有任何调用方。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ExeIconChanger.kt:140`

### 7. 导出入口：ExportDialogs

`exportAndroidApp` 是 suspend 函数，在 `Dispatchers.IO` 上执行：`ApkEditor.fromAsset(context, "subpack/android.apk")` 初始化 → 链式设置包名/应用名/版本 → 有图标 URI 就 `changeIcon` → `KeyStoreHelper.getOrCreateKeystore` 取密钥库 → `withSignature`（库密码 `android`、别名 `androidkey`、密钥密码 `android`）→ 输出到 `Download/Operit/exports/WebApp_<时间戳>.apk` → `repackAndSignWithWebContent(webContentDir)`。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt:782`

`exportWindowsApp`：复制 `subpack/windows.zip` 到 `cacheDir/windows_export_temp` 并解压 → 有图标时对解压出的 `assistance_subpack.exe` 跑 `ExeEditor`（注意此时输入与输出是同一文件）→ 网页内容复制到 `data/flutter_assets/assets/web_content` → 整个目录重打包为 `<应用名>_<时间戳>.zip` 输出到 `Download/Operit/exports` → finally 删除临时工作目录。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt:893`

导出对话框的默认值：包名 `com.example.webproject`、应用名 `Web Project`、版本名 `1.0.0`、版本号 `1`。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt:171`

## 关键符号

| 符号 | 角色 |
|---|---|
| `ApkEditor` | APK 链式编辑器：攒参数，调重打包与签名 |
| `ApkReverseEngineer` | APK 逆向：流式重打包、zipalign、apksig 签名 |
| `KeyStoreHelper` | 密钥库加载/验证/BouncyCastle 提供者管理 |
| `ExeEditor` | EXE 链式编辑器：目前只做图标更换 |
| `ExeIconChanger` | EXE 图标：复制文件 + 生成 ICO + 模拟替换 |
| `exportAndroidApp` | Android 导出入口（ExportDialogs） |
| `exportWindowsApp` | Windows 导出入口（ExportDialogs） |
| `repackWithWebContent` | 只换网页 + 清单的重打包（未签名） |
| `repackAndSignWithWebContent` | 重打包 + 签名一条龙 |
| `repackageApkWithWebContent` | 逐条目流式重写 zip 的具体实现 |
| `signApk` | 双格式密钥库加载 + apksig 签名 |
| `modifyManifestBytes` | 二进制 AndroidManifest 修改（AXML） |
| `zipalign` | zipalign-java 对齐 |
| `simulateResourceReplacement` | EXE 资源替换的模拟实现（恒返回 true） |

## 调用链

1. **输入**：用户在导出对话框填写包名、应用名、版本、图标（Android 对话框默认值见上），`webContentDir` 为 AI 生成的网页内容目录；`exportAndroidApp` 在 `Dispatchers.IO` 协程中启动，经 `onProgress` / `onComplete` 回调进度与结果。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt:759`
2. **处理**：`ApkEditor.fromAsset` 拷模板 → 链式设参 → `repackAndSignWithWebContent`：`ApkReverseEngineer.repackageApkWithWebContent` 流式重写（丢 META-INF 旧签名、换 web_content 网页、改 AXML 清单、按密度换图标、写入新网页）→ `_unaligned.apk` → `zipalign` 4 字节对齐 → `signApk`（PKCS12 优先、JKS 兜底，apksig，minSdk 26）。
`app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt:92`
3. **输出**：签名后的 APK 落到 `Download/Operit/exports/WebApp_<时间戳>.apk`，经 `onComplete(true, 路径)` 回调；`cleanup()` 回收图标位图。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt:822`

Windows 链：`exportWindowsApp` 输入模板 zip 与网页目录 → 处理：解压到 `windows_export_temp`、网页复制到 `data/flutter_assets/assets/web_content`、（有图标时）`ExeEditor` 换图标 → 输出：重打包的 `<应用名>_<时间戳>.zip`。
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt:893`

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/subpack/ApkEditor.kt`（299 行）：APK 链式编辑器
- `app/src/main/java/com/ai/assistance/operit/core/subpack/ApkReverseEngineer.kt`（721 行）：APK 逆向、重打包、zipalign、签名
- `app/src/main/java/com/ai/assistance/operit/core/subpack/KeyStoreHelper.kt`（197 行）：密钥库管理
- `app/src/main/java/com/ai/assistance/operit/core/subpack/ExeEditor.kt`（152 行）：EXE 链式编辑器
- `app/src/main/java/com/ai/assistance/operit/core/subpack/ExeIconChanger.kt`（171 行）：EXE 图标更换
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ExportDialogs.kt`（1083 行）：导出对话框与导出入口

事实清单：facts.json（100 条）
代码走查：quality.json（15 条：高危 3 / 警告 7 / 建议 5）
