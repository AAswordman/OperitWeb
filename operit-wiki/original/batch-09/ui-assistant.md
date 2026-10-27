---
title: 助手配置界面
module: UI / 助手配置
sources: 7
date: 2026-10-01
issue: 116
---

# ui-assistant（助手配置界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/`（7 个 Kotlin 文件、约 3,118 行）@ `dbf71916`

> 覆盖助手（虚拟形象）配置屏：模型切换/重命名/删除/导入、缩放位移与分类型相机参数滑杆、情绪触发—动画映射、自定义情绪类型、实时预览，以及语音唤醒（唤醒词/常听/个人声纹模板/问候语/关键词附件）配置。

## 概述

助手配置界面是 Operit 里给"助手"（屏幕上的虚拟形象）做个性化配置的地方，分两个 Tab：

- **头像配置**：换模型、重命名、删除、从文件导入新模型；拖滑杆调大小和位置；按模型类型（MMD/GLTF/FBX）调相机参数；给情绪（开心、生气、害羞……）绑定播放哪个动画；自己添加自定义情绪类型。
- **语音唤醒**：设置唤醒词、"一直听"开关、录三段自己的声音做声纹模板（个人唤醒模式）、唤醒后的问候语、唤醒是否建新会话，以及语音时自动携带的上下文附件（截屏 OCR、通知、位置、时间）。

两个 Tab 共用一个 `AssistantConfigViewModel`：头像配置走 `AvatarRepository` 持久化，语音配置走 `WakeWordPreferences` 的 Flow；界面顶部有一块 220.dp 高的实时预览区，改任何参数立刻能在模型上看到效果。从主界面侧边栏进入，见 [[ui-main|主界面与导航骨架]]。

## AI 速览

- **核心符号清单**：AssistantConfigScreen、AssistantConfigViewModel、UiState、AvatarConfigSection、AvatarPreviewSection、AvatarView、ModelSelector、MoodTriggerMappingSection、MoodMappingCard、AnimationSelectionField、MoodTypeEditorDialog、HowToImportSection、AllAvatarImportGuideSection、CompactSwitchRow、VoiceAutoAttachGrid、SettingItem、PersonalWakeEnrollment、WakeWordPreferences。
- **主入口**：AssistantConfigScreen() → TabRow（头像配置 / 语音唤醒）→ AvatarConfigSection / 语音唤醒表单。
- **数据流向一句话**：用户操作 → AssistantConfigViewModel → AvatarRepository（头像）或 WakeWordPreferences（语音）持久化 → UiState/Flow 回流 → Compose 重组；预览区把映射与设置实时推给 AvatarController。

## 核心机制

### 1. 双 Tab 结构

`AssistantConfigScreen` 是配置屏的入口 Composable（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:45`）。

页面顶部是 `TabRow`，两个 Tab 分别为头像配置与语音唤醒（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:200`）。

当前 Tab 与预览折叠状态用 `rememberSaveable` 保存，旋转屏幕不丢失（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:98`）。

头像预览区固定高度 220.dp，旁边有折叠按钮可收起（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:221`）。

### 2. ViewModel 与 UiState

`AssistantConfigViewModel` 构造注入 `AvatarRepository` 与 `Context`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:30`）。

`init` 中 `combine` 合并四路 Flow：`repository.configs`、`currentAvatar`、`instanceSettings`、`settings`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:54`）。

无已选模型时取默认 `AvatarInstanceSettings`；DragonBones 新模型首次选中默认缩放 0.5f（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:65`）。

当前配置按 `currentAvatar.id` 在 `configs` 中查找（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:69`）。

情绪动画映射取自 `currentConfig.getEmotionAnimationMapping()`，为空时取空 Map（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:70`）。

### 3. 模型管理：切换 / 重命名 / 删除 / 导入

模型下拉选中时调用 `viewModel.switchAvatar`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:164`）。

每条模型尾部带重命名与删除图标，删除走 `viewModel.deleteAvatar`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:168`）。

删除前弹出 `confirm_delete_model_title` 确认框（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:984`）。

重命名弹窗标题为 `rename_avatar_model_title`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:1006`）。

`deleteAvatar` 先置 `isLoading=true` 再调 `repository.deleteAvatar`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:293`）。

导入走系统文件选择器 `ACTION_OPEN_DOCUMENT`，经 `EXTRA_MIME_TYPES` 限定类型（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:143`）。

可选类型含 zip、fbx、gltf-binary、gltf+json、mp4、octet-stream（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:149`）。

选择返回 OK 后调用 `viewModel.importAvatarFromZip`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:135`）。

导入中全屏遮罩显示 `importing_model` 文案（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:709`）。

### 4. 实时预览

`sharedAvatarController` 由 `AvatarControllerFactoryImpl` 为当前模型创建控制器（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:53`）。

情绪映射变化时调用 `avatarController.updateEmotionAnimationMapping` 推送（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:74`）。

映射变化时自动 `setEmotion` 预览被改动的情绪（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:85`）。

实际渲染用 `AvatarView`，渲染错误记 `AppLogger.e`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:119`）。

当前模型无可用控制器时显示 `unsupported_model_type` 提示（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:136`）。

### 5. 缩放 / 位移 / 相机参数

缩放滑杆范围 0.1f..2.0f，拖动调 `viewModel.updateScale`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:205`）。

X/Y 位移滑杆范围均为 -500f..500f（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:216`）。

MMD 类型额外显示 4 组相机滑杆，首组键为 `AvatarSettingKeys.MMD_INITIAL_ROTATION_X`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:232`）。

MMD 相机俯仰范围 -90f..90f（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:257`）。

GLTF 相机俯仰默认 8f（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:323`）。

FBX 相机俯仰默认 8f（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:414`）。

FBX 相机距离范围 0.02f..12.0f（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:479`）。

### 6. 情绪触发映射与自定义情绪

情绪触发映射区遍历 `AvatarMoodTypes.builtInDefinitions` 渲染内置情绪卡片（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:595`）。

`MoodMappingCard` 为每个情绪提供动画选择、预览与清除映射按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:668`）。

`AnimationSelectionField` 是只读下拉，选项来自模型的可用动画列表（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:795`）。

可用动画列表每 300ms 从 `avatarController.availableAnimations` 轮询刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:136`）。

预览先尝试 `playTrigger`，未处理则播映射动画（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:1141`）。

预览结束后按估算时长延时，再把情绪切回 `IDLE`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:1152`）。

自定义情绪新增/编辑弹窗的 `canConfirm` 要求 key 与 promptHint 均非空（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:860`）。

ViewModel 层校验 promptHint 必填，否则报 `avatar_custom_type_prompt_hint_required`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:217`）。

重命名自定义情绪时旧 key 的动画映射迁移到新 key（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:256`）。

无自定义情绪时显示 `avatar_custom_type_none` 提示（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:634`）。

### 7. 语音唤醒配置

唤醒配置全部订阅 `WakeWordPreferences` 的 Flow（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:57`）。

识别模式默认 `STT`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:60`）。

开启"一直听"前先检查 `RECORD_AUDIO` 权限，未授予则发起权限请求（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:389`）。

唤醒词为空时回退为 `DEFAULT_WAKE_PHRASE`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:418`）。

无操作超时输入只保留数字，并用 `coerceIn` 限制到 1..600 秒（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:456`）。

问候语文本为空时回退为 `DEFAULT_WAKE_GREETING_TEXT`（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:495`）。

个人声纹模式用 `PersonalWakeEnrollment.recordOneTemplate` 录制每段模板（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:639`）。

三段模板全部录完且不在录音中（`canSave`）才能保存（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:663`）。

三段录音保存为 `PersonalWakeTemplate(features)` 列表（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:671`）。

### 8. 语音关键词附件

`VoiceAutoAttachGrid` 按附件类型渲染可点击的附件卡片（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt:83`）。

附件类型共 4 种：`SCREEN_OCR`、NOTIFICATIONS、LOCATION、TIME（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt:382`）。

已用类型从 `VoiceAutoAttachType.entries` 中排除，不再出现在添加列表（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt:92`）。

新建条目 id 取 `item_` 加毫秒时间戳（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt:360`）。

附件网格变更经 `saveVoiceAutoAttachItems` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:576`）。

### 9. 导入教程

`HowToImportSection` 是可折叠的模型导入教程区（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/HowToImportSection.kt:38`）。

教程区提供 loongbones 在线编辑器链接（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/HowToImportSection.kt:39`）。

DragonBones 注意事项用 `errorContainer` 底色高亮（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/HowToImportSection.kt:129`）。

## 关键符号

- `AssistantConfigScreen` —— 配置屏入口 Composable（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:45`）
- `AssistantConfigViewModel` —— 屏幕 ViewModel，头像配置的唯一写入出口（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:30`）
- `AssistantConfigViewModel.UiState` —— 界面状态：模型列表/当前模型/实例设置/映射/自定义情绪/加载态（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt:33`）
- `AvatarConfigSection` —— 头像配置区：开关/映射/模型选择/滑杆/教程（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:59`）
- `AvatarPreviewSection` —— 实时预览区，把映射与设置推给控制器（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:30`）
- `ModelSelector` —— 模型下拉选择器，支持切换/重命名/删除（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:968`）
- `MoodTriggerMappingSection` —— 情绪触发映射区（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:514`）
- `MoodMappingCard` —— 单情绪映射卡片：选择/预览/清除（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:668`）
- `AnimationSelectionField` —— 动画只读下拉（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:795`）
- `MoodTypeEditorDialog` —— 自定义情绪新增/编辑弹窗（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:846`）
- `HowToImportSection` —— 模型导入教程区（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/HowToImportSection.kt:38`）
- `AllAvatarImportGuideSection` —— 导入结构指南折叠区（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt:931`）
- `AvatarView` —— 模型渲染视图（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:119`）
- `CompactSwitchRow` —— 标题+描述+开关的紧凑设置行（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt:52`）
- `VoiceAutoAttachGrid` —— 语音关键词附件网格（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt:83`）
- `SettingItem` —— 图标+标题+值+箭头的通用设置行（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/SettingItem.kt:38`）
- `PersonalWakeEnrollment.recordOneTemplate` —— 录制一段声纹模板（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:639`）
- `WakeWordPreferences` —— 语音唤醒偏好存储（`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt:57`）

## 调用链

1. 打开配置屏：输入——路由进入助手配置页 → 处理——`AssistantConfigScreen` 组合，ViewModel `init` 用 `combine` 合并四路 Flow 生成 `UiState` → 输出——双 Tab 界面与实时预览渲染。
2. 切换模型：输入——`ModelSelector` 选中 → 处理——`viewModel.switchAvatar` → `repository.switchAvatar` → `currentAvatar` Flow 更新 → 输出——预览区与配置区重组，DragonBones 新模型默认缩放 0.5f。
3. 拖动缩放滑杆：输入——滑杆值变化 → 处理——`updateScale` 做 `copy(scale)` → `repository.updateAvatarSettings` 持久化 → 输出——`AvatarPreviewSection` 经 `updateSettings` 推送控制器，预览即时变化。
4. 绑定情绪动画：输入——`MoodMappingCard` 选择动画 → 处理——`updateMoodAnimationMapping` 规范化 key 后持久化 → 输出——预览区 `updateTriggerAnimationMapping`；点预览经 `previewMoodTrigger` 播放后切回 IDLE。
5. 导入模型：输入——点导入按钮 → 处理——`openZipFilePicker` 打开系统文件选择 → 结果 OK 调 `importAvatarFromZip` → `repository.importAvatarFromUri` → 输出——成功/失败 Snackbar，全程 `isImporting` 遮罩。
6. 配置语音唤醒：输入——改开关/输入框 → 处理——`wakePrefs.saveXxx` 写入偏好 → 输出——Flow 回流，界面即时反映；开"一直听"前先过 `RECORD_AUDIO` 权限。
7. 录制个人声纹：输入——打开配置弹窗 → 处理——3 次 `PersonalWakeEnrollment.recordOneTemplate` 录制 → 三段齐且不在录音中方可保存为 `PersonalWakeTemplate` 列表 → 输出——`savePersonalWakeTemplates` 持久化。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/screens/AssistantConfigScreen.kt`（718 行）：双 Tab 入口、语音唤醒表单、文件选择器、声纹录制弹窗
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/viewmodel/AssistantConfigViewModel.kt`（393 行）：UiState、模型增删改查、映射与自定义情绪校验
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarConfigSection.kt`（1,155 行）：模型选择器、情绪映射卡片、滑杆参数、自定义情绪弹窗
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt`（159 行）：实时预览、映射/设置推送
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/HowToImportSection.kt`（163 行）：导入教程、编辑器外链
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/VoiceAutoAttachComponents.kt`（416 行）：开关行、语音关键词附件网格
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/SettingItem.kt`（114 行）：通用设置行组件
