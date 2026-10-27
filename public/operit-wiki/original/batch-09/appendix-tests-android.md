---
title: 插桩测试、模板与本地化
module: 附录
sources: 152
date: 2026-10-01
issue: 124
---

# appendix-tests-android（插桩测试、模板与本地化）

> 种子：`app/src/androidTest/`（67 文件）+ `app/src/main/assets/templates/`（193 文件）+ `app/src/main/res/values*`（11 个语言目录）+ `tools/`（114 文件）+ `examples/`（540 文件）@ `dbf71916`

> 覆盖插桩测试双轨道（kt 199 个 @Test + js 217 个 test()）、9 种项目模板的消费机制、7716 条 strings 的 9 语言本地化架构、tools/ 12 个开发者工具、examples/ 60+ 示例工具包（含 apktool 逆向工程子项目与 shower 投屏服务端）。

## 概述

这是全仓库覆盖的附录页：不讲业务功能，讲"怎么保证质量、怎么给 AI 开新项目、怎么说 9 国语言、开发者手里有哪些工具、官方示例长什么样"。

测试分两条独立轨道。kt 插桩测试跑在真机上，37 个测试类、199 个 @Test，覆盖序列化器、流式处理、崩溃恢复、路径映射、Markdown 渲染、工作流执行等基础组件。js 测试资产是另一套：29 个脚本、217 个 test()，测的是 JsBridge 双向契约（Java↔JS 值归一化、suspend await、script-mode 完成语义）、browser 工具全量操作、TTS 清洗与分句。关键事实：没有任何 kt 测试会自动加载这些 js——js 全部靠 tools/adb 脚本手动推送到真机执行，两套轨道互不咬合。

项目模板是 AI 写代码的起点：聊天工作区选项目类型（android/flutter/node/typescript/python/java/go/office），App 从 APK assets 把对应脚手架复制到工作区。android 模板甚至自带 ARM64 的 aapt2 和一键配环境脚本，手机上就能编译 APK。

本地化是 7716 条中文 strings 打底，9 个语言目录并存，日语有特殊回退链（缺翻译回退英语，永不显示中文），语言切换是整应用重启。

tools/ 是 12 个开发者工具：adb 端 JS 调试、compose_dsl 代码生成、OTA 热补丁、MCP 桥接、Rust 版 ripgrep、setuid 提权 helper、shower 投屏服务端。examples/ 是 60+ 官方示例工具包，从 12306 查票到 APK 逆向（apktool，4 个 dex-jar 共 27MB）全都有。

## AI 速览

- **核心符号清单**：ExampleInstrumentedTest、FileBindingServiceTest、WorkflowExecutorAndroidTest、EnhancedTableBlockAndroidTest、MarkdownPlainTextRendererAndroidTest、CrashRecoveryStateAndroidTest、LocaleUtilsConfigurationAndroidTest、PathMapperAndroidTest、SerializerAndroidTest、HotStreamAndroidTest、StreamAndroidTest、StreamKmpGraphTest、StreamSplitByTest、StreamJsonPluginTest、StreamMarkdownPluginTest、StreamXmlPluginTest、StreamTestExtensions、harness.js（assert/assertEq/test/runTests）、browser_tool_smoke.js、bridge_contract.js、bridge_edges.js、ttscleaner.js、waifusplitter/main.js、JsExecutionScriptBuilder、WorkspaceUtils、createAndGetDefaultWorkspace、copyTemplateFiles、createProjectConfigIfNeeded、LocaleUtils、createCompatLocaleList、LanguageSettingsScreen、QuickPluginCreatorSetupSupport、OPATCH1、mcp_bridge、NativeRipgrep、shower/Main、IShowerService、DisplayCapture、InputController、ApkReverseHelperFacade、IsolatedJadxMain。
- **主入口**：kt 测试由 AndroidJUnit4 runner 在真机执行；js 测试由 tools/adb/execute_js_dir 推送到真机调导出函数执行；模板由 WorkspaceUtils.createAndGetDefaultWorkspace 复制；语言由 LocaleUtils.setAppLanguage 切换。
- **数据流向一句话**：开发者写测试 → kt 经插桩跑在真机 / js 经 adb 推送到真机 JS runtime 执行 → 结果回传；用户选项目类型 → assets 模板复制到工作区 → setup 脚本配环境；用户切语言 → LocaleUtils 写偏好 → 整应用重启加载对应 values-* 资源。

## 核心机制

### 1. kt 插桩测试：37 类、199 个 @Test

全部测试类用 `@RunWith(AndroidJUnit4)`，其中 HotStreamAndroidTest、StreamAndroidTest、StreamKmpGraphTest、StreamSplitByTest 另加 `@MediumTest`（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/HotStreamAndroidTest.kt:30`）。

ExampleInstrumentedTest 是模板测试：只有 1 个方法 useAppContext，断言 targetContext 的包名等于 com.ai.assistance.operit（`app/src/androidTest/java/com/ai/assistance/operit/ExampleInstrumentedTest.kt:14`）。

FileBindingServiceTest 有 6 个方法，被测主类是 api.chat.enhance.FileBindingService；setUp 用反射打开私有方法 applyLineBasedPatch，断言 [START-DELETE/REPLACE/INSERT] 行补丁自底向上应用后全文精确相等（`app/src/androidTest/java/com/ai/assistance/operit/api/chat/enhance/FileBindingServiceTest.kt:14`）。

ToolExecutionManagerTest 只有 1 个方法，断言同一 chunk 内 3 个 tool 块全被提取且 url 参数顺序为 baidu/bing/github（`app/src/androidTest/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManagerTest.kt:11`）。

MediaLinkBuilder 四个测试类共 21 个方法：AndroidTest 精确断言 `<link type="image" id="img1">图片</link>` 等三种媒体标签；Format 断言本地化标签；Id 断言连字符 id 原样嵌入；Structure 断言输出以 `<link` 开头（`app/src/androidTest/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkBuilderAndroidTest.kt:11`）。

WorkflowExecutorAndroidTest 有 2 个方法：空 actionType 的 ExecuteNode 失败不阻断并行 ConditionNode；on_error/on_success 连接条件下失败节点走 error 分支而 success 分支为 Skipped（`app/src/androidTest/java/com/ai/assistance/operit/core/workflow/WorkflowExecutorAndroidTest.kt:19`）。

EnhancedTableBlockAndroidTest 是唯一的 Compose UI 测试，用 createComposeRule()；240dp 宽容器内渲染超宽表格，两次 swipe 后截图 Bitmap.sameAs 断言位移生效，流式追加更新后截图不变、再 swipe 仍可交互（`app/src/androidTest/java/com/ai/assistance/operit/ui/common/markdown/EnhancedTableBlockAndroidTest.kt:31`）。

MarkdownPlainTextRendererAndroidTest 有 7 个方法，被测函数是 ui.common.markdown.markdownToPlainTextForCopy：加粗/斜体/删除线/链接转纯文本、代码块包分隔符、表格转 tab 分隔、LaTeX 批量回调只调 1 次且捕获 18 个公式、代码块内 LaTeX 不转换（`app/src/androidTest/java/com/ai/assistance/operit/ui/common/markdown/MarkdownPlainTextRendererAndroidTest.kt:12`）。

util 包是测试重镇：ColorQrCodeUtil 2 色/4 色/8 色/16 色 generate→decode 往返字节精确一致（`app/src/androidTest/java/com/ai/assistance/operit/util/ColorQrCodeUtilAndroidTest.kt:10`）；CrashRecoveryState 四个类共 18 个方法，覆盖 mark/consume/删键/无关 key 保留/重复语义，SharedPreferences 文件名是 crash_recovery_state（`app/src/androidTest/java/com/ai/assistance/operit/util/CrashRecoveryStateAndroidTest.kt:11`）。

LocaleUtilsConfigurationAndroidTest 有 4 个方法，被测 LocaleUtils.createLocaleOverrideConfiguration：override 只设 locales、orientation/屏幕尺寸保持 UNDEFINED；日语 override 第二语言为英语；日语 context 下 R.string.nav_settings 取到"設定"、缺失的日文串回退英文 "Show Model Selector"（`app/src/androidTest/java/com/ai/assistance/operit/util/LocaleUtilsConfigurationAndroidTest.kt:11`）。

PathMapper 四个类共 23 个方法：mapLinuxPath 覆盖根/空串/嵌套/相对/多前导斜杠/尾斜杠/空格路径；ubuntuRoot = filesDir/usr/var/lib/proot-distro/installed-rootfs/ubuntu；环境名大小写不敏感、null/空环境原样返回（`app/src/androidTest/java/com/ai/assistance/operit/util/PathMapperAndroidTest.kt:11`）。

序列化器三个类共 18 个方法：UriSerializer 断言 file:///sdcard/test.txt 与 operit://open/chat 往返、null 编码为 ""、"" 解码为 null；IntRangeSerializer 断言 1..3 精确编码为 {"start":1,"endInclusive":3}、逆序边界保留；LocalDateTimeSerializer 断言 "2024-01-02T03:04:05" 精确编码（`app/src/androidTest/java/com/ai/assistance/operit/util/SerializerAndroidTest.kt:11`）。

stream 包是测试最密的区域：HotStreamAndroidTest 6 个方法测 MutableSharedStream 的 replay 缓存与 EAGERLY/LAZILY 启动模式（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/HotStreamAndroidTest.kt:30`）；StreamAndroidTest 12 个方法覆盖 map/filter/take/drop/flatMap/onEach/concatWith/catch/distinctUntilChanged/asFlow/finally/throttleFirst（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/StreamAndroidTest.kt:24`）；StreamKmpGraphTest 24 个方法测 KMP 图构建与分组捕获，断言 processText("ababcabc")==[5,8]（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/StreamKmpGraphTest.kt:14`）；StreamSplitByTest 8 个方法测 splitBy + StreamXmlPlugin，断言文本/XML/文本切 3 组、tag 用 assertSame 判定插件身份（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/StreamSplitByTest.kt:16`）。

plugins 三个类：StreamJsonPluginTest 9 个方法，Pure 版把 {"key":"value","number":123} 压成 "keyvalue123"（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/plugins/StreamJsonPluginTest.kt:11`）；StreamMarkdownPluginTest 16 个方法覆盖 13 种 markdown 插件，断言 includeAsterisks=false 时粗体内容不含 **（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPluginTest.kt:11`）；StreamXmlPluginTest 8 个方法，逐字符 processChar 驱动 IDLE->TRYING->PROCESSING->IDLE（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/plugins/StreamXmlPluginTest.kt:11`）。

StreamRealTimeSplitTest 的 2 个方法全程只有 println、无任何断言（见代码走查）（`app/src/androidTest/java/com/ai/assistance/operit/util/stream/StreamRealTimeSplitTest.kt:48`）。

### 2. js 测试资产：217 个 test()，kt 不自动加载

js/lib/harness.js 是共享断言/运行器，导出 assert/assertEq/test/runTests；test(name,fn) 只做打包；runTests 支持 options.only 精确单测与 options.startAt 起始位过滤，返回 {success,passed,failed,durationMs,failures,selectedCount}（`app/src/androidTest/js/lib/harness.js:79`）。

关键架构事实：29 个 js 文件中没有任何一个被 kt 测试自动加载执行；执行靠 tools/adb/execute_js_dir 把整个 app/src/androidTest/js 目录推送到真机、调用指定导出函数（如 run/main），或 run_sandbox_script 做顶层 script-mode 执行（`tools/adb/JS_ADB_README.md:125`）。

JS 运行时模块机制：JsExecutionScriptBuilder 用 new Function('module','exports','require',...) 创建模块工厂，支撑脚本间 require 相对路径引用；宿主完成函数 complete(value) 负责序列化并回传结果（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:301`）。

browser 方向：browser_tool_smoke.js 是冒烟脚本，main(params.mode) 先写 fixture 到 /sdcard/Download/Operit/browser_tool_smoke/smoke.html 并 file:// 导航，mode 分支覆盖 snapshot/handle_dialog/file_upload/resize/tabs/close/close_all/run_code（`app/src/androidTest/js/browser_tool_smoke.js:157`）；browser/main.js 是全量套件，27 个 test()，fixture 含 click/log/alert/hover/drag/type/fill/check/select/fileTrigger/delayed 等控件与 dataset 埋点，支持 params.only/startAt 过滤（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/defaultTool/standard/browser/main.js:1`）；browser/probe.js 与 ffmpeg_probe.js 是轻量探针，输出步骤数组（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/defaultTool/standard/browser/probe.js:85`）。

bridge 契约方向：bridge_contract.js 是总入口，exports.run 串行执行 6 个 suite 并汇总 {success,passed,failed,durationMs,failures,suites[]}（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/bridge_contract.js:40`）。basic_syntax.js 21 个 test，覆盖 Java.type/use/importClass/package、三种构造、实例方法/字段糖、静态糖、嵌套类 outer$inner、Java.getApplicationContext() 包名断言 com.ai.assistance.operit（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/basic_syntax.js:18`）。host_runtime.js 10 个 test，空工具名同步与异步错误文案均为 'Tool name cannot be empty'，Promise.all 三 sleep 保序、并发 sleep 总耗时显著小于串行证明重叠执行（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/host_runtime.js:49`）。interfaces.js 15 个 test，8 种 Java 接口实现写法均能在 new Thread(...).join 后执行（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/interfaces.js:17`）。java_to_js.js 12 个 test：Map→plain object、List/JSONArray/Java 数组→JS array、Class/Enum→string、普通 Java 对象保持 proxy（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/java_to_js.js:17`）。js_to_java.js 12 个 test：plain object→new JSONObject/HashMap、JS array→new JSONArray/ArrayList、JS array 展开为 Java varargs（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/js_to_java.js:17`）。suspend_await.js 7 个 test：三种 await Kotlin suspend 函数的方式、boolean 结果解包、Promise.all 批量 await、stream.callSuspend 在 await 期间泵送回调收齐 'abc'，全部包 withTimeout 2000ms（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/suspend_await.js:57`）。

bridge_edges.js 53 个 test，分 4 组 runSpec(28)/runConversion(14)/runHostInterop(8)/runExploratory(3)；另导出 inspect*/measure*/explicitComplete* 序列化边缘探针（循环引用、BigInt、undefined/function、Date/RegExp、Map/Set、Symbol、toJSON 抛错、emit 事件形状）（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_edges/bridge_edges.js:640`）。

script_mode_contract 11 个脚本：await_return 验证顶层 await+return 完成路径（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/script_mode_contract/await_return.js:3`）；delayed_complete 验证 setTimeout 50ms 后 complete 的异步延迟完成（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/script_mode_contract/delayed_complete.js:9`）；parallel_sleep 断言并行总耗时+60ms < 串行，验证工具调用真正重叠（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/script_mode_contract/parallel_sleep.js:66`）；download_file_probe 覆盖同步/原生异步/高级 toolCall 三种下载路径，3 成功 URL + 1 个 404 URL（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/script_mode_contract/download_file_probe.js:108`）；download_file_stress_probe 27 个下载并发走 rawAsync 路径，强依赖外网 CDN（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/script_mode_contract/download_file_stress_probe.js:88`）。

util 方向：ttscleaner.js 31 个 test，直调 TtsCleanerINSTANCE.clean 与 WaifuMessageProcessorINSTANCE.cleanContentForWaifu 组成 cleanForSpeech 管线；大写 `<THINK>`/`<SEARCH>` 与带属性 `<think type="hidden">` 三个用例明确断言"当前会泄漏内部文本"（已知行为锁定）（`app/src/androidTest/js/com/ai/assistance/operit/util/ttscleaner/ttscleaner.js:143`）。waifusplitter/main.js 29 个 test，createKotlinAdapter 直调 WaifuMessageProcessorINSTANCE 的分句 API，createJsPrototypeAdapter 在 Kotlin 结果上叠 JS 启发式；覆盖小数/版本号/URL/邮箱不断句、标题/加粗/链接/代码块/表格/LaTeX/引用/列表保护、流式会话增量语义（`app/src/androidTest/js/com/ai/assistance/operit/util/waifusplitter/main.js:620`）。

### 3. 项目模板：9 种脚手架，从 assets 复制到工作区

模板消费入口唯一：WorkspaceUtils.createAndGetDefaultWorkspace 按 projectType 字符串映射到模板目录（android/flutter/node/typescript/python/java/go/office/blank，缺省走 web），每个分支先 copyTemplateFiles 再 createProjectConfigIfNeeded（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:22`）。

copyTemplateFiles 从 APK assets 的 templates/$templateName 递归复制到内部存储工作区 /data/data/com.ai.assistance.operit/files/workspace/{chatId}；无下载、无解压（assets 内已是散文件）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:682`）。

复制时特殊处理：根目录下名为 gitignore（无点）的文件重命名为 .gitignore，因为 Android 构建工具会排除 assets 中的 .gitignore 文件（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:691`）。

两条"没有"：不存在占位符替换机制，模板按原样复制，用户需手工改包名/应用名；不存在模板版本号与更新机制，模板随 APK assets 发布、仅随 App 升级更新（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:700`）。

README 引用的 .operit/config.json 不在模板内，而是由 createProjectConfigIfNeeded 按 ProjectType 枚举动态生成，已存在则跳过（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:754`）。

注意：QuickPluginCreatorSetupSupport 与 assets/templates 无关，它从 CDN 下载 sandboxpackage_dev_install_or_update.js 再执行，是"快速创建插件"入口的另一条链路（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/QuickPluginCreatorSetupSupport.kt:20`）。

android 模板是 Jetpack Compose + Material3 脚手架：namespace/applicationId=com.java.myapplication，compileSdk=35，minSdk=24，targetSdk=35（`app/src/main/assets/templates/android/app/build.gradle.kts:7`）；AGP 9.0.0、Kotlin 2.3.10、composeBom 2026.01.01，Gradle wrapper 指向 gradle-9.1.0-bin.zip，仓库顺序为阿里云/华为云/google/mavenCentral（`app/src/main/assets/templates/android/gradle/libs.versions.toml:2`）；用 resolutionStrategy 把 aapt2 换成 linux-aarch64 classifier，gradle.properties 设 android.aapt2.process.daemon=false 适配 proot/Termux（`app/src/main/assets/templates/android/app/build.gradle.kts:50`）。

android 与 flutter/android 各内置一份 ARM64 aapt2 二进制（4706040 字节），sha256 与 android/README.md 声称的完全一致（`app/src/main/assets/templates/android/README.md:169`）。android/setup_android_env.sh 约 630 行：测速选镜像、装 OpenJDK17、sdkmanager 装 platform-35/build-tools 35.0.0、改写 wrapper distributionUrl 为本地 file URL、校验 SHA 后把内置 aapt2 替换进 SDK（`app/src/main/assets/templates/android/setup_android_env.sh:1`）。

flutter 模板是 flutter create 标准六平台工程：pubspec.yaml name=operit_flutter_project，version=1.0.0+1，Dart SDK ^3.9.0（`app/src/main/assets/templates/flutter/pubspec.yaml:1`）；settings.gradle.kts 强制从 local.properties 读 flutter.sdk，缺失则 require 抛异常（`app/src/main/assets/templates/flutter/android/settings.gradle.kts:7`）；setup_android_env.sh 约 1300 行，自动安装 Flutter stable、NDK 28.2.13676358、CMake 3.22.1，ARM64 主机用 box64 包裹 x86_64 工具链（`app/src/main/assets/templates/flutter/android/setup_android_env.sh:1`）。

其余模板都是最小手写示例：go（go.mod module operit-go-project，go 1.21）（`app/src/main/assets/templates/go/go.mod:1`）；node（package.json name=operit-node-project，index.js 在 127.0.0.1:3000 起中文页面服务）（`app/src/main/assets/templates/node/package.json:1`）；python（requirements.txt 仅注释无依赖）（`app/src/main/assets/templates/python/requirements.txt:1`）；typescript（build=tsc、strict=true、target ES2020）（`app/src/main/assets/templates/typescript/package.json:1`）；java（Java 17、junit-jupiter 5.10.0、mainClass=com.operit.app.Main、fat jar）（`app/src/main/assets/templates/java/build.gradle.kts:1`）；web 仅 2 文件（index.html 单文件渐变落地页 + gitignore）（`app/src/main/assets/templates/web/index.html:1`）；office 仅 2 文件（Pandoc/XeLaTeX 手册 README + gitignore）（`app/src/main/assets/templates/office/README.md:1`）。

### 4. 本地化：7716 条中文打底，9 语言，日语特殊回退

app/src/main/res/values/strings.xml 共 8507 行、7716 个 `<string>` 条目、1 个 `<plurals>`、0 个 `<string-array>`，是全应用文案的唯一默认语言源（中文）（`app/src/main/res/values/strings.xml:1`）。app_name = "Operit AI"（`app/src/main/res/values/strings.xml:2`）。全文件唯一的 plurals 是 chat_delete_selected_messages_confirm，只有 quantity="other" 一个分支（`app/src/main/res/values/strings.xml:3342`）。

colors.xml 9 行是 Material 默认调色板（purple_200/teal_200 等）（`app/src/main/res/values/colors.xml:1`）；themes.xml 17 行定义 Theme.Operit 继承 Theme.MaterialComponents.DayNight.DarkActionBar（`app/src/main/res/values/themes.xml:1`）；values-night 同名主题把 colorPrimary 换成 purple_200 并新增 statusBarColor（`app/src/main/res/values-night/themes.xml:1`）。

xml/locales_config.xml 声明 9 个 locale：zh、en、ja、ko、es、ms、id、pt-BR、ro（`app/src/main/res/xml/locales_config.xml:1`）。各语言条目数：默认 7716；en 7710；es/ms/ro 7555；id/ko/pt-rBR 7475；ja 仅 278（`app/src/main/res/values-en/strings.xml:1`）。

语言切换是整应用重启：LanguageSettingsScreen 调 LocaleUtils.setAppLanguage 后以 FLAG_ACTIVITY_NEW_TASK|FLAG_ACTIVITY_CLEAR_TASK 启动 MainActivity（`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/LanguageSettingsScreen.kt:95`）；language_info 文案明示"更改语言后，应用将自动重启以应用新的语言设置"（`app/src/main/res/values/strings.xml:1160`）。

日语有特殊回退链：createCompatLocaleList 对 ja 返回 LocaleListCompat "ja,en"，日语未翻译项回退到英语资源、永不显示中文默认资源（文件内有日文注释写明意图）（`app/src/main/java/com/ai/assistance/operit/util/LocaleUtils.kt:93`）；createPlatformLocaleList 同理返回 LocaleList(ja, ENGLISH)（`app/src/main/java/com/ai/assistance/operit/util/LocaleUtils.kt:105`）。

LocaleUtils.LanguageCodes 定义 AUTO="system" 及 9 个语言码，legacy 别名 pt→pt-BR、in→id，supportedLanguages 共 10 项（含跟随系统）（`app/src/main/java/com/ai/assistance/operit/util/LocaleUtils.kt:20`）。setAppLanguage 用 runBlocking(Dispatchers.IO) 保存语言到 UserPreferencesManager；Android 13+ 用 AppCompatDelegate.setApplicationLocales，旧版本用 resources.updateConfiguration（`app/src/main/java/com/ai/assistance/operit/util/LocaleUtils.kt:180`）。OperitApplication 与 MainActivity 都在 attachBaseContext 包装 locale override（`app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:570`）。

文案质量细节：占位符以索引式 %1$s 为主，但 engine_init_failed 等混用非索引 "%s"（`app/src/main/res/values/strings.xml:2067`）；字面百分号转义正确，plugin_complete_with_failures 用 "%1$d%%"（`app/src/main/res/values/strings.xml:696`）。典型引用：AboutScreen 用 stringResource(id = R.string.app_name)（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:877`）。

### 5. tools/：12 个开发者工具

tools/adb/ 是 Android 端 JS 运行/调试入口：execute_js.sh 把单个 JS 推到设备后发 am broadcast（ACTION=com.ai.assistance.operit.EXECUTE_JS）让 Operit JS runtime 执行导出函数并回写结构化结果；execute_js_dir 支持目录 bundle+本地 require；run_sandbox_script 执行顶层脚本模式（`tools/adb/execute_js.sh:216`）。deepseek_harness_probe.js 是沙箱内诊断脚本，采集 DeepSeek Harness 的 PID 文件状态、进程存活、日志与服务端口（`tools/adb/deepseek_harness_probe.js:6`）。

tools/compose_dsl/ 从 Gradle 缓存的 Compose source jar 生成 Kotlin 渲染器注册表、渲染器与 TS 绑定（examples/types/compose-dsl.material3.generated.d.ts）；核心复杂节点保留手写渲染器（`tools/compose_dsl/README.md:1`）。

tools/example_packages/ 的 packages_whitelist.txt（40 条目）列出允许同步的官方示例包；sync_example_packages.py 按 syncable 后缀同步进设备端 Operit（debug/release 双包名）（`tools/example_packages/sync_example_packages.py:7`）。

tools/ffmpeg/ 在 WSL 用 ffmpeg-kit 源码构建 Android 版，ps1 把 aar 导入 app/libs（`tools/ffmpeg/build_ffmpeg_kit_wsl.sh:1`）。

tools/github/ 三个脚本：commit_ai.py 用 git diff 生成 AI commit message，token 只走环境变量 AI_API_KEY（`tools/github/commit_ai.py:183`）；import_anthropic_skills.py 并发抓取 Anthropic 官方 skills 导入 GitHub 仓库（`tools/github/import_anthropic_skills.py:15`）；list_issues.py 用 urllib 直调 GitHub REST API，默认走系统 CA 校验（`tools/github/list_issues.py:33`）。

tools/hotbuild/ 是 OTA 热补丁流水线：自研二进制差分格式 OPATCH1（MAGIC=OPATCH1\0，OP_END=0/OP_COPY=1/OP_ADD=2，单块最大 4MB），build_patch.py 生成、apply_patch.py 应用（双端 sha256 校验），versionName 形如 1.12.2+3（`tools/hotbuild/build_patch.py:19`）。

tools/mcp_bridge/ 把 STDIO 型本地 MCP 服务器桥接到 TCP（默认端口 8752），构建产物同步到 app/src/main/assets/bridge/（`tools/mcp_bridge/README.md:1`）；spawn-helper.ts 每个服务 fork 一个 helper 子进程，npx 改写为 pnpm dlx，默认注入离线 npm 配置（`tools/mcp_bridge/spawn-helper.ts:36`）；index.ts 检测到 stderr 含缺 key 文本时判定为致命启动错误、不再自动重启（`tools/mcp_bridge/index.ts:299`）。

tools/native_ripgrep/ 是 Rust cdylib（operit_ripgrep），用 ignore crate 做目录遍历（尊重 .gitignore）、jni 0.21 暴露 JNI，默认排除 .backup/.operit/backup 目录，前 8KB 含 NUL 判定为二进制跳过（`tools/native_ripgrep/src/lib.rs:56`）。

tools/shell_identity_launcher/ 是 C++ setuid helper：必须以 root/shell 启动，root 时先降级到 shell(uid 2000)，再经 Shizuku 移植的 SELinux helper 切域到 u:r:shell:s0，最后 execvp 目标命令；降级失败直接 return 1；用途是让 DisplayManagerService 的 'packageName must match the calling uid' 校验通过（`tools/shell_identity_launcher/native-lib.cpp:130`）。

tools/sandboxpackage_dev_install_or_update.js 在设备端安装/更新开发版 SandboxPackage，从 CDN 拉取 22 个 .d.ts 类型文件，下载并发 8（`tools/sandboxpackage_dev_install_or_update.js:5`）。

tools/string/ 是字符串国际化工具集：count_ui_strings.py 统计需国际化的中文字符串；fill_missing_translations.py 以 zh 为基准补全其他语言缺失项（`tools/string/count_ui_strings.py:1`）。

tools/toolpkg/ 的 toolpkg_hook_runner.js 在宿主外本地模拟运行 ToolPkg hooks，支持 --payload/--fixtures mock（`tools/toolpkg/toolpkg_hook_runner.js:8`）。

tools/shower/ 是独立 Android 应用（包名 com.ai.assistance.shower），scrcpy 式思路：adb push 到 /data/local/tmp 改名为 shower-server.jar，用 app_process 在 adb shell 身份下启动，无需安装 APK；当前是 Binder-only 架构，通过 Shizuku 式 binder 握手把 IShowerService 传给主应用（`tools/shower/app/src/main/java/com/ai/assistance/shower/Main.java:401`）。每个 DisplaySession 维护 MediaCodec H.264 编码循环，输出帧经 IShowerVideoSink.onVideoFrame(byte[]) 回调；无活跃 sink 超时则 System.exit(0) 自杀（`tools/shower/app/src/main/java/com/ai/assistance/shower/Main.java:244`）。IShowerService 是 aidl 风格手工 Binder 接口：ensureDisplay/destroyDisplay/launchApp、全套触摸注入、按键注入、requestScreenshot、setVideoSink；Stub/Proxy 手写 Parcel 序列化（`tools/shower/app/src/main/java/com/ai/assistance/shower/IShowerService.java:11`）。DisplayCapture 对指定 displayId 抓一帧转 PNG（`tools/shower/app/src/main/java/com/ai/assistance/shower/DisplayCapture.java:18`）。InputController 经反射拿 InputManager.injectInputEvent 实现跨 display 注入，默认开启 human-like 抖动反自动化检测（`tools/shower/app/src/main/java/com/ai/assistance/shower/InputController.java:17`）。ShowerBinderContainer 是 44 行的 Parcelable IBinder 包装，用于经 Intent extra 跨进程传 binder（`tools/shower/app/src/main/java/com/ai/assistance/shower/ShowerBinderContainer.java:1`）。

### 6. examples/：60+ 官方示例工具包

包格式：顶部 METADATA 块 + 工具函数 + exports，.js 首选、Promise 异步，.hjson 遗留兼容；.ts 是源码、.js 是编译产物（`examples/README.md:1`）。

自动化助手类：automatic_ui_base（点击/滑动/输入基础工具）、automatic_ui_subagent（基于 UI 控制器模型的自然语言多步操作子代理）、automatic_baidu_map_assistant、automatic_bilibili_assistant、automatic_xiaohongshu_assistant、browser（对齐 Playwright MCP 工具面）（`examples/automatic_ui_base.ts:1`）。搜索类：duckduckgo、google_search、various_search、tavily、zhipu_search、crossref（`examples/duckduckgo.ts:1`）。AI 绘画类：minimax_draw、openai_draw、qwen_draw、siliconflow_draw、xai_draw、zhipu_draw、nanobanana_draw（`examples/minimax_draw.ts:1`）。开发工具类：code_runner（JS/Python/Ruby/Go/Rust/C/C++ 多语言执行）、java_bridge、hex_editor、github（需 GITHUB_TOKEN）、network_test（`examples/code_runner.ts:1`）。媒体/生活类：12306（1014 行、33 个工具，余票/中转/经停）（`examples/12306.ts:1`）。系统/平台类：super_admin（terminal=Ubuntu 环境 + shell=Shizuku/Root 直执行 Android 命令）、system_tools、tasker、workflow、operit_editor（直改平台配置）（`examples/super_admin.ts:1`）。通信/社交类：ai_chat、qqbot（QQ Bot Gateway WebSocket，env QQBOT_APP_ID/SECRET）（`examples/qqbot/src/packages/qqbot.ts:1`）。

apktool 是最重的示例（ToolPkg，toolpkg_id=com.operit.apk_reverse_toolkit v1.1.0）：基于内置 dex-jar 运行时的 APK 逆向工具包，工具含 inspect/decode/jadx/search_text/search_address/build/sign；JADX 默认 isolated 独立进程运行（子进程 OOM 不拖死宿主，支持断点续跑）（`examples/apktool/manifest.json:1`）。manifest 声明 4 个 resource jar：apktool-runtime-android.jar（5,190,028 字节）、android-framework.jar（4,488,013）、jadx-runtime-android.jar（14,332,003）、apk-reverse-helper-runtime-android.jar（3,185,571）；README 注明 .jar 是本地构建产物、不再进 git（`examples/apktool/resources/apktool/README.md:1`）。runtime_helper/ 10 个 Java 源码：ApkReverseHelperFacade 外观门面 + 桥接支持类（`examples/apktool/runtime_helper/src/main/java/com/operit/apkreverse/runtime/ApkReverseHelperFacade.java:21`）。桥接链路：JS 侧 ToolPkg.readResource 取 jar → Java.loadJar 加载 dex-jar → Java.type 直调静态方法；JADX 走 IsolatedJadxMain 经 app_process 独立进程启动（VMRuntime.clearGrowthLimit() 解除 256MB 上限），stdout 最后一行 OPERIT_JADX_PAYLOAD: 为结果载荷（`examples/apktool/runtime_helper/src/main/java/com/operit/apkreverse/runtime/IsolatedJadxMain.java:5`）。

其他代表：context_limiter_c 截取最近 N 层上下文（env CTX_LIMITER_C_FLOOR_LIMIT 默认 5）（`examples/context_limiter_c/src/packages/ctx_limiter_c.ts:1`）；custom_ai_provider 演示 ToolPkg.registerAiProvider 注册自定义 AI 供应商（`examples/custom_ai_provider/README.md:1`）；deepsearching 是多子 Agent 深度搜索调度（`examples/deepsearching/src/main.ts:1`）；linux_ssh 基于 terminal 的 SSH + tmux 长任务（`examples/linux_ssh/src/packages/linux_ssh.ts:1`）；message_insert 在发消息时注入时间/电量/天气/位置等显性附件（`examples/message_insert/src/main.ts:1`）；plan_mode 是聊天内计划模式 + PLAN.md 协作（`examples/plan_mode/src/packages/plan_mode_tools.ts:1`）；subagent 是被动式 subagent_run 工具（`examples/subagent/src/packages/subagent.ts:1`）；windows_control 经 HTTP 调 PC Agent 控制 Windows（`examples/windows_control/src/packages/windows_control.ts:1`）；worldbook v1.2.0 是世界书/知识库插件（`examples/worldbook/src/packages/worldbook_tools.ts:1`）；sidebar_* 6 个侧边栏宿主插件（含 deepseek_harness，127.0.0.1:3081）（`examples/sidebar_deepseek_harness/README.md:1`）。

### 7. 鸿蒙系统限制备注（社群经验，非代码事实）

> 口径声明：本节不是代码事实。内容来自教程区 issue #134《鸿蒙系统终端兼容性说明》（社群知识库 2026-09-30 备份清洗），描述的是鸿蒙操作系统自身的行为。代码侧唯一能关联的事实是：Operit 内置终端是基于 proot 的 Linux 环境——PathMapper 的 `ubuntuRoot` 指向 `filesDir` 下的 proot-distro ubuntu root（`app/src/main/java/com/ai/assistance/operit/util/PathMapper.kt:21`）。"鸿蒙限制 ptrace → proot 无法初始化"这条因果是社群实测结论，源码里没有对应断言，不要当代码事实引用。

- 现象：华为鸿蒙（HarmonyOS）设备上，Operit 内置终端无法正常启动、报错或崩溃；依赖本地终端的 MCP 插件无法运行。
- 原因（社群结论）：① 鸿蒙底层安全机制与内核对 ptrace 等系统调用存在限制，proot 进程无法正常初始化和运行；② 部分鸿蒙版本移除了无线调试功能、无障碍权限开放受限，无法提 Shizuku/ADB，Operit 只能以 Standard（标准）权限等级运行。
- 实测无效的绕法："鸿蒙 → 卓翼通 → 虚拟机 → Operit"套娃方案实测行不通。
- 现状建议：缺无线调试/无障碍权限的鸿蒙设备上，基础的 AI 联网对话、角色卡聊天、云端 API 调用及不依赖本地终端/高级系统权限的功能可正常使用；要完整功能建议用标准 Android 设备；完整适配待 Operit2 重构。

## 关键符号

- `createAndGetDefaultWorkspace` — 模板消费总入口，按 projectType 映射模板目录（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:22`）
- `copyTemplateFiles` — 从 assets 复制模板到工作区，处理 gitignore 重命名（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:682`）
- `createProjectConfigIfNeeded` — 动态生成 .operit/config.json（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/WorkspaceUtils.kt:754`）
- `LocaleUtils.setAppLanguage` — 语言切换，写偏好 + 设 locale（`app/src/main/java/com/ai/assistance/operit/util/LocaleUtils.kt:180`）
- `createCompatLocaleList` — 日语特殊回退 ja→en（`app/src/main/java/com/ai/assistance/operit/util/LocaleUtils.kt:93`）
- JsExecutionScriptBuilder — JS 模块工厂与 complete() 回传（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:301`）
- `harness.js` — js 测试共享运行器（`app/src/androidTest/js/lib/harness.js:79`）
- `bridge_contract.js` — JsBridge 契约总入口（`app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract/bridge_contract.js:40`）
- `IShowerService` — shower 手工 Binder 接口（`tools/shower/app/src/main/java/com/ai/assistance/shower/IShowerService.java:11`）
- `ApkReverseHelperFacade` — apktool Java 桥接外观（`examples/apktool/runtime_helper/src/main/java/com/operit/apkreverse/runtime/ApkReverseHelperFacade.java:21`）
- `OPATCH1` — hotbuild 自研差分格式（`tools/hotbuild/build_patch.py:19`）
- `operit_ripgrep` — Rust ripgrep cdylib（`tools/native_ripgrep/src/lib.rs:56`）

## 调用链

1. **kt 插桩测试执行**：开发者写 @Test → AndroidJUnit4 runner 在真机执行 → 断言被测类行为。
2. **js 测试执行**：开发者写 test() 脚本 → tools/adb/execute_js_dir 推送 app/src/androidTest/js 到真机 → 调用导出函数（run/main）→ JsExecutionScriptBuilder 的模块工厂加载 → complete(value) 序列化回传 → harness 汇总 {success,passed,failed}。
3. **模板消费**：用户在聊天工作区选项目类型 → createAndGetDefaultWorkspace 按 projectType 映射模板目录 → copyTemplateFiles 从 assets 复制到 workspace/{chatId}（gitignore 重命名）→ createProjectConfigIfNeeded 生成 .operit/config.json → 用户跑 setup_android_env.sh 配环境。
4. **语言切换**：用户在语言设置页选语言 → LocaleUtils.setAppLanguage 写偏好 → Android 13+ 用 setApplicationLocales → FLAG_ACTIVITY_NEW_TASK|FLAG_ACTIVITY_CLEAR_TASK 重启 MainActivity → 加载 values-{lang}/strings.xml（日语缺翻译回退英语）。
5. **shower 投屏**：主应用 adb push shower-server.jar → app_process 启动 Main → Binder 握手传 IShowerService → ensureDisplay 建虚拟屏 → MediaCodec H.264 编码 → onVideoFrame 回调 → 触摸经 InputController 注入。
6. **apktool 逆向**：JS 调 ToolPkg.readResource 取 dex-jar → Java.loadJar 加载 → Java.type(ApkReverseHelperFacade) 直调 → JADX 走 IsolatedJadxMain 独立进程 → OPERIT_JADX_PAYLOAD: 回传结果。

## 来源

种子目录（@ `dbf71916`，commit dbf71916fae9750cfdc9f9a774f5a0fee56633fb）：

- `app/src/androidTest/` — 67 文件：38 kt（37 测试类 + StreamTestExtensions 辅助）+ 29 js
- `app/src/main/assets/templates/` — 193 文件：android 41、flutter 123、go 4、java 8、node 4、office 2、python 4、typescript 5、web 2
- `app/src/main/res/values/` + values-en/es/id/ja/ko/ms/night/pt-rBR/ro + `app/src/main/res/xml/locales_config.xml` — 7716 条 strings，9 语言
- `tools/` — 114 文件：adb、compose_dsl、example_packages、ffmpeg、github、hotbuild、mcp_bridge、native_ripgrep、sandboxpackage_dev_install_or_update.js、shell_identity_launcher、shower、string、toolpkg
- `examples/` — 540 文件：60+ 示例工具包，.ts 源码 + .js 产物成对
- 教程区 issue #134《鸿蒙系统终端兼容性说明》——§7 鸿蒙系统限制备注的唯一来源，社群经验、非代码事实

关联阅读：模板消费侧见 WorkspaceUtils（ui-main 页）；JsBridge 运行时见 JsExecutionScriptBuilder（core 相关页）；LocaleUtils 语言工具（util 相关页）。
