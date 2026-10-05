# Operit Web（Operit AI 官网 / 文档站）

该仓库是 **Operit AI** 的 Web 站点（官网 + 使用文档）。

- **技术栈**：React + TypeScript + Vite + Ant Design
- **路由模式**：HashRouter（URL 形如 `/#/v1/guide/...`）
- **文档来源**：`public/content/{zh,en}` 下的 Markdown
- **在线站点**：`https://operit.aaswordsman.org`

## 环境要求

- Node.js `>= 20`（CI 使用 Node 20）
- 推荐使用 `pnpm`（仓库包含 `pnpm-lock.yaml`，GitHub Actions 也使用 pnpm）

## 快速开始

```bash
pnpm install
pnpm dev
```

启动后访问：

- 首页：`http://localhost:5173/`
- 教程版本选择：`http://localhost:5173/#/guide`
- 下载版本选择：`http://localhost:5173/#/download`

## 常用脚本

- `pnpm dev`
  - 启动本地开发服务器
- `pnpm build`
  - TypeScript 构建 + Vite 打包，产物在 `dist/`
- `pnpm preview`
  - 预览本地构建产物
- `pnpm lint`
  - 运行 ESLint
- `pnpm export-pdf`
  - 通过 Puppeteer 将文档页面导出 PDF（见下方说明）

## 文档编写

### 产品代际与共享路由

| 区域 | Operit 1 | Operit 2 |
| --- | --- | --- |
| 产品介绍 | `/#/v1` | `/#/v2` |
| 独立下载 | `/#/v1/download` | `/#/v2/download` |
| 使用教程 | `/#/v1/guide` | `/#/v2/guide` |
| 一代完整参考手册 | `/#/v1/guide/reference` | 不复用一代手册 |

共享入口：

- `/#/`：网站首页与产品选择
- `/#/download`：下载版本选择
- `/#/guide`：教程版本选择
- `/#/market`：两代共用**同一个**插件市场、数据源及账号系统
- `/#/developers/plugins`：共享插件开发文档
- 现有 `operit-*` 登录、投稿、审核、管理路由保持不变

`src/config/products.ts` 集中定义代际、入口、文档根目录与下载来源；`src/routing/AppRoutes.tsx` 定义路由树。插件市场内部的 **Market v2 数据协议**不是 **Operit 2 产品代际**，不会为二代再复制市场。

### 下载来源与二代上线

一代从 `AAswordman/Operit` 的 GitHub Release 获取 APK，保留现有下载线路选择。

Operit 2 是**全平台产品**。iOS 与 macOS 公测已开放，共用 TestFlight 邀请：

```text
https://testflight.apple.com/join/hzq2xRrH
```

公测地址集中定义在 `src/config/products.ts`，首页、二代介绍页和二代下载页直接读取，无需额外环境变量即可使用。其他平台正在内测，参与入口将逐步开放；不会将一代 APK 作为二代安装包。

如果后续需要提供额外的二代官方发布入口，可选配置 `.env.local` 或部署构建环境：

```dotenv
VITE_OPERIT_V2_DOWNLOAD_URL=https://你的官方二代发布地址
```

该配置增加“其他官方二代发布入口”，**不会替换或隐藏已开放的 iOS / macOS TestFlight 入口**。现有 GitHub Actions 部署工作流保持不变，公测链接无需环境变量。只接受 HTTPS 地址；变量会进入前端构建，不能放入密钥，更改后需要重新构建。也可参考 `.env.example`。

### 多语言文档来源

- `public/newcontent/{zh,en}/`：**一代**教程式文档（原“新文档”是文档重写，不是二代）
- `public/content/{zh,en}/`：一代完整参考手册
- `public/v2content/{zh,en}/`：二代专属文档，目前只有欢迎与发布前说明，正式教程随版本补充
- `public/plugin-tutorial/{zh,en}/`：两代共享插件开发资料

英文文档不存在时只回退到**同一文档根目录**的中文版本，不跨代际回退。各文档目录继续支持原来的编辑/投稿流程；本次同步扩展了 `workers/operit-api/src/workerShared.js` 的安全路径白名单，**需要一并部署 operit-api Worker**，否则线上旧 Worker 仍只接受 `content/` 下的投稿。

### 站内链接与旧链接兼容

新文档链接请使用明确的代际或共享入口，例如：

```markdown
[一代快速开始](/#/v1/guide/beginner-tutorial/01-quick-start)
[一代模型参考](/#/v1/guide/reference/basic-config/model-config)
[二代教程](/#/v2/guide)
[插件开发](/#/developers/plugins)
[共享市场](/#/market)
```

不需要包含语言代码或 `.md` 后缀。旧路由使用 `replace` 跳转，保留文章后缀、查询参数和锚点：

- `/classic` → `/v1`
- `/guide/new/*` → `/v1/guide/*`
- `/guide/old/*` → `/v1/guide/reference/*`
- `/guide/plugin/*` → `/developers/plugins/*`
- 更早的 `/guide/quick-start`、`/guide/basic-config/*` 等 → 一代参考手册
- `/v1/market`、`/v2/market` → `/market`

旧 Markdown 内的 Hash 路由链接也会在渲染时归一化，因此无需批量修改历史文档或客户端公告。

运行 `pnpm test:site` 验证路由映射、代际隔离、下载配置、文档来源和页面元信息。

`pnpm test:site:smoke` 使用 Puppeteer 自动启动本地 Vite，检查页面、旧链接跳转、文档隔离、共享市场、移动导航、英文与浅色主题。GitHub Release 和市场请求使用固定测试数据，不触发真实下载、登录或投稿。需要本机 Chromium（Windows 自动检测 Edge/Chrome，也可通过 `BROWSER_EXECUTABLE` 指定）。可用 `SITE_TEST_URL` 测试已有开发/预览服务器，用 `SITE_TEST_V2_DOWNLOAD_URL` 验证二代下载地址配置后的显示。

### 图片路径

文档中建议使用以 `/` 开头的绝对路径引用静态资源（例如 `![xx](/manuals/assets/...)`）。

## PDF 导出（export-pdf）

`pnpm export-pdf` 会：

- 启动本地 `pnpm dev`
- 使用 Puppeteer 打开文档页面并按路由逐页导出 PDF

注意：脚本当前默认扫描的 Markdown 目录为 `public/content/docs`（见 `generate-pdfs.mjs` 中的 `DOCS_PATH`）。如果你的文档实际位于 `public/content/zh` / `public/content/en`，需要调整该路径后再导出。

## 部署

- **GitHub Pages**：见 `.github/workflows/deploy.yml`，会在 `main` 分支 push 时构建并发布 `dist/`
- **自定义域名**：仓库根目录 `CNAME` 为 `operit.aaswordsman.org`
- **EdgeOne 重写**：`edgeone.json` 中包含 `/OperitWeb/*` 到 `/:splat` 的重写规则

## 联网公告（静态 JSON）

为 Android 客户端提供了无需 Worker 的公告发布方式（纯静态文件）：

- 最新入口：`https://operit.aaswordsman.org/announcements/latest.json`
- 版本化正文：`https://operit.aaswordsman.org/announcements/history/2026-02-13-chat-binding-announcement-v1.json`

目录结构：

- `public/announcements/latest.json`：当前生效公告指针（`latestFile` + `latestVersion`）
- `public/announcements/history/*.json`：具体公告内容（可回溯）

客户端建议接入流程：

1. 拉取 `latest.json`（建议附带时间戳 query 防缓存，如 `?t=20260213T1200`）
2. 读取 `latestFile` 并继续拉取对应历史公告
3. 用公告 `version` 与本地已读版本比较（大于才展示）
4. 网络失败时回退到应用内置公告逻辑

注意：GitHub Pages 不支持像 Cloudflare Pages `_headers` 那样自定义响应头，缓存控制建议在客户端完成（query 参数 + 本地过期策略）。

## 插件拒绝列表（静态 JSON）

Android 客户端还会在拉取公告时同步拉取插件拒绝列表，用于阻止已知风险插件文件被导入。该列表同样是纯静态文件，不经过市场 Worker：

- 最新入口：`https://operit.aaswordsman.org/plugin-denylist/latest.json`
- 版本化内容：`https://operit.aaswordsman.org/plugin-denylist/history/*.json`

格式、发布步骤和 SHA-256 计算范围见 [docs/PLUGIN_DENYLIST.md](docs/PLUGIN_DENYLIST.md)。首次发布的列表为空；只有经明确审核批准的文件 SHA-256 才能加入。

## 开发提示

- 如果你新增了新的文档页面，请确保路由（`src/App.tsx`）与文档文件路径对应
- 文档菜单项位于 `src/pages/GuidePage.tsx`

## License

以仓库内实际 License 文件为准（如需补充请添加）。
