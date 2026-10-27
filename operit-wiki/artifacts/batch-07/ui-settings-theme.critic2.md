# Critic2 复验报告：ui-settings-theme（Issue #98）

复验人：第二名独立 critic（未沿用 critic1 结论，164 条 facts 全部实地拉源码窗口重核）
源码：~/workspace/Operit @ dbf71916（钉死）
复验日期：2026-10-01

## 最终 verdict：FAIL（仅锚点精度问题，无事实捏造）

## 一、机械项（全部通过）

- facts 164 条 = status.json refs_valid 164 = 正文来源小节"164 条" ✓
- quality 8 条（warn 2 / suggestion 6），severity 仅 warn/suggestion ✓
- facts 顶层数组、每条键仅 {fact, ref} ✓
- 164 个 file:line 锚点全部解析到真实文件/行，无越界、无坏格式 ✓
- lint 独立重跑（/tmp 隔离）：0 硬失败 / 0 警告 ✓
- "通过/批准/LGTM"：md/facts/quality 全文 0 命中 ✓
- 正文来源小节：`ui-settings-theme.facts.json`（164 条）/ `ui-settings-theme.quality.json`（8 条：警告 2 / 建议 6）✓
- quality 8 条 evidence：程序化逐字比对，8/8 与源码逐字一致（含缩进）✓
- 无多句复合事实残留（164 条均无多 "。" / "；"）✓
- critic1 要求的 11 条复合拆分已正确执行：拆分后每条单断言、锚点对位（如 [87]→:384/:347、[133]→:169/:155）✓
- [33] :592→:603（getContrastingTextColor）、[34] :639→:649（isColorLight）、[144] :58→:64 修正已落实 ✓

## 二、必须修的锚点漂移（10 处，结论为真、窗口够不到）

口径：file:line ±5 窗口必须完整支撑断言的每个符号/数字/行为。

| # | 现 ref | 问题 | 建议 ref |
|---|---|---|---|
| [15] | Theme.kt:244 | 断言列举 5 个 remember 键（248–252 行），窗口 239–249 只含前 2 个 | :248 |
| [17] | Theme.kt:258 | 断言列举 5000/10000/500/1000 + 5MB（263–267 行），窗口 253–263 只含 5000 | :263 |
| [36] | Theme.kt:437 | 断言 ColorDrawable + argb((1f - backgroundImageOpacity) * 255) 前景（448–455 行），窗口 432–442 只有 inflate | :448 |
| [43] | Theme.kt:603 | 断言 WCAG 公式 0.299/0.587/0.114 + 阈值 0.5（615–620 行），窗口 598–608 只有函数签名（critic1 修错时锚到函数头，公式在函数体内） | :615 |
| [57] | ThemePreferenceLocals.kt:20 | 断言初始快照三值 source/sourceId/values（26–28 行），窗口 15–25 只有函数头 | :26 |
| [66] | LiquidGlass.kt:77 | 断言"阴影 elevation 至少 10.dp"，依据在 55 行（`fallbackShadow = shadowElevation.coerceAtLeast(10.dp)`）/ 71 行（`elevation = fallbackShadow`），窗口 72–82 只有 border/background | :55 |
| [70] | LiquidGlass.kt:107 | 断言 width/blurRadius=edgeWidth*2.4f/alpha 0.62/0.50（111–114 行），窗口 102–112 只含 width | :110 |
| [94] | LanguageSettingsScreen.kt:111 | 断言"延迟 600ms + FLAG_ACTIVITY_NEW_TASK \| FLAG_ACTIVITY_CLEAR_TASK 重启"（123–128 行），窗口 106–116 只有 setAppLanguage | :123 |
| [119] | ThemeSettingsBasicTab.kt:82 | 断言 custom_font_path + font_type=FONT_TYPE_FILE 写入（89–93 行），窗口 77–87 不含 | :88 |
| [136] | ThemeSettingsChatTab.kt:377 | 断言"直接写 displayPreferencesManager.saveDisplaySettings"（383–385 行实测为真），窗口 372–382 不含该调用 | :383 |

以上 10 条事实内容经实地核对全部为真，无一捏造；仅锚点需按建议行号修正（修错时仍须实地核对，不可照抄）。

## 三、建议优化（非阻塞）

- [106] ThemeEditorSession.kt:72：用户侧互斥在窗口内，AI 侧（84–92 行）同模式在窗口外；建议锚点 :80 以覆盖两侧。
- [127] ThemeSettingsBackgroundTab.kt:334：`background_media_type=MEDIA_TYPE_VIDEO` 在 340 行，窗口 329–339 差一行；建议 :340。
- [88] ManagedDragonBonesView.kt:85：窗口内为 `layer = RANDOM_ANIMATION_LAYER`，数值 10 定义在 31 行常量；当前可接受，如求严格可把 10 的依据注记到 fact 或锚点兼顾。
- [15][17] 的修正（:248/:263）已列入上表必修。

## 四、抽查通过项（结论+锚点均实锤）

[18] repeatMode :272、[19] volume :279、[20] playWhenReady :280、[21]–[23] 日志/熔断/释放、[25] 三 CompositionLocal :341、[26] waterGlassState :340、[27][28] Box/liquefiable :353/:355、[30]–[33] 图片错误链、[34] isColorLight :649（公式在窗口内）、[38]–[42] 深浅配色、[47] Typography（`16.sp` 即 16sp）、[61][62] 私有实现（类体内锚点可接受）、[67][68] 降级路径、[71] tint、[79] coerceIn、[83] 剪贴板、[86][87] 动画名、[89] loop=0/layer=BASE（:73 窗口 68–78 含 77 行）、[99][100] 非法输入、[110][111] 暂存资源、[115] 保存按钮、[117] delay(2000)、[122] BasicTab 顺序、[129] image/*、[140] InterfaceTab 顺序、[146] delay(300)、[157] keepScreenOnFlow——以上窗口与断言逐一对位，无问题。

## 五、复验结论

- 事实正确性：164/164 为真，0 捏造、0 虚假断言。
- 锚点精度：154/164 的 ±5 窗口完整支撑断言；10 处需按上表修正。
- quality：8/8 实锤，evidence 逐字。
- 机械项：lint 0/0、计数一致、无禁用词。

**verdict: FAIL** —— 修完§二 10 处锚点后可翻 PASS（均为机械移锚，无需第三轮全文复验，建议抽查§二即可）。本人未改动任何交付文件。
