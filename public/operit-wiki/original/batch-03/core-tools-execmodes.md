---
title: 工具执行模式（Debugger/Root/无障碍/Admin）
module: 工具系统
sources: 18
date: 2026-10-01
---

# 工具执行模式（Debugger/Root/无障碍/Admin）

## 概述

- 分发中枢是 `ToolGetter`（object 单例）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:13`
- 四个 getter 按 `androidPermissionPreferences.getPreferredPermissionLevel()` 用 `when` 选择实现类。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:21`
- 同一套工具（文件系统 / UI / 系统操作 / 设备信息）在 5 种权限级别下有不同实现：`STANDARD`、`ACCESSIBILITY`、`DEBUGGER`、`ADMIN`、`ROOT`。
- 权限级别为空（未设置）时默认回退 `STANDARD`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:27`
- 实现组织为继承链：`Standard → Accessibility → Debugger → Admin → Root`，每层 `open class` 继承上一层同类工具，按需重写。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:52`
- 当前阶段只有三层有真实增量：`AccessibilityUITools`（无障碍 API）、`Debugger*`（shell 命令）、`RootUITools`（shell 身份 + 去无障碍回退）；其余类零新增、纯继承。
- 路径合法性由 PathValidator 统一前置校验：Android 路径必须以 `/` 开头，Linux 路径允许 `/` 或 `~` 开头。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:17`

## AI 速览

- **核心符号**：`ToolGetter`（分发）、`PathValidator`（路径校验）、`DebuggerFileSystemTools` / `DebuggerUITools` / `DebuggerSystemOperationTools`（shell 实现层）、`RootUITools`（SHELL 身份 UI 层）、`AccessibilityUITools`（无障碍实现层）。
- **主入口**：`ToolGetter.getFileSystemTools/getUITools/getSystemOperationTools/getDeviceInfoToolExecutor(context)`。
- **数据流向一句话**：权限偏好 → `ToolGetter` 选实现类 → 各工具先做 `PathValidator` 校验 → 按“linux/SAF/内部路径”三级降级决定走 `super` 还是 shell → 返回 `ToolResult`。
- **一句话行为差异**：Standard 用 App 自身 API；Accessibility 叠加无障碍服务；Debugger 对外部路径改走 shell 命令；Admin 目前等于 Debugger；Root 的文件/系统操作等于 Debugger，只有 UI 改为 SHELL 身份且不再回退无障碍。

## 核心机制

### 模式选择：ToolGetter 的四个分发点

- `getFileSystemTools`：ROOT→`RootFileSystemTools`，ADMIN→`AdminFileSystemTools`，DEBUGGER→`DebuggerFileSystemTools`，ACCESSIBILITY→`AccessibilityFileSystemTools`，STANDARD/null→`StandardFileSystemTools`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:22`
- `getUITools` / `getSystemOperationTools` / `getDeviceInfoToolExecutor` 是同样的五路分发（第 47、63、79 行起）。
- 四个方法的返回类型都声明为 `Standard*` 基类，调用方只依赖基类接口，多态生效。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:20`
- 不参与分级的工具：Shell、HTTP、WebVisit、浏览器会话、Intent、广播、终端、音乐、记忆查询、FFmpeg、计算器、工作流、聊天管理、软件设置等十余个 getter 只返回标准实现。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:36`

### 继承链：谁是空壳、谁有真东西

| 层级 | 文件系统 | 设备信息 | 系统操作 | UI |
|---|---|---|---|---|
| Accessibility | 空壳（继承标准） | 空壳 | 空壳 | **真实实现**：无障碍服务 API |
| Debugger | **真实实现**：shell 命令 | 空壳 | **真实实现**：shell 命令 | **真实实现**：shell 优先、无障碍回退 |
| Admin | 空壳（=Debugger） | 空壳 | 空壳 | 空壳（=Debugger） |
| Root | 空壳（=Debugger） | 空壳 | 空壳（=Debugger） | **重写**：SHELL 身份、无无障碍回退 |

- “空壳”指类体只有一句“当前阶段不添加新功能，仅继承”注释，如 `AdminFileSystemTools`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/admin/AdminFileSystemTools.kt:7`
- `DebuggerDeviceInfoToolExecutor` 同样零新增。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerDeviceInfoToolExecutor.kt:7`

### 降级策略：三级回退到 super

- `DebuggerFileSystemTools` 每个操作先看三级条件，命中任一就调 `super`（即无障碍层/标准层的高权限 App API），否则走 shell：
  1. `environment` 参数为 `"linux"` → `super`（第 91-92 行）；
  2. SAF 环境（`isSafEnvironment(environment)`）→ `super`（第 94-95 行）；
  3. Operit 内部路径 → `super`，注释写明“内部存储用高权限方法”（第 101-103 行）。
  `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:91`
- `isOperitInternalPath`：规范化后以 `/data/data/<包名>` 开头，或 `AndroidUserPathUtils.isCurrentUserPackageDataPath` 判定为当前用户包数据路径。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:55`
- 同样的三级回退出现在 `readFile/readFileFull/readFilePart/writeFile/deleteFile/fileExists/moveFile/copyFile` 等几乎所有文件操作中。

### PathValidator：路径校验规则

- `validateAndroidPath(path, toolName, paramName="path")`：空白路径直接失败；不以 `/` 开头返回带 `FileOperationData` 的失败 `ToolResult`；返回 null 表示通过。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:8`
- Linux 路径校验同样先查空白，允许以 `/` 或 `~` 开头（`env="linux"`），否则失败。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:42`
- 调用方用 `PathValidator.validateAndroidPath(path, tool.name)?.let { return it }` 短路，null 即放行。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:30`

### Debugger 文件系统：shell 实现细节

- 非内部路径的目录列举走 shell：`ls -la '$normalizedPath'`，再做三级输出解析（Android 详细格式 / 通用格式 / fallback），权限位 d/c 开头视为目录。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:121`
- 读文件用 cat/head 等 shell 命令；不可直接读的特殊文件先调 `super.handleSpecialFileRead` 尝试（内部路径或可读文件直接走父类）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:787`
- shell 中转方案：`cat` 拷贝到 `cacheDir/shell_copy_<时间戳>.<扩展名>` 临时文件，再调父类解析，结果路径改回原路径，临时文件在 `finally` 删除。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:836`
- 写文件：内容转 base64，`≤32768` 字符单行 `echo | base64 -d` 写入；超长按 `16384`（4 的倍数，保证解码边界）分块追加；base64 失败且内容小时回退 `printf '%s'`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:903`
- 删除按 `rm -rf` / `rmdir` / `rm -f` 三选一执行（路径已做单引号转义），删后校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:1144`
- 搜索命令拼为 `find '<path>/' $depthOption $searchOption $patternForCommand`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:1765`
- 用 `startShellProcess` 流式执行搜索并实时上报进度。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:1772`
- 解压优先设备端：依次试 `unzip`、`toybox unzip`、`busybox unzip`（-o 覆盖）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:2331`
- 设备端解压全失败时回退 Java `ZipInputStream` 逐条解压。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:2485`
- ZipInputStream 回退有 zip-slip 防护：校验解压后 `canonicalPath` 仍在目标目录内。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:2499`
- 用 `am start -a android.intent.action.VIEW -d 'file://$path' -t '$mimeType'` 调起系统查看器打开文件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:2658`
- 分享先 `cat` 暂存到外部文件目录 `share_tmp/<时间戳>_<原名>`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:2761`
- 再经 `FileProvider` 生成 content URI 发 `ACTION_SEND` 分享。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:2792`

### Debugger 系统操作：shell 实现细节

- `settings put/get` 的 namespace 只允许 `system`/`secure`/`global`，其余直接拒绝。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:34`
- 修改系统设置实际执行 `settings put $namespace $setting $value`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:45`
- 读取系统设置执行 `settings get $namespace $setting`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:101`
- apk 在 Operit 内部路径时委托 `super.installApp`（`isOperitInternalPath(apkPath)` 判定）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:149`
- shell 安装执行 `pm install -r $apkPath`，以输出含 `Success` 判定成功。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:174`
- 卸载按 keepData 参数执行 `pm uninstall -k $packageName` 或 `pm uninstall $packageName`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:235`
- 用 `am start` 而不用 `monkey` 启动应用，避免修改屏幕旋转等系统设置（注释写明）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:293`
- 无 activity 参数时先 `cmd package resolve-activity --brief` 解析主 Activity 再启动。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:295`
- 停止应用执行 `am force-stop $packageName`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:376`
- 读通知用 `dumpsys notification --noredact | grep -E 'pkg=|text='` 抓原文提取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt:420`

### UI 三层差异：无障碍 → Debugger → Root

- 无障碍层所有操作经 `withAccessibilityCheck` 前置检查：服务未启用抛 `IllegalStateException` 提示去系统设置开启。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt:45`
- 无障碍获取 UI 层次结构带重试：最多 3 次、间隔 300ms。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt:31`
- `simplifyLayout` 用 XmlPullParser 把无障碍 XML 解析为 `SimplifiedUINode` 树（取 class/text/content-desc/resource-id/bounds/clickable）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt:166`
- Debugger 层的 `uiShellIdentity` 为 null（默认 shell 身份）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:37`
- `getDisplayArg`：有 display 参数时返回 `-d $display ` 拼在 input 命令后，无参数返回空串。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:50`
- UI 操作经 `executeUiShellCommand` 统一走 shell（透传 uiShellIdentity）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:40`
- `tap/longPress/swipe/clickElement/setInputText/getPageInfo` 统一策略：无 display 参数且无障碍服务启用 → 走 `super`（无障碍），否则走 shell。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:57`
- shell 点击为 `input tap x y`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:79`
- 长按用 `input swipe x y x y 800`（800ms 滑动模拟）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:149`
- 滑动为 `input swipe startX startY endX endY duration`，duration 默认 300ms。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:219`
- shell 输入文本：先 `input keyevent KEYCODE_CLEAR` 清空，再写剪贴板后 `input keyevent KEYCODE_PASTE` 粘贴。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:368`
- `pressKey` 在 Debugger 层直接走 shell，支持任意键码（无障碍层仅支持 6 个系统全局手势）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:446`
- 实际执行 `input keyevent $keyCode`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:460`
- 截图优先 shell `screencap -p <路径>`，失败才回退到 super（无障碍截图）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:505`
- 页面信息 format 只接受 `xml`/`json`，其他值直接报错。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:555`
- 页面信息用 `uiautomator dump`（可带 `--display-id`）导出布局到 `/sdcard/window_dump.xml` 再回读。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:619`
- Debugger 的元素定位用 `XmlPullParser` 逐节点匹配 resource-id/class/content-desc。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:1142`
- 支持短 id（`:id/` 后缀）与 partialMatch 模糊匹配。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:1162`
- `RootUITools` 类文档声明其“无无障碍回退”（operates without accessibility fallbacks）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt:25`
- `RootUITools` 以 `SHELL` 身份执行 UI 命令（`uiShellIdentity = ShellIdentity.SHELL`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt:33`
- Root 重写的 tap/longPress/swipe/clickElement/setInputText/pressKey/getPageInfo 全部直走 shell，不再检查无障碍服务。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt:41`
- Root 的元素定位用正则 `<node[^>]*?属性[^>]*?>` 在 XML 文本上匹配节点。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt:587`
- Root 的 uiautomator dump 文件在 `finally` 中 `rm /sdcard/window_dump.xml` 清理。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt:611`
- 注意：RootUITools 未重写截图方法，截图仍继承 Debugger 实现（shell 失败会回退无障碍），与其“无回退”声明不一致。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:521`

## 关键符号

- `ToolGetter`：object 单例，四路分发入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:13`
- `getFileSystemTools`：文件系统五路分发（另有 getUITools/getSystemOperationTools/getDeviceInfoToolExecutor 同理）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:20`
- `validateAndroidPath`：Android 路径校验（另有 validateLinuxPath）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:8`
- 校验返回 null 即表示通过。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:30`
- `isOperitInternalPath`：内部路径判定，决定是否回退 super。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:55`
- `shQuote`：单引号 shell 转义。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:71`
- `uiShellIdentity`：Debugger 层为 null 默认身份。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:37`
- Root 层重写为 `ShellIdentity.SHELL`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt:33`
- `executeUiShellCommand`：UI 层 shell 统一出口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:40`
- `withAccessibilityCheck`：无障碍前置检查。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt:45`
- `simplifyLayout`：XML 转 SimplifiedUINode 树。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt:166`

## 调用链

1. **选择**：业务代码调 `ToolGetter.getFileSystemTools(context)`（或 UI/系统操作/设备信息三路）→ 读权限偏好 → `when` 选出实现类，级别为空时默认为标准版。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt:21`
2. **校验**：各工具方法先调 `PathValidator.validateAndroidPath`，失败直接返回 `ToolResult`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:8`
3. **降级**：Debugger 层检查 `environment=="linux"` / SAF / 内部路径，命中则调 `super`（App 自身高权限 API），否则拼 shell 命令执行。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt:91`
4. **UI 分支**：Debugger 层 tap 等操作先看“无 display 参数且无障碍服务启用”→ 走 super 无障碍实现，否则 shell 命令；Root 层跳过该检查直走 shell。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt:57`
5. **返回**：统一封装为 ToolResult(toolName, success, result, error)。

## 关联条目

- [[core-tools-registry|工具注册与执行框架]]：工具如何被注册与执行，本页是其“权限维度”的展开。
- [[core-tools-standard-system|标准工具集]]：Standard 层各工具的基线行为。
- [[core-tools|工具系统总览]]：v2 总览页。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerDeviceInfoToolExecutor.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerSystemOperationTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/DebuggerUITools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootDeviceInfoToolExecutor.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootSystemOperationTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/RootUITools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/admin/AdminDeviceInfoToolExecutor.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/admin/AdminFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/admin/AdminSystemOperationTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/admin/AdminUITools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityDeviceInfoToolExecutor.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilitySystemOperationTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt`
