### 如何打包 Web 应用

先说结论：

- **想在聊天工作区里直接点“导出”打包：请选 `工作区 > 创建默认 > Web 项目`。**
- 该模板默认开启导出入口（`export.enabled=true`）。
- 其他默认模板不会直接显示导出按钮。
- 如果你绑定的是 `附加本地储存仓库`（SAF），聊天工作区里也不会显示导出按钮。

#### 方式一：聊天工作区直接导出（推荐）

1. 在当前对话绑定工作区，优先使用 `创建默认 > Web 项目`。
2. 确保网站入口文件为工作区根目录下的 `index.html`。
3. 打开工作区右下角悬浮菜单，点击 `导出`。
4. 选择导出平台（Android / Windows）。
5. 按界面填写应用信息（包名、应用名、版本、图标等）并开始导出。
6. 导出完成后可直接打开文件，产物默认保存到 `Download/Operit/exports/`。

![进入打包](/manuals/assets/teach_step/1-1.png)
![开始打包](/manuals/assets/teach_step/1-2.png)
![设置信息](/manuals/assets/teach_step/1-3.jpg)
![下载分享](/manuals/assets/teach_step/1-4.jpg)

#### 方式二：工具箱 HTML 打包（适合任意文件夹 / SAF）

如果你当前是 SAF 工作区，或网页不在聊天工作区中，建议用工具箱里的 HTML 打包功能：

1. 在 HTML 打包页面先点 `选择文件夹`。
2. 在第二步下拉框选择“主 HTML 文件”（可不是 `index.html`）。
3. 点击 `生成安装包`，再选 Android 或 Windows。

> 该流程会在临时目录里自动把你选中的主 HTML 文件重命名为 `index.html` 后再打包，因此更适合“已有项目直接选目录”场景。

#### 常见问题

- **为什么看不到导出按钮？**
  - 当前工作区不是 Web 模板，或 `.operit/config.json` 里 `export.enabled=false`。
  - 当前绑定的是 SAF 仓库工作区（`repo:` 环境）。
- **旧项目也能直接导出吗？**
  - 可以，前提是该工作区是普通路径绑定（非 SAF）且 `export.enabled=true`。
- **详细工作区配置在哪看？**
  - 见《[工作区概述](/guide/development/workspace-overview)》。
