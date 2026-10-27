# Critic 报告：ui-settings-theme（Issue #98）

- 复核对象：`review/batch-07/ui-settings-theme.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit`，HEAD 已实地确认为 `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（钉死版本一致）
- 核验方式：6 路并行独立核验员逐条实地读源码窗口（[n-5,n+4]，缺依据再扩 ±20）；只读，未改交付文件
- 判定口径：窗口必须完整支撑断言的每个符号/数字/行为；复合断言（多独立断言并一句）按任务要求必须拆分

## 一、facts.json（150 条）：139 PASS / 11 COMPOSITE-PASS / 0 FAIL

无捏造、无符号错误。11 条为复合断言（子断言均成立，但违反"一事实一断言"要求，必须拆分）。

### facts[0–29]：25 PASS / 5 COMPOSITE-PASS

| # | ref | 结论 |
|---|---|---|
| 0 | Theme.kt:94 | PASS：`@Composable fun OperitTheme(content: @Composable () -> Unit)` 签名一致 |
| 1 | Theme.kt:99 | PASS：initial = CharacterCard(DEFAULT_CHARACTER_CARD_ID) |
| 2 | Theme.kt:103 | PASS：disableBackgroundForTarget 写回 use_background_image=false |
| 3 | Theme.kt:137 | PASS：remember 五键缓存 createCustomTypography |
| 4 | Theme.kt:148 | PASS：暗色判定 isSystemInDarkTheme / THEME_MODE_DARK |
| 5 | Theme.kt:157 | PASS：动态取色仅 Android 12+（S） |
| 6 | Theme.kt:172 | PASS：useCustomColors 走 generateDarkColorScheme |
| 7 | Theme.kt:174 | PASS：次色空沿用 colorScheme.secondary |
| 8 | Theme.kt:193 | PASS：SideEffect 恒设 setDecorFitsSystemWindows(false) |
| 9 | Theme.kt:197 | PASS：statusBarHidden 隐藏状态栏，上滑呼出 |
| 10 | Theme.kt:207 | PASS：状态栏颜色四级优先级一致 |
| 11 | Theme.kt:217 | PASS：isAppearanceLightStatusBars = !isColorLight(...) |
| 12 | Theme.kt:222 | PASS：背景图时导航栏透明、Q+ 关对比度强制 |
| 13 | Theme.kt:230 | PASS：isAppearanceLightNavigationBars = !darkTheme |
| 14 | Theme.kt:232 | PASS：无背景图分支 Q+ 开对比度强制、导航栏色=background |
| 15 | Theme.kt:244 | PASS：ExoPlayer remember 五键 |
| 16 | Theme.kt:253 | PASS：视频条件三件套 |
| 17 | Theme.kt:258 | PASS：DefaultLoadControl 5000/10000/500/1000ms、5MB |
| 18 | Theme.kt:272 | PASS：循环 REPEAT_MODE_ALL/OFF |
| 19 | Theme.kt:276 | **COMPOSITE-PASS**：volume 0f/1f（L279）+ playWhenReady=true（L280）两断言合并，均有依据→**需拆分** |
| 20 | Theme.kt:289 | **COMPOSITE-PASS**：catch 打日志（L290）+ disableBackgroundForTarget（L295）两断言合并→**需拆分** |
| 21 | Theme.kt:305 | PASS：DisposableEffect(Unit) onDispose 三连 |
| 22 | Theme.kt:320 | PASS：ON_PAUSE 暂停 / ON_RESUME 播放 |
| 23 | Theme.kt:341 | PASS：三个 CompositionLocal 下发齐全 |
| 24 | Theme.kt:340 | PASS：waterGlassState 条件 rememberLiquidState |
| 25 | Theme.kt:350 | **COMPOSITE-PASS**：Box 黑白背景（L354）+ Modifier.liquefiable 条件挂载（L355–357）→**需拆分** |
| 26 | Theme.kt:376 | PASS：rememberAsyncImagePainter 纯色 error fallback |
| 27 | Theme.kt:385 | **COMPOSITE-PASS**：LaunchedEffect（L377）+ 日志（L378–382）+ file.exists（L384–396）+ 熔断（L399）四断言合并→**需拆分** |
| 28 | Theme.kt:405 | **COMPOSITE-PASS**：alpha（L408）+ 条件 blur（L410–411）→**需拆分** |
| 29 | Theme.kt:437 | PASS：(1-opacity)*255 前景 ColorDrawable |

### facts[30–59]：27 PASS / 3 COMPOSITE-PASS / 0 FAIL

| # | ref | 结论 |
|---|---|---|
| 30 | Theme.kt:490 | PASS：8 色 copy(alpha=1f) 实数 surface/Variant/background/Container×5 |
| 31 | Theme.kt:522 | **COMPOSITE-PASS**：primaryContainer=lighten(0.7f)（L537）+ onSurface=Black（L553）→**需拆分** |
| 32 | Theme.kt:561 | **COMPOSITE-PASS**：lighten 0.2f + darken 0.3f + onSurface=White 三断言→**需拆分** |
| 33 | Theme.kt:**592** | PASS（内容），但**行号漂移**：`getContrastingTextColor` 实际在 **603** 行→**需修正 ref 为 :603** |
| 34 | Theme.kt:**639** | PASS（内容），但**行号漂移**：`isColorLight` 实际在 **649–653** 行（return 在 L652）→**需修正 ref 为 :649** |
| 35 | Color.kt:5 | PASS：Purple80/PurpleGrey80/Pink80 色值逐字一致 |
| 36 | Color.kt:9 | PASS：Purple40 系色值逐字一致 |
| 37 | Type.kt:18 | PASS：bodyLarge 16.sp/24.sp/0.5.sp |
| 38 | Type.kt:44 | PASS：四字体映射全对（+else→Default） |
| 39 | Type.kt:57 | PASS：file:// 走 Uri.parse().toFile() |
| 40 | Type.kt:83 | PASS：!useCustomFont return null |
| 41 | Type.kt:95 | PASS：when 两分支映射 |
| 42 | Type.kt:146 | PASS：!useCustomFont && fontScale==1.0f 直接返回 |
| 43 | Type.kt:161 | PASS：withScale 字号行高同乘 |
| 44 | ThemeUtils.kt:8 | PASS：亮度>0.5 黑否则白 |
| 45 | ThemeUtils.kt:21 | PASS：luminance<0.3 \|\| >0.7 |
| 46 | ThemePreferenceLocals.kt:14 | PASS：未提供抛错（实际 L16） |
| 47 | ThemePreferenceLocals.kt:20 | PASS：初始快照 source/id/values |
| 48 | TextLayoutSettings.kt:18 | PASS：1f/0f/12f 默认值 |
| 49 | TextLayoutSettings.kt:30 | PASS：UserPreferencesManager 三 flow |
| 50 | ThemeColorSchemeResolver.kt:28 | PASS：uiMode 判暗色，无 isSystemInDarkTheme |
| 51 | ThemeColorSchemeResolver.kt:71 | PASS：generateResolvedLightColorScheme |
| 52 | ThemeColorSchemeResolver.kt:109 | PASS：generateResolvedDarkColorScheme |
| 53 | LiquidGlass.kt:27 | PASS：LiquidGlassMinApi=TIRAMISU |
| 54 | LiquidGlass.kt:29 | PASS：isLiquidGlassSupported() |
| 55 | LiquidGlass.kt:43 | PASS：!enabled return this（实际 L42–44） |
| 56 | LiquidGlass.kt:55 | **COMPOSITE-PASS**：fallbackShadow（L77）+ border 宽（coerceAtLeast 0.6.dp）→**需拆分** |
| 57 | LiquidGlass.kt:56 | PASS：fallbackSurfaceTint 0.16f/0.24f |
| 58 | LiquidGlass.kt:97 | PASS：vibrancy+blur+lens(12.dp/18.dp/色差开) |
| 59 | LiquidGlass.kt:107 | PASS：Highlight 宽=边框宽、模糊 2.4×、alpha 0.62 |

注：[33][34] 正文 md 已用正确行号（:603/:649），仅 facts.json 锚点漂移。

### facts[60–89]：28 PASS / 2 COMPOSITE-PASS / 0 FAIL

| # | ref | 结论 |
|---|---|---|
| 60 | LiquidGlass.kt:84 | PASS：baseTintAlpha 0.16f/0.23f、coerceIn(0f,0.48f) |
| 61 | WaterGlass.kt:22 | PASS：WaterGlassMinApi=TIRAMISU |
| 62 | WaterGlass.kt:35 | PASS：!enabled return this |
| 63 | WaterGlass.kt:**89** | PASS（内容），**行号建议优化**：六组参数实际在 97–102 行（89 行为 `.liquid(liquidState) {` 块内）→**建议 ref 改为 :97** |
| 64 | WaterGlass.kt:71 | PASS：tintAlpha 0.09f/0.16f、coerceIn(0f,0.56f) |
| 65 | AppBackgroundLayer.kt:36 | PASS：独立可复用 composable |
| 66 | AppBackgroundLayer.kt:91 | PASS：catch 仅打日志、无 disableBackgroundForTarget |
| 67 | AppBackgroundLayer.kt:103 | PASS：DisposableEffect(exoPlayer) 三连释放 |
| 68 | AppBackgroundLayer.kt:148 | PASS：((1f-opacity)*255).toInt().coerceIn(0,255) |
| 69 | CustomScaffold.kt:35 | PASS：contentWindowInsets=WindowInsets(0,0,0,0) |
| 70 | CustomScaffold.kt:22 | PASS：containerColor=background |
| 71 | ErrorDialog.kt:53 | PASS：限高 350.dp、滚动、SelectionContainer、Monospace |
| 72 | ErrorDialog.kt:70 | PASS：clipboardManager.setText |
| 73 | ErrorDialog.kt:44 | PASS：ifBlank→unknown_error、标题 request_failed |
| 74 | ErrorDialog.kt:37 | PASS：dismissOnBackPress/ClickOutside=true |
| 75 | ManagedDragonBonesView.kt:22 | PASS：IDLE_ANIMATION_NAME="idle" |
| 76 | ManagedDragonBonesView.kt:25 | PASS：blink/shake_head/wag_tail |
| 77 | ManagedDragonBonesView.kt:85 | PASS：delay(Random.nextLong(2000,8000))、RANDOM_ANIMATION_LAYER=10（L31 实读） |
| 78 | ManagedDragonBonesView.kt:73 | PASS：fadeInAnimation(layer=BASE_ANIMATION_LAYER=0, loop=0) |
| 79 | ManagedDragonBonesView.kt:103 | **COMPOSITE-PASS**：拖拽 overrideBonePosition（ik_target=L34）+ 结束 resetBone→**需拆分** |
| 80 | ThemeSettingsScreen.kt:7 | PASS：直接转发 ThemeSettingsContent() |
| 81 | LanguageSettingsScreen.kt:64 | PASS：LocaleUtils.getSupportedLanguages() |
| 82 | LanguageSettingsScreen.kt:111 | PASS：setAppLanguage + delay(600) + NEW_TASK\|CLEAR_TASK 重启 MainActivity |
| 83 | LayoutAdjustmentSettingsScreen.kt:70 | PASS：默认值 2f/16f/1f/0f/12f |
| 84 | LayoutAdjustmentSettingsScreen.kt:141 | PASS：valueRange 0.8f..2.0f |
| 85 | LayoutAdjustmentSettingsScreen.kt:156 | PASS：valueRange -1f..8f |
| 86 | LayoutAdjustmentSettingsScreen.kt:171 | PASS：valueRange 0f..48f |
| 87 | LayoutAdjustmentSettingsScreen.kt:384 | **COMPOSITE-PASS**：显示 invalid_value_range 红字（L381–389）+ 输入框背景切 errorContainer（L347–348）→**需拆分**；注 ref :384 指向错误提示 Text，输入框证据在 347–348 |
| 88 | LayoutAdjustmentSettingsScreen.kt:279 | PASS：DecimalFormat("0.##") 三处格式化 |
| 89 | LayoutAdjustmentSettingsScreen.kt:256 | PASS：预览区 ProvideAiMarkdownTextLayoutSettings 包裹 |

### facts[90–119]：30 PASS / 0 FAIL

| # | ref | 结论 |
|---|---|---|
| 90 | ThemeEditorSession.kt:12 | PASS：internal class |
| 91 | ThemeEditorSession.kt:55 | PASS：液态/水玻璃互斥（实际分支 L60–64，ref 为函数头，±20 内） |
| 92 | ThemeEditorSession.kt:66 | PASS：cursor 气泡玻璃互斥 |
| 93 | ThemeEditorSession.kt:72 | PASS：用户/AI 气泡玻璃与图片互斥 |
| 94 | ThemeEditorSession.kt:107 | PASS：reset 保留头像与自定义标题 |
| 95 | ThemeEditorSession.kt:118 | PASS：discard 删暂存、恢复基线 |
| 96 | ThemeEditorSession.kt:125 | PASS：beginSave/markSaved/cancelSave 管理 inFlightSavedValues |
| 97 | ThemeEditorSession.kt:158 | PASS：registerStagedAsset 入 stagedAssetUris |
| 98 | ThemeEditorSession.kt:178 | PASS：仅 file scheme 执行 File.delete |
| 99 | ThemeEditorSession.kt:166 | PASS：addRecentColor 委托 persistentPreferences |
| 100 | ThemeSettingsTabs.kt:31 | PASS：五 tab 枚举 |
| 101 | ThemeSettingsTabs.kt:55 | PASS：isSwitchingTab→yield→scrollTo(0)→渲染顺序 |
| 102 | ThemeSettingsTabs.kt:123 | PASS：保存按钮 isSaving 转圈 |
| 103 | ThemeSettingsTabs.kt:134 | PASS：重置 OutlinedButton |
| 104 | ThemeSettingsTabs.kt:142 | PASS：delay(2000) 后提示消失 |
| 105 | ThemeSettingsBasicTab.kt:76 | PASS：GetContent 仅 ttf/otf/ttc |
| 106 | ThemeSettingsBasicTab.kt:82 | PASS：拷 custom_font 目录、登记暂存 |
| 107 | ThemeSettingsBasicTab.kt:128 | PASS：primary=Magenta、secondary=Blue、header 灰 |
| 108 | ThemeSettingsBasicTab.kt:**254** | PASS（内容），**行号建议优化**：8 分支实际在 271–288 行（pipIcon 在 L285，距 :254 超 31 行）→**建议 ref 改为 :271**（函数名 updateDraftThemeColor 在 ±20 内仍可命中） |
| 109 | ThemeSettingsBasicTab.kt:289 | PASS：when 写值在前、addRecentColor 在后 |
| 110 | ThemeSettingsBackgroundTab.kt:40 | PASS：8 背景偏好项 |
| 111 | ThemeSettingsBackgroundTab.kt:118 | PASS：预览 ExoPlayer 同主播放器缓冲配置（5000/10000/500/1000ms、5MB，与 Theme.kt:263–268 一致，"同样"有依据） |
| 112 | ThemeSettingsBackgroundTab.kt:290 | PASS：JPEG 90 压缩 |
| 113 | ThemeSettingsBackgroundTab.kt:314 | PASS：OpenDocument + checkVideoSize 30MB（FileUtils.kt:404–408 证实单位 MB） |
| 114 | ThemeSettingsBackgroundTab.kt:334 | PASS：拷 background_video、写 MEDIA_TYPE_VIDEO |
| 115 | ThemeSettingsBackgroundTab.kt:164 | PASS：预览播放器 DisposableEffect 释放 |
| 116 | ThemeSettingsChatTab.kt:441 | PASS：bubbleImagePickerLauncher.launch("image/*") |
| 117 | ThemeSettingsChatTab.kt:259 | PASS：非九宫格走裁剪 / .9.png 走 parseNinePatchBubbleParams（isNinePatchPngUri 判 .9.png 后缀，L161–168） |
| 118 | ThemeSettingsChatTab.kt:87 | PASS：isNinePatchMarker alpha<0x80 返 false、RGB<32 |
| 119 | ThemeSettingsChatTab.kt:134 | PASS：缺标记默认 (0.35f to 0.65f) |

### facts[120–149]：29 PASS / 1 COMPOSITE-PASS / 0 FAIL

| # | ref | 结论 |
|---|---|---|
| 120 | ThemeSettingsChatTab.kt:296 | PASS：写 bubble_image_render_mode=BUBBLE_IMAGE_RENDER_MODE_NINE_PATCH |
| 121 | ThemeSettingsChatTab.kt:419 | PASS：fixAspectRatio 1:1 |
| 122 | ThemeSettingsChatTab.kt:57 | PASS：USER/AI/GLOBAL_USER 三枚举 |
| 123 | ThemeSettingsChatTab.kt:377 | PASS：GLOBAL_USER 直接 saveDisplaySettings，不进草稿 |
| 124 | ThemeSettingsChatTab.kt:775 | PASS：when 五分支（用户/AI 气泡、用户/AI 文本、cursor） |
| 125 | ThemeSettingsInputTab.kt:56 | PASS：input_style classic/agent 二选一 |
| 126 | ThemeSettingsInputTab.kt:92 | PASS：chat_input_transparent 与 floating 独立开关 |
| 127 | ThemeSettingsInputTab.kt:179 | PASS：addRecentColor 在 when 前，与 BasicTab 顺序相反 |
| 128 | ThemeSettingsContentEditor.kt:313 | PASS：RegisterRouteBackGuard + suspendCancellableCoroutine 挂起返回 |
| 129 | ThemeSettingsContentEditor.kt:280 | PASS：isSaving 防重入、reset/commit 分支、markSaved |
| 130 | ThemeSettingsContentEditor.kt:219 | PASS：activateTarget targetSwitchesInFlight 门控 |
| 131 | ThemeSettingsContentEditor.kt:377 | PASS：key(draft) + 注释明示 picker 回调绑定旧草稿 |
| 132 | ThemeSettingsContentEditor.kt:430 | PASS：三选对话框三按钮 |
| 133 | GlobalDisplaySettingsScreen.kt:155 | **COMPOSITE-PASS**：delay(300) 防抖（L169）+ 范围 0–10/1–60/50–100（L155–158）→**需拆分** |
| 134 | GlobalDisplaySettingsScreen.kt:180 | PASS：背景图时 surface 纯色否则 50% 透明 |
| 135 | GlobalDisplaySettingsScreen.kt:95 | PASS：三档 ToolCollapseMode 滑杆 |
| 136 | GlobalDisplaySettingsScreen.kt:122 | PASS：读 floating_chat_prefs |
| 137 | GlobalDisplaySettingsScreen.kt:752 | PASS：PNG/JPG FilterChip |
| 138 | GlobalDisplaySettingsScreen.kt:823 | PASS：ROOT 才显示 Root 专区 |
| 139 | GlobalDisplaySettingsScreen.kt:915 | PASS：重置调 resetDisplaySettings + resetRootExecutionSettings |
| 140 | GlobalDisplaySettingsScreen.kt:578 | PASS：refreshBackgroundKeepAlive 联动（注：onCheckedChange 双向均触发，断言"开启后"在开启场景成立） |
| 141 | GlobalDisplaySettingsScreen.kt:631 | PASS：五档 1500/3000/5000/10000/20000 |
| 142 | GlobalDisplaySettingsScreen.kt:525 | PASS：OPERIT/LINGSHU FilterChip |
| 143 | GlobalDisplaySettingsScreen.kt:77 | PASS：keepScreenOnFlow collectAsState(initial=true) |
| 144 | CustomEmojiManagementScreen.kt:**58** | PASS（内容），**行号漂移**：`OpenMultipleDocuments()` 实际在 **63–64** 行→**需修正 ref 为 :64**（正文 md 已用 :64） |
| 145 | CustomEmojiManagementScreen.kt:448 | PASS：GridCells.Fixed(3) |
| 146 | CustomEmojiManagementScreen.kt:220 | PASS：点击预览 / 长按删除确认 |
| 147 | CustomEmojiManagementScreen.kt:413 | PASS：非 BUILTIN_EMOTIONS 标星 |
| 148 | CustomEmojiManagementScreen.kt:530 | PASS：lowercase + ^[a-z0-9_]*$ |
| 149 | CustomEmojiManagementScreen.kt:118 | PASS：顶部卡片 activeTargetName |

## 二、quality.json（8 条）：PASS 8 / FAIL 0 / DUP 0

severity 全在 {high, warn, suggestion} 合法集合内（warn 2 / suggestion 6），confidence 全 high 且与证据强度相称。

| # | severity | file:line | 结论 |
|---|---|---|---|
| 1 | warn | Theme.kt:245 | PASS：evidence 与 remember 五键块逐字一致；DisposableEffect(Unit) 在 :304，键变化重建 player 时旧实例无人释放，泄漏机制成立 |
| 2 | warn | ThemeColorSchemeResolver.kt:71 | PASS：evidence 逐字一致；Theme.kt :522/:561/:603/:625 确有无 Resolved 前缀的孪生实现，两套算法镜像，重复描述成立 |
| 3 | suggestion | AppBackgroundLayer.kt:91 | PASS：evidence 逐字一致；catch 只打日志，Theme.kt:295 同类异常确调用 disableBackgroundForTarget，行为不一致成立 |
| 4 | suggestion | ManagedDragonBonesView.kt:84 | PASS：evidence 逐字一致（while(true)+delay 2–8s+loop=1）；取消语义表述准确，无夸大 |
| 5 | suggestion | GlobalDisplaySettingsScreen.kt:121 | PASS：evidence 逐字一致；:119 注释确写与 FloatingChatService 共用 SharedPreferences；键名硬编码，缺键静默回落 FULLSCREEN_RAINBOW 成立 |
| 6 | suggestion | CustomEmojiManagementScreen.kt:348 | PASS：evidence 逐字一致；:79 Scaffold 无 snackbarHost，Snackbar 内联末尾、无自动消失成立 |
| 7 | suggestion | LiquidGlass.kt:56 | PASS：evidence 逐字一致；WaterGlass 降级 tint/边框/高光参数与 liquidGlass 各不相同，视觉基准不统一成立 |
| 8 | suggestion | ThemeSettingsInterfaceTab.kt:179 | PASS：evidence 逐字一致；InterfaceTab :184 when 前 addRecentColor，BasicTab :289 when 后，顺序相反成立；已声明无功能差异，无夸大 |

## 三、正文 md 检查

- frontmatter 四键（title/module/sources/date）齐全；双受众结构完整（概述/AI 速览/9 节核心机制/15 项关键符号/三链路输入→处理→输出/来源）。
- 正文 99 个 file:line 引用：机械验真全部指向真实文件且行号不越界；抽查的符号锚点（:603/:649/:64）与 facts 修正目标一致，无漂移。
- **来源小节缺一条**：batch-06 惯例（及本任务要求）来源小节需声明机器可读事实数量并与 facts 条数一致（应为 150 条）及走查数量（8 条：警告 2 / 建议 6）。当前来源小节只有 26 文件清单，无此行→**需补**。
- 26 文件行数声明逐个核对源码，全部精确一致。
- 数字断言抽查：8 surface 色（实数 surface/Variant/background/Container×5=8）、缓冲参数、九宫格阈值等均与源码一致。
- 无禁用词（通过/批准/LGTM）命中；facts 内无模糊词。

## 四、lint 独立重跑

`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/critic07-lint`（隔离复制 md）：**0 硬失败 / 0 警告**，exit 0。

## 五、其他机械检查

- facts 150 条，ref 无重复、无越界、无缺失文件；status.json `refs_valid: 150` 与事实数一致。
- 5 个交付文件禁用词扫描：0 命中。
- quality 无重复 (file,line)，无非法 severity。

## 六、需修清单（修错后需独立复验）

**必须修（blocking）：**

1. **拆分 11 条复合断言**（子断言均成立，但必须一事实一断言）：facts[19]（拆 2）、[20]（拆 2）、[25]（拆 2）、[27]（拆 4）、[28]（拆 2）、[31]（拆 2）、[32]（拆 3）、[56]（拆 2）、[79]（拆 2）、[87]（拆 2）、[133]（拆 2）。拆分后 facts 总数变为 150+14=**164** 条，status.json `refs_valid` 与来源小节数量声明须同步更新。
2. **修正 facts.json 行号漂移**（内容正确，锚点错）：
   - [33] `Theme.kt:592` → `:603`（getContrastingTextColor）
   - [34] `Theme.kt:639` → `:649`（isColorLight）
   - [144] `CustomEmojiManagementScreen.kt:58` → `:64`（OpenMultipleDocuments）
3. **正文来源小节补数量声明行**（batch-06 惯例）：`- 机器可读事实：`ui-settings-theme.facts.json`（164 条，引用逐条验真）` / `- 代码走查：`ui-settings-theme.quality.json`（8 条：警告 2 / 建议 6）`（条数按拆分后实际填写）。

**建议修（non-blocking）：**

4. facts[108] ref `:254`→`:271`（when 分支起点；pipIcon 分支 L285 距 :254 超 31 行，:271 则 8 分支全在 ±20 内）。
5. facts[63] ref `:89`→`:97`（六组参数实际在 97–102 行）。
6. facts[87] 拆分后建议两条分别锚定 :384（错误提示）与 :347（输入框标红）。

## 七、最终 verdict

**FAIL** —— 需按§六修错后进入独立复验。

理由：150 条事实 0 捏造、8 条走查全部实锤、lint 0/0，内容质量高；但 11 条复合断言违反"复合断言必须拆分"的硬性要求，且 3 处 facts.json 锚点行号漂移、来源小节缺数量声明行，均属必须修正项。修正后（164 条 facts）需独立复验锚点与数量一致性，再走 build→deploy→公网验证。
