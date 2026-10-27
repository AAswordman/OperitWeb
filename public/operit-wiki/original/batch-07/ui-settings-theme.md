---
title: 主题与显示设置
module: UI 设置
sources: Theme.kt, Color.kt, Type.kt, ThemeUtils.kt, ThemePreferenceLocals.kt, TextLayoutSettings.kt, ThemeColorSchemeResolver.kt, LiquidGlass.kt, WaterGlass.kt, AppBackgroundLayer.kt, CustomScaffold.kt, ErrorDialog.kt, ManagedDragonBonesView.kt, ThemeSettingsScreen.kt, LanguageSettingsScreen.kt, LayoutAdjustmentSettingsScreen.kt, GlobalDisplaySettingsScreen.kt, CustomEmojiManagementScreen.kt, ThemeSettingsBasicTab.kt, ThemeSettingsBackgroundTab.kt, ThemeSettingsChatTab.kt, ThemeSettingsInputTab.kt, ThemeSettingsInterfaceTab.kt, ThemeSettingsTabs.kt, ThemeEditorSession.kt, ThemeSettingsContentEditor.kt, ColorPickerDialog.kt, ThemeSettingsComponents.kt, ThemeSettingsBackgroundSection.kt, ThemeSettingsColorSection.kt, ThemeSettingsCoreSections.kt, ThemeSettingsFontAvatarSections.kt, CustomEmojiViewModel.kt
date: 2026-10-01
---

## 概述

本页覆盖 Operit 的"外观"全家桶：根主题如何组装配色/字体/背景、主题设置屏的五个 tab（基础/背景/聊天/输入/界面）如何编辑草稿并保存、全局显示设置、语言切换、布局微调、自定义表情管理，以及液态玻璃/水玻璃两种特效和三个通用 UI 组件。

一句话定位：**主题是按"角色卡/群组"分别存档的**——每个聊天对象可以有自己独立的一套配色、背景、气泡样式，`OperitTheme` 在每次重组时读取当前激活对象的主题快照并应用到全应用。

## AI 速览

- 核心符号：`OperitTheme`（根主题）、`ThemeEditorSession`（主题草稿会话）、`ThemeSettingsContent`（编辑器容器）、`rememberActiveThemePreferenceSnapshot()`（主题快照）、`resolveThemeColorScheme`（配色解析）、`liquidGlass` / `waterGlass`（两种玻璃特效）、`AppBackgroundLayer`（独立背景层）、`createCustomTypography`（自定义字体）、`disableBackgroundForTarget`（背景加载失败熔断）。
- 主入口：`ThemeSettingsScreen()` 直接转发 `ThemeSettingsContent()`；`OperitTheme(content)` 包裹全应用 UI。
- 数据流向一句话：`ActivePromptManager` 的 `activeThemePreferenceSnapshotFlow` → `OperitTheme` 读快照算出 `ColorScheme`/`Typography`/背景 → `CompositionLocalProvider` 下发给全树；设置屏侧是 `ThemeEditorSession` 攒草稿 → `commitThemeDraft` 写回 `ActivePromptManager`。

## 核心机制

### 1. 根主题：配色流水线（Theme.kt，658 行）

- `OperitTheme` 是全应用的根主题 composable，`activePrompt` 初始为默认角色卡 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:94` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:99`
- 暗色判定：跟随系统用 `isSystemInDarkTheme()`，否则 `themeMode == THEME_MODE_DARK` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:148`
- 动态取色仅 Android 12+（`Build.VERSION_CODES.S`）`app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:157`
- 设了主色就用 `generateDarkColorScheme` 整套生成自定义配色 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:177`
- 次色为空时沿用 `colorScheme.secondary` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:174`
- 有背景图时 8 个 surface 系颜色全部 `copy(alpha = 1f)` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:490`
- 对比文字色 `getContrastingTextColor` 用 WCAG 亮度公式（0.299/0.587/0.114），阈值 0.5 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:603`
- `isColorLight` 即亮度大于 0.5 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:649`
- `SideEffect` 内恒设沉浸式 `WindowCompat.setDecorFitsSystemWindows(window, false)` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:190`
- `statusBarHidden` 时隐藏状态栏，上滑呼出（`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`）`app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:197`
- 状态栏颜色优先级：`statusBarTransparent` → 有背景图 → `useCustomStatusBarColor` → 主色 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:207`
- 状态栏图标深浅 `isAppearanceLightStatusBars = !isColorLight(...)` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:217`
- 有背景图时导航栏透明，Q+ 关闭 `isNavigationBarContrastEnforced` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:222`
- `createCustomTypography` 被 `remember` 缓存，键为五个字体值 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:137`
- 背景加载失败熔断：`disableBackgroundForTarget` 在协程里把 `use_background_image` 写回 false `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:103`

### 2. 字体与排版（Type.kt / TextLayoutSettings.kt / ThemeUtils.kt）

- `getSystemFontFamily` 把四种系统字体名映射到 Compose 的 `FontFamily` `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:44`
- `loadCustomFontFamily` 对 file:// 路径用 `Uri.parse().toFile()` 解析 `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:57`
- 没开自定义字体且 `fontScale == 1.0f` 时直接返回默认 `Typography` `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:146`
- `withScale` 把字号和行高乘缩放系数 `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:161`
- `ProvideAiMarkdownTextLayoutSettings` 从 `UserPreferencesManager` 读三个 flow 下发排版设置 `app/src/main/java/com/ai/assistance/operit/ui/theme/TextLayoutSettings.kt:30`
- 排版默认值：`AiMarkdownTextLayoutSettings` 行高 1f / 字间距 0f / 段间距 12f `app/src/main/java/com/ai/assistance/operit/ui/theme/TextLayoutSettings.kt:18`
- `getTextColorForBackground` 亮度大于 0.5 返回黑否则返回白 `app/src/main/java/com/ai/assistance/operit/ui/theme/ThemeUtils.kt:8`

### 3. 液态玻璃与水玻璃（LiquidGlass.kt / WaterGlass.kt）

两种磨砂玻璃特效（人话：iOS 风格的毛玻璃质感），都要求 Android 13+：`LiquidGlassMinApi` 为 TIRAMISU `app/src/main/java/com/ai/assistance/operit/ui/theme/LiquidGlass.kt:27`。

- `enabled` 为 false 时直接返回 this，零开销 `app/src/main/java/com/ai/assistance/operit/ui/theme/LiquidGlass.kt:43`
- 主路径 `drawBackdrop` 叠加 vibrancy + blur + `lens`（折射高 12.dp、折射量 18.dp、色差开启）`app/src/main/java/com/ai/assistance/operit/ui/theme/LiquidGlass.kt:101`
- 边缘 `Highlight` 宽=边框宽、模糊=2.4 倍、亮色 alpha 0.62 `app/src/main/java/com/ai/assistance/operit/ui/theme/LiquidGlass.kt:107`
- waterGlass 走 `liquid(liquidState)`，六组参数亮/暗各一套 `app/src/main/java/com/ai/assistance/operit/ui/theme/WaterGlass.kt:89`
- 运行态由 OperitTheme 下发：`LocalThemePreferenceSnapshot`、`LocalLiquidGlassBackdrop`、`LocalWaterGlassState` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:341`
- 另有一套 `resolveThemeColorScheme`，用 `configuration.uiMode` 判暗色，供非 Compose 上下文用 `app/src/main/java/com/ai/assistance/operit/ui/theme/ThemeColorSchemeResolver.kt:28`

### 4. 背景层：图片与视频（Theme.kt / AppBackgroundLayer.kt）

- 视频背景 `remember` 键为 useBackgroundImage 等五个值 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:244`
- `DefaultLoadControl` 缓冲 5000/10000/500/1000 ms、目标 5MB `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:258`
- 循环按设置取 `REPEAT_MODE_ALL` / `REPEAT_MODE_OFF` `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:272`
- `DisposableEffect` 释放时做 stop / clearMediaItems / release 三连 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:305`
- 图片用 `rememberAsyncImagePainter`，自带纯色 error fallback `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:376`
- `LaunchedEffect(painter)` 检测图片加载出错并熔断 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:385`
- 视频不透明度用 `ColorDrawable` 前景模拟 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:448`
- `AppBackgroundLayer` 是同一套背景逻辑的独立可复用版本 `app/src/main/java/com/ai/assistance/operit/ui/theme/AppBackgroundLayer.kt:36`

### 5. 主题编辑器：草稿会话与防丢拦截（ThemeEditorSession.kt / ThemeSettingsContentEditor.kt）

- `ThemeEditorSession` 是 internal 草稿会话，改动先攒内存，点保存才写回 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeEditorSession.kt:12`
- `setBoolean` 自带互斥：开液态玻璃自动关水玻璃 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeEditorSession.kt:55`
- 气泡开玻璃特效时互斥并关 `bubble_user_use_image`（图片和玻璃不叠加）`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeEditorSession.kt:72`
- `reset()` 回默认值但保留 AI 头像和自定义聊天标题 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeEditorSession.kt:107`
- `deleteStagedAssets` 只删 file scheme 的暂存 URI `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeEditorSession.kt:178`
- `RegisterRouteBackGuard` 拦截返回手势 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt:313`
- `suspendCancellableCoroutine` 把返回挂起，等用户在未保存对话框里做决定 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt:321`
- `saveCurrentDraft` 先检查 `isSaving` 防重入 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt:280`
- 按是否重置走 `resetThemeDraft` 或 `commitThemeDraft` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt:292`
- tab 内容用 `key(draft)` 包裹，外部 picker 回调绑定创建时的草稿 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt:377`

### 6. 五个设置 tab

- `ThemeSettingsTab` 枚举：BASIC / BACKGROUND / CHAT / INPUT / INTERFACE `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsTabs.kt:31`
- 切 tab 先显示 `LinearProgressIndicator` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsTabs.kt:83`
- 再 `yield()` 让出主线程、`scrollTo(0)` 回顶后渲染 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsTabs.kt:58`
- 保存成功提示 `delay(2000)` 后自动消失 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsTabs.kt:142`
- 字体选择器 `GetContent()` 只收 ttf/otf/ttc `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBasicTab.kt:76`
- 字体拷进内部 `custom_font` 目录并登记暂存 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBasicTab.kt:82`
- `updateDraftThemeColor` 按 8 种取色模式写对应键 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBasicTab.kt:254`
- 背景媒体选择用 `OpenDocument`（保留 per-URI 授权）`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBackgroundTab.kt:315`
- 视频经 `checkVideoSize` 卡 30MB 上限 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBackgroundTab.kt:321`
- 视频拷进内部 `background_video` 并置视频类型 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBackgroundTab.kt:334`
- 背景 tab 预览播放器用 `DisposableEffect` 释放 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsBackgroundTab.kt:164`
- 九宫格判定 `isNinePatchMarker`：alpha≥0x80 且 RGB<32 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsChatTab.kt:87`
- 九宫格气泡写 `bubble_image_render_mode=BUBBLE_IMAGE_RENDER_MODE_NINE_PATCH` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsChatTab.kt:296`
- 头像裁剪固定 1:1（`fixAspectRatio`）`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsChatTab.kt:419`
- 全局用户头像不进草稿，直接 `saveDisplaySettings` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsChatTab.kt:381`
- `input_style` 经 `ChatStyleOption` 二选一 classic / agent `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsInputTab.kt:56`
- `chat_input_transparent` 与 floating 为独立开关 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsInputTab.kt:92`

### 7. 全局显示设置（GlobalDisplaySettingsScreen.kt，1093 行）

- 滑杆值变更 `delay(300)` 防抖后批量保存 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/GlobalDisplaySettingsScreen.kt:169`
- 钳制范围：访问等待 0–10、hook 超时 1–60、质量与缩放 50–100 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/GlobalDisplaySettingsScreen.kt:155`
- `componentBackgroundColor`：有背景图用纯色 surface，否则 50% 透明 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/GlobalDisplaySettingsScreen.kt:180`
- 自动化状态指示样式读写 `floating_chat_prefs`（与悬浮窗服务共用）`app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/GlobalDisplaySettingsScreen.kt:122`
- Root 专区只在 `AndroidPermissionLevel.ROOT` 时出现 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/GlobalDisplaySettingsScreen.kt:823`
- 重置按钮同时调 `resetDisplaySettings()` 与 `resetRootExecutionSettings()` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/GlobalDisplaySettingsScreen.kt:915`

### 8. 语言、布局微调、自定义表情

- 语言切换调用 `setAppLanguage` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/LanguageSettingsScreen.kt:111`
- `delay(600)` 确保落盘后整应用重启换语言 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/LanguageSettingsScreen.kt:122`
- 重启带 `FLAG_ACTIVITY_NEW_TASK` 清空任务栈 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/LanguageSettingsScreen.kt:126`
- 布局微调 5 个浮点项：`chatSettingsButtonEndPadding` 等，默认值 2f/16f/1f/0f/12f `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/LayoutAdjustmentSettingsScreen.kt:70`
- 非法值标红并提示 `invalid_value_range` `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/LayoutAdjustmentSettingsScreen.kt:384`
- 表情添加用 `OpenMultipleDocuments` 多选图片 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/CustomEmojiManagementScreen.kt:64`
- 表情网格 `GridCells.Fixed(3)` 三列 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/CustomEmojiManagementScreen.kt:448`
- 非内置分组标星：`BUILTIN_EMOTIONS` 之外显示 Star `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/CustomEmojiManagementScreen.kt:413`
- 新建分组名 `lowercase()` 且只许字母数字下划线 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/CustomEmojiManagementScreen.kt:530`

### 9. 通用组件

- CustomScaffold 把 `contentWindowInsets` 置零，避免系统栏边距重复 `app/src/main/java/com/ai/assistance/operit/ui/components/CustomScaffold.kt:35`
- ErrorDialog 错误原文 `SelectionContainer` 完整展示，限高 350.dp `app/src/main/java/com/ai/assistance/operit/ui/components/ErrorDialog.kt:53`
- ManagedDragonBonesView 待机动画名 `IDLE_ANIMATION_NAME` 为 "idle" `app/src/main/java/com/ai/assistance/operit/ui/components/ManagedDragonBonesView.kt:22`
- 随机小动作每 2–8 秒（`delay`）播一次 `app/src/main/java/com/ai/assistance/operit/ui/components/ManagedDragonBonesView.kt:85`

## 主题设置组件补遗

七个零覆盖文件的说明（"是什么/为什么/怎么用"）：

- **ColorPickerDialog.kt（637 行）**：主题设置里所有"选颜色"入口共用的 HSV 取色对话框。为什么用它：主题可调的颜色有 13 处（主色/次色/状态栏/顶栏/抽屉背景/强调色/历史图标/画中画图标/cursor 用户气泡/气泡用户色/气泡 AI 色/用户文字色/AI 文字色），一个对话框靠 `currentColorPickerMode` 字符串区分当前改哪一个。对话框内容：skydoves 的 `HsvColorPicker` + 亮度条 + 透明度条、实时预览（示例文字+对比度评级）、HEX/RGB/HSV 三组手动输入（HEX 有剪贴板粘贴按钮）、最近使用颜色两行各 7 个、14 色 Material 推荐色。点确定后按 mode 把 ARGB 填入 `onColorSelected` 回调对应位置、其余位置传 null。注意 `remember(currentColor)` 重建控制器的写法是修复"换取色项后初始颜色错误"的定案方案。
- **ThemeSettingsComponents.kt（152 行）**：四个纯展示小组件，专供主题设置页复用：`ThemeModeOption`（可点击卡片，选中=半透明 primary 底色+2.dp primary 描边+文字加粗变色）、`MediaTypeOption`（同款样式，上方加 24.dp 图标，供背景图片/视频切换用）、`ColorSelectionItem`（48.dp 圆形色板+标题，禁用时整体 0.38f 透明）、`PresetColorItem`（32.dp 预设色点，1.dp 白描边）。
- **ThemeSettingsBackgroundSection.kt（556 行）**：背景 tab 的"自定义背景"卡片。是什么：开关开启后可切换图片/视频两种媒体类型、选文件、调透明度、开模糊。怎么用：图片用 coil 预览、右上角 Crop 按钮重新裁剪；视频用 `AndroidView` 嵌 `StyledPlayerView`（`RESIZE_MODE_ZOOM` 铺满、无控制器），预览罩一层按透明度算出的黑/白 `ColorDrawable` 模拟效果，右上角有静音/循环按钮（切循环弹 Toast）。透明度 Slider 范围 0.1f..1f，模糊半径 1f..30f；两个 Slider 都用 `pendingOpacity`/`pendingBlurRadius` 缓存模式——`onValueChange` 只缓存不写草稿，`onValueChangeFinished` 才持久化，避免点按同帧重组未生效导致写入旧值。
- **ThemeSettingsColorSection.kt（761 行）**：`ThemeSettingsColorContentMode`（`PALETTE`/`INTERFACE`）让同一个 composable 在配色/界面两个 tab 共用。界面侧：状态栏（隐藏/透明/自定义色三开关互锁：透明或隐藏时自定义色开关禁用置灰）、顶栏透明/自定义色、导航抽屉水玻璃+按钮液态玻璃+背景/强调色、聊天头透明（打开后才出现覆盖模式子开关）、顶栏内容色强制浅/暗、聊天头历史/PiP 图标色。配色侧：开启自定义配色时用 `editorSession.update` 一次性写主色+次色；`on_color_mode` 三档（自动/浅/暗）；底部有两个 Surface 按钮实时预览主/次色+对比文字色。
- **ThemeSettingsCoreSections.kt（2466 行）**：基础 tab 的三个 section + 私有编辑器。`ThemeSettingsThemeModeSection`：跟随系统开关，关闭后才出现浅/暗选项。`ThemeSettingsChatStyleSection`：聊天风格（cursor/bubble）与输入框风格（经典/Agent）独立切换；cursor 下有"用户气泡跟随主题"（关了才出现颜色选择器）+液态/水玻璃开关；bubble 下有显示头像/宽布局/用户&AI 各自的液态/水玻璃/圆角/颜色/文字色/字体/图片背景。气泡图片背景是九宫格玩法：`BubbleImageStyleEditor` 给裁剪四边（0..0.45）、重复区起止、缩放（0.2..3）、左右内边距（0..32dp）一堆滑杆，`BubbleImageStyleConfig` 攒参数，`NineSliceSourcePreviewCard` 用 Canvas 画缩略图并叠红色裁剪框+九宫格线；`ChatStylePreviewCard` 按当前全部设置渲染一条用户消息+一条 AI 消息的实时预览（宽布局 280.dp/普通 240.dp）。`BubbleFontStyleEditor`：系统字体 5 选 1 或选 TTF 文件（只显示文件名）。`ThemeSettingsDisplayOptionsSection`：12 个"显示什么"的开关（思考过程/模型供应商/模型名/角色名/用户名/token 统计/速度/耗时/时间戳/状态标签/输入处理状态/悬浮圆点动画）。`ThemeSettingsSectionTitle` 是全页通用的"图标+加粗标题+分隔线"小标题。
- **ThemeSettingsFontAvatarSections.kt（470 行）**：字体与头像两个 section。字体：自定义字体开关→系统字体（5 选 1）或字体文件（选/清除），字号缩放 Slider 0.8f..1.5f（steps=6）。头像：本角色用户头像（重置=主题草稿 `custom_user_avatar_uri` 写 null）与全局用户头像（重置=走 `DisplayPreferencesManager.saveDisplaySettings` 写全局，不走草稿）并排；全局用户名输入框为空时尾部是清空按钮、非空时是保存按钮；头像形状圆形/方形二选一，选方形时 `AnimatedVisibility` 展开圆角步进器（±1，0..16f）。
- **CustomEmojiViewModel.kt（247 行）**：自定义表情管理屏的 ViewModel。为什么按目标隔离：表情是"每个角色卡/群组"分别存档的，所以 `activePrompt` 用 `WhileSubscribed(5000)` 共享当前目标，`categories` 在目标变化时先 `initializeBuiltinEmojis` 再取全部分类，`emojisInCategory` 用 `combine(activePrompt, selectedCategory)` 订阅当前分类。`addEmojis` 逐个入库并统计成功/失败数（部分成功提示 `emoji_added_partial`）；`createCategory` 先校验命名合法性与重名；`resetToDefault` 恢复默认。注意 `isCustomCategory()` 无条件返回 true 且全仓库无调用，是未实现的残留桩。

## 关键符号

- `OperitTheme` —— 根主题 composable `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:94`
- `disableBackgroundForTarget` —— 背景加载失败时关闭该目标背景图 `app/src/main/java/com/ai/assistance/operit/ui/theme/Theme.kt:103`
- `rememberActiveThemePreferenceSnapshot()` —— 收集当前激活对象的主题快照 `app/src/main/java/com/ai/assistance/operit/ui/theme/ThemePreferenceLocals.kt:20`
- `LocalThemePreferenceSnapshot` —— 快照的 CompositionLocal，未提供抛错 `app/src/main/java/com/ai/assistance/operit/ui/theme/ThemePreferenceLocals.kt:14`
- `createCustomTypography` —— 字体+缩放生成 Typography `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:137`
- `getSystemFontFamily` —— 系统字体名映射 `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:44`
- `loadCustomFontFamily` —— 文件字体加载 `app/src/main/java/com/ai/assistance/operit/ui/theme/Type.kt:57`
- `resolveThemeColorScheme` —— 非 Compose 上下文的配色解析 `app/src/main/java/com/ai/assistance/operit/ui/theme/ThemeColorSchemeResolver.kt:28`
- `liquidGlass` —— 液态玻璃 Modifier `app/src/main/java/com/ai/assistance/operit/ui/theme/LiquidGlass.kt:32`
- `waterGlass` —— 水玻璃 Modifier `app/src/main/java/com/ai/assistance/operit/ui/theme/WaterGlass.kt:27`
- `AppBackgroundLayer` —— 独立背景层 `app/src/main/java/com/ai/assistance/operit/ui/theme/AppBackgroundLayer.kt:36`
- `ThemeEditorSession` —— 主题草稿会话 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeEditorSession.kt:12`
- `ThemeSettingsContent` —— 编辑器容器 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt:95`
- `ThemeSettingsTab` —— 五 tab 枚举 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/theme/ThemeSettingsTabs.kt:31`
- `ThemeSettingsScreen` —— 转发入口 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ThemeSettingsScreen.kt:7`
- `ColorPickerDialog` —— HSV 取色对话框（13 色共用） `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ColorPickerDialog.kt:98`
- `ThemeModeOption` —— 可点击选中卡片 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ThemeSettingsComponents.kt:32`
- `MediaTypeOption` —— 带图标的可点击选中卡片 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ThemeSettingsComponents.kt:66`
- `ColorSelectionItem` —— 圆形色板+标题 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ThemeSettingsComponents.kt:109`
- `PresetColorItem` —— 预设色点 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ThemeSettingsComponents.kt:145`
- `ThemeSettingsBackgroundSection` —— 背景图片/视频/透明度/模糊设置卡 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsBackgroundSection.kt:70`
- `ThemeSettingsColorCustomizationSection` —— 配色/界面颜色设置（PALETTE/INTERFACE 双模式） `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsColorSection.kt:34`
- `ThemeSettingsThemeModeSection` —— 跟随系统/浅/暗 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsCoreSections.kt:69`
- `ThemeSettingsChatStyleSection` —— 聊天风格+气泡九宫格编辑+实时预览 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsCoreSections.kt:154`
- `ThemeSettingsDisplayOptionsSection` —— 12 个显示开关 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsCoreSections.kt:2118`
- `ThemeSettingsFontSection` —— 字体与字号设置 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsFontAvatarSections.kt:46`
- `ThemeSettingsAvatarSection` —— 本角色/全局头像与全局用户名 `app/src/main/java/com/ai/assistance/operit/ui/features/settings/sections/ThemeSettingsFontAvatarSections.kt:258`
- `CustomEmojiViewModel` —— 自定义表情管理 ViewModel `app/src/main/java/com/ai/assistance/operit/ui/features/settings/viewmodels/CustomEmojiViewModel.kt:34`

## 输入→处理→输出调用链

**链路 A：主题应用（每次重组）**

1. 输入：`ActivePromptManager.activePromptFlow`（当前聊天对象）+ `activeThemePreferenceSnapshotFlow`（该对象的主题快照）。
2. 处理：`OperitTheme` 按"暗色判定→动态取色→自定义色→背景图修正"流水线算出 `ColorScheme`，`createCustomTypography` 算出 `Typography`，按需建 ExoPlayer。
3. 输出：`MaterialTheme(colorScheme, typography)` 包裹全树 + 三个 `CompositionLocal` 下发 + 系统栏颜色/显隐。

**链路 B：主题编辑保存**

1. 输入：用户在五个 tab 改开关/颜色/图片 → `ThemeEditorSession.setBoolean/setInt/update` 写内存草稿（含互斥逻辑）。
2. 处理：点保存 → `saveCurrentDraft` 防重入 → `ActivePromptManager.commitThemeDraft(target, values)`（或 `resetThemeDraft`）写持久化 → `markSaved`。
3. 输出：`activeThemePreferenceSnapshotFlow` 发出新快照 → 链路 A 重组，全应用换肤；切目标/返回时有未保存草稿则弹三选对话框拦截。

**链路 C：背景媒体设置**

1. 输入：背景 tab 点选图片/视频 → `OpenDocument` 拿 URI。
2. 处理：图片走裁剪（JPEG 90）→ 拷内部存储 → 登记暂存 → 写 `background_image_uri`；视频卡 30MB → 拷 `background_video` → 写 `MEDIA_TYPE_VIDEO`。
3. 输出：保存后 `OperitTheme` 的 painter/ExoPlayer 加载新背景；加载失败触发 `disableBackgroundForTarget` 熔断。

## 来源

- ui/theme/Theme.kt（658 行）：根主题、配色流水线、系统栏、视频背景
- ui/theme/Color.kt（11 行）：基础色值
- ui/theme/Type.kt（185 行）：字体解析与排印
- ui/theme/ThemeUtils.kt（26 行）：背景文字色工具
- ui/theme/ThemePreferenceLocals.kt（32 行）：主题快照 CompositionLocal
- ui/theme/TextLayoutSettings.kt（48 行）：AI 文本排版设置
- ui/theme/ThemeColorSchemeResolver.kt（179 行）：非 Compose 配色解析
- ui/theme/LiquidGlass.kt（127 行）：液态玻璃特效
- ui/theme/WaterGlass.kt（105 行）：水玻璃特效
- ui/theme/AppBackgroundLayer.kt（189 行）：独立背景层
- ui/components/CustomScaffold.kt（37 行）：Scaffold 封装
- ui/components/ErrorDialog.kt（83 行）：错误弹窗
- ui/components/ManagedDragonBonesView.kt（136 行）：骨骼动画封装
- ui/features/settings/screens/ThemeSettingsScreen.kt（9 行）：主题设置入口
- ui/features/settings/screens/LanguageSettingsScreen.kt（205 行）：语言设置
- ui/features/settings/screens/LayoutAdjustmentSettingsScreen.kt（407 行）：布局微调
- ui/features/settings/screens/GlobalDisplaySettingsScreen.kt（1093 行）：全局显示设置
- ui/features/settings/screens/CustomEmojiManagementScreen.kt（559 行）：自定义表情管理
- ui/features/settings/screens/theme/ThemeSettingsBasicTab.kt（292 行）：基础 tab
- ui/features/settings/screens/theme/ThemeSettingsBackgroundTab.kt（373 行）：背景 tab
- ui/features/settings/screens/theme/ThemeSettingsChatTab.kt（804 行）：聊天 tab（含九宫格气泡）
- ui/features/settings/screens/theme/ThemeSettingsInputTab.kt（144 行）：输入 tab
- ui/features/settings/screens/theme/ThemeSettingsInterfaceTab.kt（203 行）：界面 tab
- ui/features/settings/screens/theme/ThemeSettingsTabs.kt（155 行）：tab 容器与保存栏
- ui/features/settings/screens/theme/ThemeEditorSession.kt（191 行）：草稿会话
- ui/features/settings/screens/theme/ThemeSettingsContentEditor.kt（644 行）：编辑器容器
- ui/features/settings/components/ColorPickerDialog.kt（637 行）：HSV 取色对话框
- ui/features/settings/components/ThemeSettingsComponents.kt（152 行）：主题设置小组件
- ui/features/settings/sections/ThemeSettingsBackgroundSection.kt（556 行）：背景设置卡
- ui/features/settings/sections/ThemeSettingsColorSection.kt（761 行）：配色/界面颜色设置
- ui/features/settings/sections/ThemeSettingsCoreSections.kt（2466 行）：主题模式/聊天风格/显示选项
- ui/features/settings/sections/ThemeSettingsFontAvatarSections.kt（470 行）：字体与头像设置
- ui/features/settings/viewmodels/CustomEmojiViewModel.kt（247 行）：自定义表情 ViewModel

- 机器可读事实：`ui-settings-theme.facts.json`（234 条，引用逐条验真）
- 代码走查：`ui-settings-theme.quality.json`（10 条：警告 2 / 建议 8）
