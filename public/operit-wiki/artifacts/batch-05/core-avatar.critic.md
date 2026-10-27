# Critic 复核报告：core-avatar（虚拟形象引擎）

- 复核对象：`review/batch-05/core-avatar.{md,facts,quality,lint,status}.json/md`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致，v1.12.2）
- 复核方式：113 条 facts 全量机械校验（ref 格式 / 文件在 commit 中存在 / 行号在界 / 反引号符号落 ±5 窗口 / 无重复锚点 / 复合事实筛查）+ 25+ 条人工逐条核源码原文（含全部数字断言）；quality 7 条 evidence 逐字原文校验；正文 47 处 `path:line` 引用全量验存在性；禁用词全文 grep；lint.py 独立隔离重跑；MMD 维护状态专项核验

## 结论：通过

**facts：113/113 通过。quality：7/7 通过。** 硬问题 0，轻微建议 2 条（不阻塞）。

## facts 核验（113 条）

- **引用真实性**：113/113 ref 文件在钉死 commit 中存在，行号全部在界，无越界、无重复锚点。
- **±5 窗口支撑**：113 条中断言的反引号符号全部落在 ref 行 ±5 窗口内，脚本 0 未命中；人工抽查 25+ 条语义支撑全部成立。
- **原子性**：脚本筛查疑似复合事实（≥2 句）0 条。
- **数字断言人工核验**（全部逐条 sed 对照源码）：
  - [1] 6 种形象路线 —— `AvatarType.kt:9` 枚举 6 项 ✓
  - [12] 7 种情绪 —— `AvatarEmotion.kt:9` 7 项 ✓
  - [13][14] angry promptHint "用户表达侮辱、不公、责备、生气或强烈不满时使用"、fallbackEmotion=SAD —— `:22-:23` ✓
  - [29] `playAnimation(loop: Int = 1)`，文档 "Use 0 for infinite looping" —— `:45` ✓
  - [48][49][50] 文件名别名映射（idle/default/normal/standby→IDLE；listening/talking/speak/speaking/chat→LISTENING；sad/cry/crying/angry/mad→SAD）—— `:356-:360` 逐字一致 ✓
  - [58][59] scale 钳 0.1–5.0（`coerceIn(0.1f, 5.0f)`）、translateX 钳 ±2000 —— `:110`/`:122` ✓
  - [78][79] `MmdNative.nativeReadMotionMaxFrame`、按 30fps 换算（`(maxFrame / 30f) * 1000f`）—— `:81`/`:86` ✓
  - [80][81] MMD 相机距离 0.02–12.0、目标高度 -2.0–2.0 —— `:142`/`:147` ✓
  - [93][94][95][96] metallicFactor 归 0、roughness 下限 0.82、强制 KHR_materials_unlit、提亮 1.22 倍上限 1.6 —— `:713`/`:716`/`:723`/`:767` ✓
  - [98][99] 灯光写死三点光源、skybox=null、主光源 175000（日志 "key=(0.00,-0.22,-0.98,175000), fill=(...52000), rim=(...16000), ibl=16000"）—— `:1239`/`:1243` ✓
  - [104][105] FBX pitch ±89°、yaw ±180° —— `:156`/`:161` ✓
  - [107][108] FbxRenderer 顶部 `@Suppress("DEPRECATION")`、`:90` `setOnRenderErrorListener` ✓
  - [61] DragonBonesRenderer 桥接 `ManagedDragonBonesView` —— `:38` ✓
  - [67][68][69][70] WebP：API 28+ ImageDecoder 解码、REPEAT_INFINITE、Animatable2.AnimationCallback、API 28 以下首帧静态 —— `:85`/`:99`/`:110`/`:118` ✓
  - [72][73][74] MP4：`volume = 0f`、`playWhenReady = true`、REPEAT_MODE_ONE/OFF —— `:56`/`:57`/`:80` ✓
  - [109][110][111][112][113] 调用方：ConversationService.kt:84、AvatarPreviewSection.kt:119、FloatingFullscreenScreen.kt:271/293/309 ✓

## quality 核验（7 条）

7 条 evidence 全部在源码逐字命中（去缩进差异后），severity 分级合理：

1. warn（high 置信）`AvatarRendererFactoryImpl.kt:35` — 6 处 `onError = { }` 空回调吞渲染错误。证据逐字真实；warn 合理（排障影响，无数据丢失/安全后果）。
2. warn（high 置信）`AvatarModelFactoryImpl.kt:360` — angry/mad 别名映射到 SAD，语义错误。证据逐字真实；warn 合理。
3. warn（high 置信）`MmdAvatarController.kt:106` — `playAnimation` 连续两次 `_state.copy` 发射中间态。源码 `:106-:113` 确为先清 (null, false) 再设新动画；warn 合理。
4. suggestion（high 置信）`WebPAvatarModel.kt:57` — shouldLoop/repeatCount 硬编码架空接口语义。证据真实；suggestion 合理。
5. suggestion（medium 置信）`GltfSurfaceView.kt:1344` — 反射注入 Manipulator，Filament 升级即失效（有 runCatching 兜底）。证据真实；suggestion 合理。
6. suggestion（medium 置信）`GltfSurfaceView.kt:624` — `gltf_prepared/<hash>` 工作区无清理逻辑。证据真实；suggestion 合理。
7. suggestion（high 置信）`Mp4Renderer.kt:67` — ExoPlayer release 空 catch 吞异常。证据真实；suggestion 合理。

高危 0，与 writer 自报一致。

## 正文 md 核验

- 结构齐全：概述 / ## AI 速览 / 核心机制（6 节）/ 关键符号（20 项）/ 调用链（三段式编号）/ 来源。
- 47 处 `path:line` 引用全部真实存在、行号在界（writer 自称 46 处，实测 47，属计数口径差，不影响准确性）。
- 符号名均为英文原名；与 facts 无矛盾断言（抽查 12 处数字/枚举断言全对）。
- **禁用词**：5 个交付文件全文 grep "通过/批准/LGTM" 0 命中；模糊词（可能/大概/似乎/应该/也许）在 md/facts/quality 中 0 处。
- quality 走查发现未写入正文 ✓。

## MMD 维护状态专项核验（writer 未标注"停止维护"）

writer 论断：头像 MMD 渲染（MikuMikuDance）与 llm-local 端侧推理的停维 mmd 是两回事，不应标注停止维护。**独立核验确认成立**：

1. `core/avatar/impl/mmd/` 三文件完整（control/model/view），MmdRenderer.kt 131 行完整实现，无任何 `@Deprecated`/停止维护标记（全目录 grep 0 命中）。
2. `MmdAvatarController` 实际调用 `MmdNative.nativeReadMotionMaxFrame`（:81/:93），是现役代码路径。
3. `avator/mmd/` native 模块完整（CMakeLists.txt、build.gradle.kts、Saba Viewer 资源），**最近提交 2026-08-01**（"feat: 整理运行时模块并扩展 MCP 支持"），与 writer 声称一致。
4. llm/ 下此 commit 仅有 `llama`、`mnn` 两个目录，**无 mmd 目录**；停维的是端侧推理引擎集合，与头像 MMD 渲染无关。

结论：不标注"停止维护"正确。正文"MMD 渲染代码现存且完整可用，未见弃用标记"属实。

## status.json / lint 核验

- `issue: 73`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，全部正确。
- `refs_valid` 填写 "113/113 引用行号真实存在…lint 硬失败 0/警告 0" —— 与本轮独立复核结果一致。
- `critic` 字段为空，待 parent 填写。
- lint.py 独立隔离重跑：**0 硬失败 / 0 警告**（与 .lint.md 一致）。

## 轻微建议（不阻塞，可修可不修）

1. quality 第 3/4/7 条 evidence 存的是字面 `\n` 转义序列而非真实换行（与 batch-05 data-prefs-model Q13 同类格式问题）；内容逐字一致、断言成立，不影响准确性。
2. 正文"来源"小节称 core/avatar 共 35 个 Kotlin 文件、5150 行 —— 已用 `git ls-tree` + 逐文件 `wc -l` 独立复算：**35 文件 / 5150 行，精确一致** ✓。

## 最终结论

**通过**。113 条 facts 引用全部真实、断言与源码逐条吻合；7 条走查证据逐字真实、分级合理；MMD 未停维论断经独立核验成立；lint 0/0；无禁用词。本页已达上评审站标准。
