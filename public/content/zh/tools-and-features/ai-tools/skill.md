# Skill

## 从用户角度理解 Skill

在 Operit 里，Skill 可以理解为“本地能力包”。你在聊天里看到的能力，底层可能来自三种来源：内置脚本、MCP、Skill。

对用户来说不需要区分太细，只需要在 `包管理 > Skills` 里管理即可。

每个 Skill 都是手机里的一个文件夹，默认路径是：

`/sdcard/Download/Operit/skills/`

只要该文件夹包含 `SKILL.md`（`skill.md` 也可识别），就会被应用识别成一个 Skill。

## 快速上手（3 步）

1. 打开 `包管理 > Skills`
2. 用 `+` 导入（仓库或 ZIP），或点商店图标进入 Skill 市场安装
3. 在列表里把 Skill 右侧开关打开（允许 AI 使用），然后直接在聊天中描述需求

## 在界面里怎么导入 Skill

### 方式 1：从 Skill 市场安装（推荐）

- 在 Skills 页面点击右下角商店按钮，进入 `Skill 市场`
- 可以搜索、刷新，也支持下拉加载更多
- 每个 Skill 卡片右侧圆形按钮状态含义：
  - 下载图标：可安装
  - 转圈：安装中
  - 勾号：已安装

### 方式 2：从 GitHub 仓库导入

- Skills 页面点 `+`，切到 `仓库`
- 输入 GitHub 链接后点击 `导入`
- 支持常见仓库地址形式：
  - 仓库根地址（自动识别默认分支）
  - `tree/...` 子目录地址
  - `blob/.../SKILL.md` 地址
  - `raw.githubusercontent.com` 地址
- 应用会自动下载仓库 ZIP 并尝试定位 `SKILL.md`

### 方式 3：从 ZIP 导入

- Skills 页面点 `+`，切到 `ZIP`
- 选择 `.zip` 文件并导入
- ZIP 内必须能找到 `SKILL.md`（允许在子目录）
- 如果同名 Skill 已存在，会提示重名并拒绝导入

## 本地管理（你会在界面看到什么）

- 顶部会显示当前 Skills 目录路径，并支持 `刷新`
- 列表按名称展示 Skill，点击条目可查看 `SKILL.md` 内容
- 在详情弹窗可直接 `删除`
- 每个条目右侧有“可见性开关”：
  - 开启：AI 可调用该 Skill（默认开启）
  - 关闭：Skill 保留在本地，但 AI 不会使用

## `SKILL.md` 写法建议（面向展示）

Operit 会优先读取 Skill 里的 `name` 和 `description` 作为列表展示信息。建议在 `SKILL.md` 中写前置元数据。

```md
---
name: weather_helper
description: 提供天气查询与出行建议
---

# Weather Helper
...
```

如果没有 frontmatter，也可以在文件前部使用 `name:` / `description:` 行提供信息。

格式上可参考 Anthropic Skill 规范。

## 发布与“管理我的 Skill”

在 Skill 市场里登录 GitHub 后，你可以：

- 发布新的 Skill
- 管理已发布 Skill（编辑、下架）

注意：从市场“移除 Skill”通常是关闭对应发布 Issue，不会删除你的代码仓库。

## 常见问题排查

- 提示“未找到任何 Skill”：检查是否放在 `/sdcard/Download/Operit/skills/`，并确认文件夹内有 `SKILL.md`
- 提示“仅支持 .zip 文件”：确认导入文件扩展名
- 提示“zip 内未找到 SKILL.md”：检查压缩包结构
- 提示“无效的 GitHub URL”：检查仓库地址格式
- 导入成功但聊天里用不到：确认该 Skill 右侧开关已打开
