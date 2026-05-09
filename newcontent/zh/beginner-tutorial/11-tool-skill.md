# 11. 工具：SKILL

前面两章我们讲了沙盒包和MCP，这一章来说说最轻量的一种工具形式——Skill。

Skill 本质上就是一份**带格式的文档**，里面写清楚了 AI 该怎么做一件事。不需要单独进程，不需要装依赖，不消耗额外资源。你可以把它理解为给 AI 的一份"操作说明书"——告诉它在遇到某种需求的时候，按照什么步骤来执行。

它是三种工具形式里面最轻量的那一个。沙盒包跑在 QuickJS 引擎里，MCP 需要单独起进程，而 Skill 只是一份 Markdown 文件。如果你需要的功能比较简单，或者只是一个固定的操作流程，用 Skill 是最合适的。

在 AI 看来，Skill 和沙盒包、MCP 一样，都是用 `use_package` 去激活，然后用 `package_proxy` 去调用。它并不知道也不关心背后跑的是脚本还是一个文档。

## Skill简介

按照我们前面的理论，ai需要知道每个包的简介才知道去激活哪个。那么 Skill 的简介从哪里来？

很简单，Skill 的简介就写在它自己里面。每个 Skill 文件夹里的 `SKILL.md` 文件，最前面有一段叫 frontmatter 的元数据，里面就写着 `name` 和 `description`。应用在识别到这个 Skill 的时候，就会把这些信息提取出来，作为它在包管理列表里的展示内容。AI 看到这些信息就知道这个 Skill 是干什么的了。

## 安装 Skill

打开「包管理」，切到 Skills 那一栏，你会看到几个导入方式。

![Skill列表与导入界面](</manuals/assets/tools/skill_list_import.jpg>)

### 从 Skill 市场安装

这是最推荐的方式。点右下角的商店按钮，就会进入 Skill 市场。里面有很多别人分享的 Skill，可以直接搜索、浏览。每个 Skill 卡片右边有个圆形按钮——下载图标表示可以安装，转圈表示正在安装，勾号表示已经装好了。点一下下载就能装到本地。

### 从仓库导入

如果你在 GitHub 上看到了某个 Skill 的仓库，也可以用这种方式。点加号，切到「仓库」页面，把 GitHub 链接贴进去，点导入就行。应用会自动下载仓库并找到里面的 `SKILL.md`。支持的地址格式比较灵活：仓库根地址、子目录地址、甚至直接指向 `SKILL.md` 的地址都可以。

### 从 ZIP 导入

如果你已经有一个本地的 Skill 压缩包，点加号切到 ZIP，选文件导入就行。ZIP 包里面必须能找到 `SKILL.md` 文件，可以放在子目录里。如果有重名的 Skill 已经存在，会提示你并拒绝导入。

## 管理 Skill

Skill 装好之后，在列表里就能看到。每个条目右边有一个可见性开关——打开就是允许 AI 使用，关掉就是保留在本地但 AI 不会调用。点条目可以查看 `SKILL.md` 的内容，在详情弹窗里也能直接删除。详情弹窗里分为几个标签页——「简介」展示你写的 `name` 和 `description`，「内容」展示 `SKILL.md` 正文，「附件」可以管理 Skill 附带的资源文件。

![Skill详情弹窗](</manuals/assets/tools/skill_detail.jpg>)

Skill 的存放路径在 `/sdcard/Download/Operit/skills/` 目录下，每个 Skill 就是一个文件夹，里面放着 `SKILL.md`。应用识别 Skill 的依据就是这个文件——有 `SKILL.md`（或者 `skill.md`）就算一个 Skill。

当 AI 激活这个 Skill 的时候，整个文件夹里的文件结构和内容都会被展示给 AI，不仅仅是 `SKILL.md`。所以如果你需要附带一些参考文件、模板或者配置，可以放在 Skill 文件夹的子目录下，AI 激活时也能看到。

## 怎么写 SKILL.md

如果你想自己写一个 Skill，格式很简单。应用会优先读取文件头部的元数据来获取名称和描述，所以建议在最前面这样写：

```markdown
---
name: weather_helper
description: 提供天气查询与出行建议
---

# Weather Helper

当你需要查询天气的时候，请按照以下步骤操作...
```

这个 `---` 包起来的部分就是 frontmatter，里面写上 `name` 和 `description`，应用就会用这些信息在列表里展示，AI 也能通过它们识别这个 Skill 的用途。如果不写 frontmatter，应用也会尝试从文件的前面几行里找 `name:` 和 `description:` 这样的标记。

正文部分就是给 AI 看的操作说明。格式可以参考 Anthropic 的 Skill 规范，简单来说就是告诉 AI：在什么情况下激活这个 Skill、需要什么信息、按什么步骤执行、输出什么结果。
