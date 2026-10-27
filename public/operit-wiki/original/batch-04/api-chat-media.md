---
title: 多模态媒体链接与能力探测
module: app
sources: 3
date: 2026-10-01
---

# 多模态媒体链接与能力探测

## 概述

- 本页覆盖 `api/chat/llmprovider/` 下的 3 个文件：聊天消息里图片/音频/视频/文件链接的生成与解析，以及模型多模态能力的闭式探测。
- 一句话：聊天正文里的媒体用 `<link type="image" id="...">` 这种 XML 式标签引用，`MediaLinkBuilder` 负责生成标签、`MediaLinkParser` 负责从消息里抠出标签并到图池/媒体池取数据；`MediaCapabilityProbe` 用“图里藏短码、让模型只回短码”的闭式测试探测模型是否真能看图/听音频/看视频。
- 闭式探测（closed-form probe）指答案唯一的测试：期望输出是一个固定短码，对上即通过，不用人工判分。

## AI 速览

- **核心符号**：`MediaLinkBuilder`（链接生成）、`MediaLinkParser`（链接解析）、`MediaLink` / `ImageLink` / `MediaLinkTag`（解析结果）、`MediaCapabilityProbe`（多模态能力探测）、`matchesImage` / `matchesAudio` / `matchesVideo`（探测判定）。
- **主入口**：生成 `MediaLinkBuilder.image/audio/video/file(context, id)`；解析 `MediaLinkParser.extractImageLinks(message)` / `extractMediaLinks(message)`；探测 `MediaCapabilityProbe.matchesImage(response)` 等。
- **数据流向一句话**：`MediaLinkBuilder` 按 id 生成 `<link>` 标签嵌入消息 → 发送前 `MediaLinkParser` 用正则抠出标签 → 按 type:id 去重并从 `ImagePoolManager` / `MediaPoolManager` 取 base64 → 发给模型；探测时给模型看藏码媒体，`matches*` 比对回复与期望码。

## 核心机制

### 链接生成（MediaLinkBuilder）

- `image/audio/video(context, id)` 用 `R.string.conversation_media_*_link` 字符串模板按 id 生成链接。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkBuilder.kt:7`
- `file(context, id, fileName)` 把 id 和 XML 转义后的文件名填入 `conversation_media_file_link` 模板。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkBuilder.kt:19`
- `escapeXmlAttribute` 转义 `&` `<` `>` `"` `'` 五个字符（文件名进 XML 属性前必须转义）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkBuilder.kt:27`

### 链接解析（MediaLinkParser）

- `MediaLink(type,id,base64Data,mimeType,fileName?=null)`：完整媒体数据。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:7`
- `ImageLink(type,id,base64Data,mimeType)`：图片专用，无 fileName。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:15`
- `MediaLinkTag(type,id,fileName?=null)`：轻量标签，不带 base64。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:22`
- `LINK_PATTERN` 匹配整个 `<link>` 块：type 限 image|audio|video|file，属性顺序任意，`DOT_MATCHES_ALL + IGNORE_CASE`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:30`
- `isMediaType` 指 audio|video|file（不含 image，图片走单独通道）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:35`
- `extractImageLinks`：跳过 `id=="error"`，按 id 去重，经 `ImagePoolManager.getImage(id)` 取图，取不到跳过。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:70`
- `extractImageLinkIds`：同样匹配去重，但不查图池只返回 id 列表。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:89`
- `removeImageLinks` 删除 image 链接。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:101`
- `replaceImageLinks` 把 `"error"` 换成空串、其余调 `replacer(id)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:106`
- `hasImageLinks` 判定是否存在 image 链接。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:116`
- `extractMediaLinks`：按 `type:id` 去重；file 类型无 fileName 则跳过；经 `MediaPoolManager.getMedia(id)` 取数，再过 `MediaBase64Limiter.limitBase64ForAi` 限大小。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:118`
- `extractMediaLinkTags`：同样匹配去重，只产出不带 base64 的 `MediaLinkTag`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:145`
- `replaceMediaLinks`：`"error"` 换空串，非媒体类型原样保留。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:163`
- `removeMediaLinks` 删除媒体链接。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:176`
- `hasMediaLinks` 判定是否存在媒体链接。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:181`
- `extractFileName` 用 `FILE_NAME_ATTRIBUTE_PATTERN` 提取 filename 属性并反转义，空白则为 null。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:58`
- `unescapeXml` 按 `&lt;` `&gt;` `&quot;` `&apos;` 最后 `&amp;` 的顺序反转义（`&amp;` 必须最后，避免二次转义）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:184`

### 能力探测（MediaCapabilityProbe）

- 用途：模型配置/函数配置测试用的闭式媒体探测；期望码放在测试资源里，不在 prompt 里，聊天分析 prompt 不受影响。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:3`
- 探测资源：`test/1.jpg`、`test/1.mp3`、`test/1.mp4`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:10`
- 期望码：`IMAGE_CODE="7K2Q"`、`AUDIO_CODE="375"`、`VIDEO_CODE="M4XP"`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:14`
- 三类探测 prompt 都要求模型只回复短码、不描述媒体。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:18`
- `matchesImage` / `matchesVideo`：`alnumUpper(response)` 等于期望码即通过。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:39`
- `matchesAudio`：直接匹配，或经 `extractStrictDigitWords` 把“three seven five”这类数字英文词转成数字后再匹配。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:43`
- `alnumUpper`：只保留字母数字并转大写（容忍模型多输出的标点空格）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:50`
- `extractStrictDigitWords`：严格扫描；数字直接收录；数字英文单词需字母边界匹配；遇到无法匹配的字母返回 null（整段作废）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:60`

## 关键符号

| 符号 | 职责 |
|---|---|
| `MediaLinkBuilder` | 按 id 生成 `<link>` 媒体标签 |
| `MediaLinkParser` | 从消息正文解析媒体标签 |
| `MediaLink` / `ImageLink` / `MediaLinkTag` | 解析结果：带 base64 / 图片专用 / 轻量标签 |
| `MediaCapabilityProbe` | 图/音/视频闭式能力探测 |
| `matchesImage` / `matchesAudio` / `matchesVideo` | 探测回复与期望码比对 |
| `ImagePoolManager` / `MediaPoolManager` | 按 id 取媒体数据的池 |
| `MediaBase64Limiter` | 发给 AI 前限制 base64 大小 |

## 调用链

1. **输入**：聊天消息正文含 `MediaLinkBuilder.image(context, id)` 生成的 `<link type="image" id="...">` 标签。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkBuilder.kt:7`
2. **处理**：发送前 `MediaLinkParser.extractImageLinks(message)` 用 `LINK_PATTERN` 抠标签 → 跳过 `"error"`、按 id 去重 → `ImagePoolManager` 取 base64（音频/视频/文件走 `extractMediaLinks`，经 `MediaBase64Limiter` 限大小）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt:70`
3. **输出**：`ImageLink` / `MediaLink`（带 base64Data + mimeType）发给模型；能力探测时另起一路：给模型看藏码媒体，`MediaCapabilityProbe.matchesImage(response)` 比对短码判定模型是否真具备多模态能力。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt:39`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaCapabilityProbe.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkBuilder.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MediaLinkParser.kt`
